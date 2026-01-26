/**
 * ToolApiHandler 核心功能测试
 * 测试核心业务逻辑和边界条件处理
 */

import { ToolType } from "@root/types/toolApi.js";
import { configManager } from "@xiaozhi-client/config";
import type { Context } from "hono";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ToolApiHandler } from "../ToolApiHandler.js";

// Mock configManager
vi.mock("@xiaozhi-client/config", () => ({
  configManager: {
    addCustomMCPTool: vi.fn(),
    getCustomMCPTools: vi.fn(() => []),
    getCozePlatformConfig: vi.fn(() => ({ token: "test-token" })),
    validateCustomMCPTools: vi.fn(() => true),
    configExists: vi.fn(() => true),
    getConfigPath: vi.fn(() => "/test/config.json"),
    updateCustomMCPTool: vi.fn(),
    removeCustomMCPTool: vi.fn(),
    getServerToolsConfig: vi.fn(),
    updateServerToolsConfig: vi.fn(),
  },
}));

// Mock MCPServiceManager - 在 Context 中提供
const mockServiceManager = {
  hasTool: vi.fn(() => false),
  hasCustomMCPTool: vi.fn(() => false),
  getCustomMCPTools: vi.fn(() => []),
  getAllTools: vi.fn(() => []),
  callTool: vi.fn(),
  getStatus: vi.fn(() => ({
    isRunning: true,
    totalTools: 0,
    availableTools: 0,
    services: {},
  })),
  getConnectedServices: vi.fn(() => []),
  stopService: vi.fn(),
  startService: vi.fn(),
};

// Mock MCPCacheManager
vi.mock("@/lib/mcp", () => ({
  MCPCacheManager: vi.fn().mockImplementation(() => ({
    getAllCachedTools: vi.fn().mockResolvedValue([]),
  })) as any,
}));

describe("ToolApiHandler - 核心功能测试", () => {
  let handler: ToolApiHandler;
  let mockContext: Partial<Context>;

  beforeEach(() => {
    handler = new ToolApiHandler();
    mockContext = {
      req: {
        json: vi.fn(),
        query: vi.fn(),
        param: vi.fn(),
      } as any,
      json: vi.fn(),
      get: vi.fn((key: string) => {
        if (key === "mcpServiceManager") {
          return mockServiceManager;
        }
        return undefined;
      }),
      success: vi.fn((data: unknown, message?: string, status?: number) => {
        return {
          status: status || 200,
          json: () => ({
            success: true,
            data,
            message,
          }),
        };
      }),
      fail: vi.fn(
        (code: string, message: string, details?: unknown, status?: number) => {
          return {
            status: status || 500,
            json: () => ({
              success: false,
              error: {
                code,
                message,
                details,
              },
            }),
          };
        }
      ),
    } as any;
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("getCustomTools - 获取自定义工具列表", () => {
    it("应该成功获取自定义工具列表", async () => {
      const mockTools = [
        {
          name: "test-tool",
          description: "测试工具",
          inputSchema: { type: "object", properties: {} },
          handler: {
            type: "proxy" as const,
            platform: "coze" as const,
            config: {
              workflow_id: "test-workflow-id",
              api_key: "test-api-key",
            },
          },
        },
      ];

      vi.mocked(configManager.getCustomMCPTools).mockReturnValue(mockTools);
      vi.mocked(configManager.getConfigPath).mockReturnValue(
        "/test/config.json"
      );

      await handler.getCustomTools(mockContext as Context);

      expect(mockContext.success).toHaveBeenCalledWith(
        {
          tools: mockTools,
          totalTools: 1,
          configPath: "/test/config.json",
        },
        "获取自定义 MCP 工具列表成功"
      );
    });

    it("应该处理配置文件不存在的情况", async () => {
      vi.mocked(configManager.configExists).mockReturnValue(false);

      await handler.getCustomTools(mockContext as Context);

      expect(mockContext.fail).toHaveBeenCalledWith(
        "CONFIG_NOT_FOUND",
        "配置文件不存在，请先运行 'xiaozhi init' 初始化配置",
        undefined,
        404
      );
    });

    it("应该处理配置解析失败的情况", async () => {
      vi.mocked(configManager.getCustomMCPTools).mockImplementation(() => {
        throw new Error("配置解析失败");
      });

      await handler.getCustomTools(mockContext as Context);

      expect(mockContext.fail).toHaveBeenCalledWith(
        "CONFIG_PARSE_ERROR",
        "配置文件解析失败: 配置解析失败",
        undefined,
        500
      );
    });

    it("应该处理工具验证失败的情况", async () => {
      const mockTools = [
        {
          name: "invalid-tool",
          description: "无效工具",
          inputSchema: { type: "object", properties: {} },
          handler: {
            type: "proxy" as const,
            platform: "coze" as const,
            config: {
              workflow_id: "test-workflow-id",
              api_key: "test-api-key",
            },
          },
        },
      ];
      vi.mocked(configManager.getCustomMCPTools).mockReturnValue(mockTools);
      vi.mocked(configManager.validateCustomMCPTools).mockReturnValue(false);

      await handler.getCustomTools(mockContext as Context);

      expect(mockContext.fail).toHaveBeenCalledWith(
        "INVALID_TOOL_CONFIG",
        "自定义 MCP 工具配置验证失败，请检查配置文件中的工具定义",
        undefined,
        400
      );
    });

    it("应该处理空工具列表的情况", async () => {
      vi.mocked(configManager.getCustomMCPTools).mockReturnValue([]);

      await handler.getCustomTools(mockContext as Context);

      expect(mockContext.success).toHaveBeenCalledWith(
        {
          tools: [],
          totalTools: 0,
          configPath: "/test/config.json",
        },
        "未配置自定义 MCP 工具"
      );
    });
  });

  describe("handleNewFormatAddTool - 新格式工具添加", () => {
    it("应该正确处理 MCP 类型的工具添加", async () => {
      const requestBody = {
        type: ToolType.MCP,
        data: {
          serviceName: "test-service",
          toolName: "test-tool",
        },
      };

      mockContext.req!.json = vi.fn().mockResolvedValue(requestBody);

      // Mock configManager methods to avoid complex dependencies
      vi.mocked(configManager.addCustomMCPTool).mockImplementation(() => {});
      vi.mocked(configManager.getServerToolsConfig).mockReturnValue({});
      vi.mocked(configManager.updateServerToolsConfig).mockImplementation(
        () => {}
      );

      // Mock MCPCacheManager
      const { MCPCacheManager } = await import("@/lib/mcp");
      const mockMCPCacheManager = vi.mocked(MCPCacheManager);
      mockMCPCacheManager.mockImplementation(
        () =>
          ({
            getAllCachedTools: vi.fn().mockResolvedValue([
              {
                name: "test-service__test-tool",
                description: "测试工具",
                inputSchema: { type: "object", properties: {} },
              },
            ]),
          }) as any
      );

      await handler.addCustomTool(mockContext as Context);

      // Verify the request was processed correctly by checking the success response
      expect(mockContext.success).toHaveBeenCalledWith(
        expect.objectContaining({
          toolName: "test-service__test-tool",
          toolType: "mcp",
        }),
        expect.stringContaining("添加成功")
      );
    });

    it("应该正确处理 Coze 类型的工具添加", async () => {
      const requestBody = {
        type: ToolType.COZE,
        data: {
          workflow: {
            workflow_id: "123456789",
            workflow_name: "测试工作流",
            app_id: "test-app-id",
          },
        },
      };

      mockContext.req!.json = vi.fn().mockResolvedValue(requestBody);

      // Mock configManager methods for Coze workflow processing
      vi.mocked(configManager.addCustomMCPTool).mockImplementation(() => {});

      await handler.addCustomTool(mockContext as Context);

      // Verify the request was processed correctly by checking the success response
      expect(mockContext.success).toHaveBeenCalledWith(
        expect.objectContaining({
          toolName: expect.any(String),
          toolType: "coze",
        }),
        expect.stringContaining("添加成功")
      );
    });

    it("应该拒绝无效的工具类型", async () => {
      const requestBody = {
        type: "INVALID_TYPE",
        data: {},
      };

      mockContext.req!.json = vi.fn().mockResolvedValue(requestBody);

      await handler.addCustomTool(mockContext as Context);

      expect(mockContext.fail).toHaveBeenCalledWith(
        "INVALID_TOOL_TYPE",
        expect.stringContaining("不支持的工具类型"),
        undefined,
        400
      );
    });

    it("应该处理未实现的工具类型", async () => {
      const requestBody = {
        type: ToolType.HTTP,
        data: {},
      };

      mockContext.req!.json = vi.fn().mockResolvedValue(requestBody);

      await handler.addCustomTool(mockContext as Context);

      expect(mockContext.fail).toHaveBeenCalledWith(
        "TOOL_TYPE_NOT_IMPLEMENTED",
        expect.stringContaining("暂未实现"),
        undefined,
        501
      );
    });
  });

  describe("updateCustomTool - 工具更新", () => {
    it("应该验证工具名称", async () => {
      mockContext.req!.param = vi.fn().mockReturnValue("");

      await handler.updateCustomTool(mockContext as Context);

      expect(mockContext.fail).toHaveBeenCalledWith(
        "INVALID_REQUEST",
        "工具名称不能为空",
        undefined,
        400
      );
    });

    it("应该验证请求体", async () => {
      mockContext.req!.param = vi.fn().mockReturnValue("test-tool");
      mockContext.req!.json = vi.fn().mockResolvedValue(null);

      await handler.updateCustomTool(mockContext as Context);

      expect(mockContext.fail).toHaveBeenCalledWith(
        "INVALID_REQUEST",
        "请求体必须是有效对象",
        undefined,
        400
      );
    });

    it("应该拒绝旧格式的更新请求", async () => {
      const requestBody = {
        workflow: { workflow_id: "test" },
      };

      mockContext.req!.param = vi.fn().mockReturnValue("test-tool");
      mockContext.req!.json = vi.fn().mockResolvedValue(requestBody);

      await handler.updateCustomTool(mockContext as Context);

      expect(mockContext.fail).toHaveBeenCalledWith(
        "INVALID_REQUEST",
        "更新操作只支持新格式的请求",
        undefined,
        400
      );
    });
  });
});

/**
 * ToolApiHandler 核心功能测试
 * 测试核心业务逻辑和边界条件处理
 */

import type { Context } from "hono";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { configManager } from "../../configManager";
import { MCPServiceManagerSingleton } from "../../services";
import type { CozeWorkflow } from "../../types";
import { ToolType } from "../../types/toolApi.js";
import { ToolApiHandler } from "../ToolApiHandler.js";

// Mock configManager
vi.mock("../../configManager.js", () => ({
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

// Mock MCPServiceManagerSingleton
vi.mock("../../services/MCPServiceManagerSingleton.js", () => ({
  MCPServiceManagerSingleton: {
    isInitialized: vi.fn(() => true),
    getInstance: vi.fn(() =>
      Promise.resolve({
        hasCustomMCPTool: vi.fn(() => false),
        getCustomMCPTools: vi.fn(() => []),
      })
    ),
  },
}));

// Mock MCPCacheManager
vi.mock("../../services/MCPCacheManager.js", () => ({
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

      expect(mockContext.json).toHaveBeenCalledWith({
        success: true,
        data: {
          tools: mockTools,
          totalTools: 1,
          configPath: "/test/config.json",
        },
        message: "获取自定义 MCP 工具列表成功",
      });
    });

    it("应该处理配置文件不存在的情况", async () => {
      vi.mocked(configManager.configExists).mockReturnValue(false);

      await handler.getCustomTools(mockContext as Context);

      expect(mockContext.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: {
            code: "CONFIG_NOT_FOUND",
            message: "配置文件不存在，请先运行 'xiaozhi init' 初始化配置",
          },
        }),
        404
      );
    });

    it("应该处理配置解析失败的情况", async () => {
      vi.mocked(configManager.getCustomMCPTools).mockImplementation(() => {
        throw new Error("配置解析失败");
      });

      await handler.getCustomTools(mockContext as Context);

      expect(mockContext.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: {
            code: "CONFIG_PARSE_ERROR",
            message: "配置文件解析失败: 配置解析失败",
          },
        }),
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

      expect(mockContext.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: {
            code: "INVALID_TOOL_CONFIG",
            message: "自定义 MCP 工具配置验证失败，请检查配置文件中的工具定义",
          },
        }),
        400
      );
    });

    it("应该处理空工具列表的情况", async () => {
      vi.mocked(configManager.getCustomMCPTools).mockReturnValue([]);

      await handler.getCustomTools(mockContext as Context);

      expect(mockContext.json).toHaveBeenCalledWith({
        success: true,
        data: {
          tools: [],
          totalTools: 0,
          configPath: "/test/config.json",
        },
        message: "未配置自定义 MCP 工具",
      });
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
      const { MCPCacheManager } = await import(
        "../../services/MCPCacheManager.js"
      );
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

      // Verify the request was processed correctly by checking the json response
      expect(mockContext.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true, // Should succeed with proper mocks
          data: expect.objectContaining({
            toolName: "test-service__test-tool",
            toolType: "mcp",
          }),
        })
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

      // Verify the request was processed correctly by checking the json response
      expect(mockContext.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true, // Should succeed with proper test data
          data: expect.objectContaining({
            toolName: expect.any(String),
            toolType: "coze",
          }),
        })
      );
    });

    it("应该拒绝无效的工具类型", async () => {
      const requestBody = {
        type: "INVALID_TYPE",
        data: {},
      };

      mockContext.req!.json = vi.fn().mockResolvedValue(requestBody);

      await handler.addCustomTool(mockContext as Context);

      expect(mockContext.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: {
            code: "INVALID_TOOL_TYPE",
            message: expect.stringContaining("不支持的工具类型"),
          },
        }),
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

      expect(mockContext.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: {
            code: "TOOL_TYPE_NOT_IMPLEMENTED",
            message: expect.stringContaining("暂未实现"),
          },
        }),
        501
      );
    });
  });

  describe("handleAddMCPTool - MCP 工具添加", () => {
    // 这些测试暂时跳过，因为需要复杂的 mock 设置
    it.skip("应该验证必需字段", async () => {
      // 测试必需字段验证逻辑
    });
  });

  describe("updateCustomTool - 工具更新", () => {
    it("应该验证工具名称", async () => {
      mockContext.req!.param = vi.fn().mockReturnValue("");

      await handler.updateCustomTool(mockContext as Context);

      expect(mockContext.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: {
            code: "INVALID_REQUEST",
            message: "工具名称不能为空",
          },
        }),
        400
      );
    });

    it("应该验证请求体", async () => {
      mockContext.req!.param = vi.fn().mockReturnValue("test-tool");
      mockContext.req!.json = vi.fn().mockResolvedValue(null);

      await handler.updateCustomTool(mockContext as Context);

      expect(mockContext.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: {
            code: "INVALID_REQUEST",
            message: "请求体必须是有效对象",
          },
        }),
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

      expect(mockContext.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: {
            code: "INVALID_REQUEST",
            message: "更新操作只支持新格式的请求",
          },
        }),
        400
      );
    });
  });

  describe("handleNewFormatUpdateTool - 新格式工具更新", () => {
    // 这些测试暂时跳过，因为需要复杂的 mock 设置
    it.skip("应该验证工具类型", async () => {
      // 测试工具类型验证逻辑
    });

    it.skip("应该处理未实现的更新类型", async () => {
      // 测试未实现类型的处理
    });
  });

  describe("工具验证方法", () => {
    it("应该验证必需字段", () => {
      const invalidWorkflow = {} as CozeWorkflow;

      expect(() => {
        (handler as any).validateRequiredFields(invalidWorkflow);
      }).toThrow();
    });

    it("应该验证字段格式", () => {
      const invalidWorkflow = {
        workflow_id: "invalid-id!",
        workflow_name: "测试工作流",
      } as CozeWorkflow;

      expect(() => {
        (handler as any).validateFieldFormats(invalidWorkflow);
      }).toThrow();
    });

    it("应该验证业务逻辑", () => {
      const invalidWorkflow = {
        workflow_id: "123",
        workflow_name: "admin_workflow",
        app_id: "test-app",
      } as CozeWorkflow;

      expect(() => {
        (handler as any).validateBusinessLogic(invalidWorkflow);
      }).toThrow();
    });
  });

  describe("工具名称处理", () => {
    it("应该正确处理工具名称", () => {
      const sanitizeToolName = (handler as any).sanitizeToolName.bind(handler);

      expect(sanitizeToolName("Test Tool")).toBe("Test_Tool");
      expect(sanitizeToolName("Test@Tool#")).toBe("Test_Tool");
      expect(sanitizeToolName("测试工具")).toBe("chinese_test");
    });

    it("应该转换中文为英文", () => {
      const convertChineseToEnglish = (
        handler as any
      ).convertChineseToEnglish.bind(handler);

      expect(convertChineseToEnglish("测试工具")).toBe("chinese_test工具");
      expect(convertChineseToEnglish("工作流")).toBe("workflow");
    });
  });

  describe("错误处理", () => {
    it("应该正确处理添加工具错误", () => {
      const handleAddToolError = (handler as any).handleAddToolError.bind(
        handler
      );

      const error = new Error("测试错误");
      const result = handleAddToolError(error);

      expect(result.statusCode).toBe(500);
      expect(result.errorResponse.error.code).toBe("ADD_CUSTOM_TOOL_ERROR");
    });

    it("应该正确处理更新工具错误", () => {
      const handleUpdateToolError = (handler as any).handleUpdateToolError.bind(
        handler
      );

      const error = new Error("测试错误");
      const result = handleUpdateToolError(error);

      expect(result.statusCode).toBe(500);
      expect(result.errorResponse.error.code).toBe("UPDATE_CUSTOM_TOOL_ERROR");
    });

    it("应该正确处理删除工具错误", () => {
      const handleRemoveToolError = (handler as any).handleRemoveToolError.bind(
        handler
      );

      const error = new Error("测试错误");
      const result = handleRemoveToolError(error);

      expect(result.statusCode).toBe(500);
      expect(result.errorResponse.error.code).toBe("REMOVE_CUSTOM_TOOL_ERROR");
    });
  });
});

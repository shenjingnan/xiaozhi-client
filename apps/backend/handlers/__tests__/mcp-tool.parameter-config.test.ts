/**
 * MCPToolHandler 参数配置功能测试
 * 测试第二阶段新增的参数配置功能
 */

import type {
  CozeWorkflow,
  WorkflowParameterConfig,
} from "@/root/types/coze.js";
import { configManager } from "@xiaozhi-client/config";
import type { Context } from "hono";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MCPToolHandler } from "../mcp-tool.handler.js";

// Mock configManager
vi.mock("@xiaozhi-client/config", () => ({
  configManager: {
    addCustomMCPTool: vi.fn(),
    getCustomMCPTools: vi.fn(() => []),
    getCozePlatformConfig: vi.fn(() => ({ token: "test-token" })),
    validateCustomMCPTools: vi.fn(() => true),
  },
}));

describe("MCPToolHandler - 参数配置功能", () => {
  let handler: MCPToolHandler;
  let mockContext: Partial<Context>;

  // 测试用的工作流数据
  const mockWorkflow: CozeWorkflow = {
    workflow_id: "123456789",
    workflow_name: "测试工作流",
    description: "这是一个测试工作流",
    icon_url: "https://example.com/icon.png",
    app_id: "test-app-456",
    creator: {
      id: "creator-789",
      name: "测试创建者",
    },
    created_at: Date.now(),
    updated_at: Date.now(),
  };

  // 测试用的参数配置
  const mockParameterConfig: WorkflowParameterConfig = {
    parameters: [
      {
        fieldName: "userName",
        description: "用户名称",
        type: "string",
        required: true,
      },
      {
        fieldName: "age",
        description: "用户年龄",
        type: "number",
        required: false,
      },
      {
        fieldName: "isActive",
        description: "是否激活",
        type: "boolean",
        required: true,
      },
    ],
  };

  beforeEach(() => {
    handler = new MCPToolHandler();
    mockContext = {
      req: {
        json: vi.fn(),
      } as any,
      json: vi.fn(),
      get: vi.fn((key: string) => {
        if (key === "logger") {
          return {
            debug: vi.fn(),
            info: vi.fn(),
            error: vi.fn(),
            warn: vi.fn(),
          };
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

  describe("addCustomTool - 参数配置支持", () => {
    it("应该支持不带参数配置的请求（向后兼容）", async () => {
      const requestBody = {
        workflow: mockWorkflow,
        customName: "测试工具",
        customDescription: "测试描述",
      };

      mockContext.req!.json = vi.fn().mockResolvedValue(requestBody);
      mockContext.json = vi.fn().mockReturnValue(new Response());

      await handler.addCustomTool(mockContext as Context);

      expect(configManager.addCustomMCPTool).toHaveBeenCalledWith(
        expect.objectContaining({
          name: expect.any(String),
          description: expect.any(String),
          inputSchema: expect.objectContaining({
            type: "object",
            properties: expect.objectContaining({
              input: expect.objectContaining({
                type: "string",
                description: "输入内容",
              }),
            }),
            required: ["input"],
          }),
          handler: expect.any(Object),
        })
      );
    });

    it("应该支持带参数配置的请求", async () => {
      const requestBody = {
        workflow: mockWorkflow,
        customName: "测试工具",
        customDescription: "测试描述",
        parameterConfig: mockParameterConfig,
      };

      mockContext.req!.json = vi.fn().mockResolvedValue(requestBody);
      mockContext.json = vi.fn().mockReturnValue(new Response());

      await handler.addCustomTool(mockContext as Context);

      expect(configManager.addCustomMCPTool).toHaveBeenCalledWith(
        expect.objectContaining({
          name: expect.any(String),
          description: expect.any(String),
          inputSchema: expect.objectContaining({
            type: "object",
            properties: expect.objectContaining({
              userName: expect.objectContaining({
                type: "string",
                description: "用户名称",
              }),
              age: expect.objectContaining({
                type: "number",
                description: "用户年龄",
              }),
              isActive: expect.objectContaining({
                type: "boolean",
                description: "是否激活",
              }),
            }),
            required: ["userName", "isActive"],
          }),
          handler: expect.any(Object),
        })
      );
    });

    it("应该支持空参数配置", async () => {
      const requestBody = {
        workflow: mockWorkflow,
        parameterConfig: { parameters: [] },
      };

      mockContext.req!.json = vi.fn().mockResolvedValue(requestBody);
      mockContext.json = vi.fn().mockReturnValue(new Response());

      await handler.addCustomTool(mockContext as Context);

      // 空参数配置应该使用默认schema
      expect(configManager.addCustomMCPTool).toHaveBeenCalledWith(
        expect.objectContaining({
          inputSchema: expect.objectContaining({
            type: "object",
            properties: expect.objectContaining({
              input: expect.objectContaining({
                type: "string",
                description: "输入内容",
              }),
            }),
            required: ["input"],
          }),
        })
      );
    });

    it("应该正确处理只有可选参数的配置", async () => {
      const optionalOnlyConfig: WorkflowParameterConfig = {
        parameters: [
          {
            fieldName: "optionalParam",
            description: "可选参数",
            type: "string",
            required: false,
          },
        ],
      };

      const requestBody = {
        workflow: mockWorkflow,
        parameterConfig: optionalOnlyConfig,
      };

      mockContext.req!.json = vi.fn().mockResolvedValue(requestBody);
      mockContext.json = vi.fn().mockReturnValue(new Response());

      await handler.addCustomTool(mockContext as Context);

      expect(configManager.addCustomMCPTool).toHaveBeenCalledWith(
        expect.objectContaining({
          inputSchema: expect.objectContaining({
            type: "object",
            properties: expect.objectContaining({
              optionalParam: expect.objectContaining({
                type: "string",
                description: "可选参数",
              }),
            }),
            required: undefined, // 没有必填参数时应该是undefined
          }),
        })
      );
    });
  });
});

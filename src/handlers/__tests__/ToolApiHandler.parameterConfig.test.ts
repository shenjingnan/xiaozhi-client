/**
 * ToolApiHandler 参数配置功能测试
 * 测试第二阶段新增的参数配置功能
 */

import type { Context } from "hono";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { configManager } from "../../configManager.js";
import type {
  CozeWorkflow,
  WorkflowParameterConfig,
} from "../../types/coze.js";
import { ToolApiHandler } from "../ToolApiHandler.js";

// Mock configManager
vi.mock("../../configManager.js", () => ({
  configManager: {
    addCustomMCPTool: vi.fn(),
    getCustomMCPTools: vi.fn(() => []),
    getCozePlatformConfig: vi.fn(() => ({ token: "test-token" })),
    validateCustomMCPTools: vi.fn(() => true),
  },
}));

// Mock MCPServiceManagerSingleton
vi.mock("@services/MCPServiceManagerSingleton.js", () => ({
  MCPServiceManagerSingleton: {
    isInitialized: vi.fn(() => true),
    getInstance: vi.fn(() => Promise.resolve({})),
  },
}));

describe("ToolApiHandler - 参数配置功能", () => {
  let handler: ToolApiHandler;
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
    handler = new ToolApiHandler();
    mockContext = {
      req: {
        json: vi.fn(),
      } as any,
      json: vi.fn(),
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

  describe("generateInputSchemaFromConfig - 参数转换逻辑", () => {
    it("应该正确转换参数配置为JSON Schema", () => {
      // 通过反射访问私有方法进行测试
      const generateMethod = (
        handler as any
      ).generateInputSchemaFromConfig.bind(handler);
      const result = generateMethod(mockParameterConfig);

      expect(result).toEqual({
        type: "object",
        properties: {
          userName: {
            type: "string",
            description: "用户名称",
          },
          age: {
            type: "number",
            description: "用户年龄",
          },
          isActive: {
            type: "boolean",
            description: "是否激活",
          },
        },
        required: ["userName", "isActive"],
        additionalProperties: false,
      });
    });

    it("应该处理没有必填参数的情况", () => {
      const allOptionalConfig: WorkflowParameterConfig = {
        parameters: [
          {
            fieldName: "param1",
            description: "参数1",
            type: "string",
            required: false,
          },
          {
            fieldName: "param2",
            description: "参数2",
            type: "number",
            required: false,
          },
        ],
      };

      const generateMethod = (
        handler as any
      ).generateInputSchemaFromConfig.bind(handler);
      const result = generateMethod(allOptionalConfig);

      expect(result.required).toBeUndefined();
    });

    it("应该处理空参数列表", () => {
      const emptyConfig: WorkflowParameterConfig = {
        parameters: [],
      };

      const generateMethod = (
        handler as any
      ).generateInputSchemaFromConfig.bind(handler);
      const result = generateMethod(emptyConfig);

      expect(result).toEqual({
        type: "object",
        properties: {},
        required: undefined,
        additionalProperties: false,
      });
    });
  });
});

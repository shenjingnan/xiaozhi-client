/**
 * MCPToolHandler 单元测试
 *
 * ⚠️ 注意：这些是单元测试，不是真正的集成测试
 * - 使用了大量的 Mock，不涉及真实的 HTTP 请求
 * - 主要测试 handler 的基本调用流程
 * - 不应作为防止回归 Bug 的唯一保障
 *
 * 真正的集成测试应该：
 * - 启动真实的 WebServer
 * - 发送真实的 HTTP 请求
 * - 测试完整的端到端场景
 * - 参考：mcp.handler.integration.test.ts
 */

import { configManager } from "@xiaozhi-client/config";
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { MCPToolHandler } from "../mcp-tool.handler.js";

// 模拟依赖
vi.mock("../../Logger.js", () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
  },
}));

describe("MCPToolHandler - 单元测试", () => {
  let mcpToolHandler: MCPToolHandler;
  let mockContext: any;
  let mockServiceManager: any;
  let originalConfig: any;

  beforeAll(() => {
    // 保存原始配置
    originalConfig = {
      getCustomMCPTools: configManager.getCustomMCPTools,
      hasValidCustomMCPTools: configManager.hasValidCustomMCPTools,
    };
  });

  afterAll(() => {
    // 恢复原始配置
    Object.assign(configManager, originalConfig);
  });

  beforeEach(() => {
    mcpToolHandler = new MCPToolHandler();

    // 初始化 Mock ServiceManager
    mockServiceManager = {
      hasCustomMCPTool: vi.fn(),
      getCustomMCPTools: vi.fn(),
      callTool: vi.fn().mockResolvedValue({
        content: [{ type: "text", text: "工具调用成功" }],
        isError: false,
      }),
      getAllTools: vi.fn(),
    };

    // Mock Hono context with dependency injection support
    mockContext = {
      req: {
        json: vi.fn(),
      },
      // json 是底层方法，需要被 success/fail 调用
      json: vi.fn((data: any, status?: number) => ({
        status: status || 200,
        data,
      })),
      // 添加依赖注入支持
      get: vi.fn((key: string) => {
        if (key === "mcpServiceManager") {
          return mockServiceManager;
        }
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
      // success 方法会调用 json
      success: vi.fn(function (
        this: any,
        data: unknown,
        message?: string,
        status = 200
      ) {
        const response: any = {
          success: true,
          message,
        };
        if (data !== undefined) {
          response.data = data;
        }
        // 调用被 mock 的 json 方法
        return this.json(response, status);
      }),
      // fail 方法会调用 json
      fail: vi.fn(function (
        this: any,
        code: string,
        message: string,
        details?: unknown,
        status = 400
      ) {
        const response: any = {
          success: false,
          error: {
            code,
            message,
          },
        };
        if (details !== undefined) {
          response.error.details = details;
        }
        // 调用被 mock 的 json 方法
        return this.json(response, status);
      }),
      // 添加其他可能需要的 Hono Context 方法
      set: vi.fn(),
      has: vi.fn(),
      status: vi.fn(),
    };

    // Reset all mocks
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("不同类型的 customMCP handler 测试", () => {
    it("应该支持 proxy 类型的 handler", async () => {
      // 准备
      const proxyToolConfig = {
        name: "test_proxy_tool",
        description: "测试代理工具",
        inputSchema: {
          type: "object",
          properties: {
            input: { type: "string" },
          },
          required: ["input"],
        },
        handler: {
          type: "proxy",
          platform: "coze",
          config: {
            workflow_id: "test_workflow_id",
          },
        },
      };

      const requestBody = {
        serviceName: "customMCP",
        toolName: "test_proxy_tool",
        args: { input: "测试输入" },
      };

      mockContext.req.json.mockResolvedValue(requestBody);

      // 模拟 configManager
      configManager.getCustomMCPTools = vi
        .fn()
        .mockReturnValue([proxyToolConfig]);
      configManager.hasValidCustomMCPTools = vi.fn().mockReturnValue(true);

      // 配置当前测试的 ServiceManager Mock
      mockServiceManager.hasCustomMCPTool.mockReturnValue(true);
      mockServiceManager.getCustomMCPTools.mockReturnValue([proxyToolConfig]);
      mockServiceManager.callTool.mockResolvedValue({
        content: [{ type: "text", text: "代理工具调用成功" }],
        isError: false,
      });

      // 执行
      await mcpToolHandler.callTool(mockContext);

      // 断言
      expect(mockServiceManager.callTool).toHaveBeenCalledWith(
        "test_proxy_tool",
        { input: "测试输入" },
        { timeout: 60000 }
      );
      expect(mockContext.success).toHaveBeenCalledWith(
        {
          content: [{ type: "text", text: "代理工具调用成功" }],
          isError: false,
        },
        "工具调用成功"
      );
    });

    it("应该支持 http 类型的 handler", async () => {
      // Arrange
      const httpToolConfig = {
        name: "test_http_tool",
        description: "测试HTTP工具",
        inputSchema: {
          type: "object",
          properties: {
            url: { type: "string" },
            method: { type: "string", enum: ["GET", "POST"] },
          },
          required: ["url"],
        },
        handler: {
          type: "http",
          config: {
            url: "https://api.example.com/test",
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
          },
        },
      };

      const requestBody = {
        serviceName: "customMCP",
        toolName: "test_http_tool",
        args: { url: "https://test.com", method: "GET" },
      };

      mockContext.req.json.mockResolvedValue(requestBody);

      // Mock configManager
      configManager.getCustomMCPTools = vi
        .fn()
        .mockReturnValue([httpToolConfig]);

      // 配置当前测试的 ServiceManager Mock
      mockServiceManager.hasCustomMCPTool.mockReturnValue(true);
      mockServiceManager.getCustomMCPTools.mockReturnValue([httpToolConfig]);
      mockServiceManager.callTool.mockResolvedValue({
        content: [{ type: "text", text: "HTTP工具调用成功" }],
        isError: false,
      });

      // Act
      await mcpToolHandler.callTool(mockContext);

      // Assert
      expect(mockServiceManager.callTool).toHaveBeenCalledWith(
        "test_http_tool",
        { url: "https://test.com", method: "GET" },
        { timeout: 60000 }
      );
      expect(mockContext.success).toHaveBeenCalledWith(
        {
          content: [{ type: "text", text: "HTTP工具调用成功" }],
          isError: false,
        },
        "工具调用成功"
      );
    });

    it("应该支持 function 类型的 handler", async () => {
      // Arrange
      const functionToolConfig = {
        name: "test_function_tool",
        description: "测试函数工具",
        inputSchema: {
          type: "object",
          properties: {
            x: { type: "number" },
            y: { type: "number" },
          },
          required: ["x", "y"],
        },
        handler: {
          type: "function",
          config: {
            code: "function add(x, y) { return x + y; }",
            functionName: "add",
          },
        },
      };

      const requestBody = {
        serviceName: "customMCP",
        toolName: "test_function_tool",
        args: { x: 5, y: 3 },
      };

      mockContext.req.json.mockResolvedValue(requestBody);

      // Mock configManager
      configManager.getCustomMCPTools = vi
        .fn()
        .mockReturnValue([functionToolConfig]);

      // 配置当前测试的 ServiceManager Mock
      mockServiceManager.hasCustomMCPTool.mockReturnValue(true);
      mockServiceManager.getCustomMCPTools.mockReturnValue([
        functionToolConfig,
      ]);
      mockServiceManager.callTool.mockResolvedValue({
        content: [{ type: "text", text: "8" }],
        isError: false,
      });

      // Act
      await mcpToolHandler.callTool(mockContext);

      // Assert
      expect(mockServiceManager.callTool).toHaveBeenCalledWith(
        "test_function_tool",
        { x: 5, y: 3 },
        { timeout: 60000 }
      );
      expect(mockContext.success).toHaveBeenCalledWith(
        {
          content: [{ type: "text", text: "8" }],
          isError: false,
        },
        "工具调用成功"
      );
    });
  });

  describe("参数验证边界情况测试", () => {
    it("应该正确处理复杂的 JSON Schema 验证", async () => {
      // Arrange
      const complexToolConfig = {
        name: "complex_validation_tool",
        description: "复杂参数验证工具",
        inputSchema: {
          type: "object",
          properties: {
            user: {
              type: "object",
              properties: {
                name: { type: "string", minLength: 2, maxLength: 50 },
                age: { type: "integer", minimum: 0, maximum: 150 },
                email: { type: "string" },
              },
              required: ["name", "age"],
            },
            preferences: {
              type: "array",
              items: {
                type: "string",
                enum: ["option1", "option2", "option3"],
              },
              minItems: 1,
              maxItems: 3,
            },
          },
          required: ["user"],
        },
        handler: {
          type: "function",
          config: {
            code: "function process(data) { return 'processed'; }",
            functionName: "process",
          },
        },
      };

      const requestBody = {
        serviceName: "customMCP",
        toolName: "complex_validation_tool",
        args: {
          user: {
            name: "A", // 太短，应该失败
            age: 25,
          },
        },
      };

      mockContext.req.json.mockResolvedValue(requestBody);

      // Mock configManager
      configManager.getCustomMCPTools = vi
        .fn()
        .mockReturnValue([complexToolConfig]);

      // 配置当前测试的 ServiceManager Mock
      mockServiceManager.hasCustomMCPTool.mockReturnValue(true);
      mockServiceManager.getCustomMCPTools.mockReturnValue([complexToolConfig]);

      // Act
      await mcpToolHandler.callTool(mockContext);

      // Assert
      expect(mockContext.fail).toHaveBeenCalledWith(
        "INVALID_ARGUMENTS",
        expect.stringContaining("参数验证失败"),
        undefined,
        500
      );
    });

    it("应该正确处理嵌套对象的参数验证", async () => {
      // Arrange
      const nestedToolConfig = {
        name: "nested_validation_tool",
        description: "嵌套参数验证工具",
        inputSchema: {
          type: "object",
          properties: {
            config: {
              type: "object",
              properties: {
                database: {
                  type: "object",
                  properties: {
                    host: { type: "string" },
                    port: { type: "integer", minimum: 1, maximum: 65535 },
                  },
                  required: ["host", "port"],
                },
              },
              required: ["database"],
            },
          },
          required: ["config"],
        },
        handler: {
          type: "function",
          config: {
            code: "function connect(config) { return 'connected'; }",
            functionName: "connect",
          },
        },
      };

      const requestBody = {
        serviceName: "customMCP",
        toolName: "nested_validation_tool",
        args: {
          config: {
            database: {
              host: "localhost",
              port: 3306,
            },
          },
        },
      };

      mockContext.req.json.mockResolvedValue(requestBody);

      // Mock configManager
      configManager.getCustomMCPTools = vi
        .fn()
        .mockReturnValue([nestedToolConfig]);

      // 配置当前测试的 ServiceManager Mock
      mockServiceManager.hasCustomMCPTool.mockReturnValue(true);
      mockServiceManager.getCustomMCPTools.mockReturnValue([nestedToolConfig]);
      mockServiceManager.callTool.mockResolvedValue({
        content: [{ type: "text", text: "connected" }],
        isError: false,
      });

      // Act
      await mcpToolHandler.callTool(mockContext);

      // Assert
      expect(mockServiceManager.callTool).toHaveBeenCalledWith(
        "nested_validation_tool",
        {
          config: {
            database: {
              host: "localhost",
              port: 3306,
            },
          },
        },
        { timeout: 60000 }
      );
      expect(mockContext.success).toHaveBeenCalledWith(
        {
          content: [{ type: "text", text: "connected" }],
          isError: false,
        },
        "工具调用成功"
      );
    });
  });

  describe("addCustomTool", () => {
    beforeEach(() => {
      vi.spyOn(configManager, "addCustomMCPTool").mockImplementation(() => {});
      vi.spyOn(configManager, "getCozePlatformConfig").mockReturnValue({
        token: "test_token_123",
      });
      vi.spyOn(configManager, "getCustomMCPTools").mockReturnValue([]);
      vi.spyOn(configManager, "validateCustomMCPTools").mockReturnValue(true);
    });

    it("应该成功添加自定义工具", async () => {
      const mockWorkflow = {
        workflow_id: "123",
        workflow_name: "测试工作流",
        description: "这是一个测试工作流",
        icon_url: "",
        app_id: "app_123",
        creator: { id: "user_123", name: "测试用户" },
        created_at: 1699123456,
        updated_at: 1699123456,
      };

      mockContext.req.json = vi.fn().mockResolvedValue({
        workflow: mockWorkflow,
      });

      const _response = await mcpToolHandler.addCustomTool(mockContext);

      expect(configManager.addCustomMCPTool).toHaveBeenCalledWith(
        expect.objectContaining({
          name: expect.stringMatching(/^[a-zA-Z]/),
          description: mockWorkflow.description,
          inputSchema: expect.objectContaining({
            type: "object",
            properties: expect.any(Object),
          }),
          handler: expect.objectContaining({
            type: "proxy",
            platform: "coze",
            config: expect.objectContaining({
              workflow_id: mockWorkflow.workflow_id,
            }),
          }),
        })
      );

      expect(mockContext.success).toHaveBeenCalled();
      const successCall = mockContext.success.mock.calls[0];
      expect(successCall[0]).toHaveProperty("tool");
      expect(successCall[1]).toContain("添加成功");
    });

    it("应该在工作流参数不完整时返回错误", async () => {
      mockContext.req.json = vi.fn().mockResolvedValue({
        workflow: {
          workflow_name: "测试工作流",
          // 缺少 workflow_id
        },
      });

      const _response = await mcpToolHandler.addCustomTool(mockContext);

      expect(mockContext.fail).toHaveBeenCalledWith(
        "INVALID_REQUEST",
        expect.stringContaining("workflow_id 不能为空"),
        undefined,
        400
      );
    });
  });

  describe("removeCustomTool", () => {
    it("应该在工具名称为空时返回错误", async () => {
      mockContext.req.param = vi.fn().mockReturnValue("");

      const _response = await mcpToolHandler.removeCustomTool(mockContext);

      expect(mockContext.fail).toHaveBeenCalledWith(
        "INVALID_REQUEST",
        "工具名称不能为空",
        undefined,
        400
      );
    });

    it("应该在配置管理器抛出错误时返回错误响应", async () => {
      mockContext.req.param = vi.fn().mockReturnValue("non_existent_tool");

      // Mock configManager.getCustomMCPTools 返回空数组，确保不会找到要删除的工具
      vi.spyOn(configManager, "getCustomMCPTools").mockReturnValue([]);

      // Mock configManager 抛出错误
      vi.spyOn(configManager, "removeCustomMCPTool").mockImplementation(() => {
        throw new Error('工具 "non_existent_tool" 不存在');
      });

      const _response = await mcpToolHandler.removeCustomTool(mockContext);

      expect(mockContext.fail).toHaveBeenCalledWith(
        "TOOL_NOT_FOUND",
        expect.stringContaining("不存在"),
        undefined,
        404
      );
    });
  });

  describe("数据验证", () => {
    beforeEach(() => {
      // Mock configManager methods
      vi.spyOn(configManager, "getCustomMCPTools").mockReturnValue([]);
      vi.spyOn(configManager, "validateCustomMCPTools").mockReturnValue(true);
      vi.spyOn(configManager, "getCozePlatformConfig").mockReturnValue({
        token: "test_token_123",
      });
    });

    it("应该验证工作流数据完整性", async () => {
      const incompleteWorkflow = {
        workflow_name: "测试工作流",
        // 缺少 workflow_id
      };

      mockContext.req.json = vi.fn().mockResolvedValue({
        workflow: incompleteWorkflow,
      });

      const _response = await mcpToolHandler.addCustomTool(mockContext);

      expect(mockContext.fail).toHaveBeenCalledWith(
        "INVALID_REQUEST",
        "workflow_id 不能为空且必须是非空字符串",
        undefined,
        400
      );
    });

    it("应该验证工作流ID格式", async () => {
      const invalidWorkflow = {
        workflow_id: "invalid_id",
        workflow_name: "测试工作流",
        description: "测试",
        icon_url: "",
        app_id: "app_123",
        creator: { id: "user_123", name: "测试用户" },
        created_at: 1699123456,
        updated_at: 1699123456,
      };

      mockContext.req.json = vi.fn().mockResolvedValue({
        workflow: invalidWorkflow,
      });

      const _response = await mcpToolHandler.addCustomTool(mockContext);

      expect(mockContext.fail).toHaveBeenCalledWith(
        "VALIDATION_ERROR",
        expect.stringContaining("工作流ID应为数字格式"),
        undefined,
        400
      );
    });

    it("应该检查扣子API配置", async () => {
      // Mock missing coze config
      vi.spyOn(configManager, "getCozePlatformConfig").mockReturnValue(null);

      const mockWorkflow = {
        workflow_id: "123",
        workflow_name: "测试工作流",
        description: "测试",
        icon_url: "",
        app_id: "app_123",
        creator: { id: "user_123", name: "测试用户" },
        created_at: 1699123456,
        updated_at: 1699123456,
      };

      mockContext.req.json = vi.fn().mockResolvedValue({
        workflow: mockWorkflow,
      });

      const _response = await mcpToolHandler.addCustomTool(mockContext);

      expect(mockContext.fail).toHaveBeenCalledWith(
        "CONFIGURATION_ERROR",
        expect.stringContaining("扣子API Token"),
        undefined,
        422
      );
    });
  });

  describe("增强数据验证", () => {
    beforeEach(() => {
      // Mock configManager methods
      vi.spyOn(configManager, "getCustomMCPTools").mockReturnValue([]);
      vi.spyOn(configManager, "validateCustomMCPTools").mockReturnValue(true);
      vi.spyOn(configManager, "getCozePlatformConfig").mockReturnValue({
        token: "test_token_123",
      });
    });

    it("应该验证工作流必需字段", async () => {
      const incompleteWorkflow = {
        workflow_id: "123",
        workflow_name: "测试工作流",
        // 缺少 app_id
      };

      mockContext.req.json = vi.fn().mockResolvedValue({
        workflow: incompleteWorkflow,
      });

      const _response = await mcpToolHandler.addCustomTool(mockContext);

      expect(mockContext.fail).toHaveBeenCalledWith(
        "VALIDATION_ERROR",
        expect.stringContaining("应用ID"),
        undefined,
        400
      );
    });

    it("应该验证字段格式", async () => {
      const invalidWorkflow = {
        workflow_id: "123",
        workflow_name: "测试工作流",
        app_id: "invalid@app#id", // 无效的app_id格式
        description: "测试",
        icon_url: "",
        creator: { id: "user_123", name: "测试用户" },
        created_at: 1699123456,
        updated_at: 1699123456,
      };

      mockContext.req.json = vi.fn().mockResolvedValue({
        workflow: invalidWorkflow,
      });

      const _response = await mcpToolHandler.addCustomTool(mockContext);

      expect(mockContext.fail).toHaveBeenCalledWith(
        "VALIDATION_ERROR",
        expect.stringContaining("应用ID只能包含字母、数字、下划线和连字符"),
        undefined,
        400
      );
    });

    it("应该验证字段长度限制", async () => {
      const longNameWorkflow = {
        workflow_id: "123",
        workflow_name: "a".repeat(150), // 超过100字符限制
        app_id: "app_123",
        description: "测试",
        icon_url: "",
        creator: { id: "user_123", name: "测试用户" },
        created_at: 1699123456,
        updated_at: 1699123456,
      };

      mockContext.req.json = vi.fn().mockResolvedValue({
        workflow: longNameWorkflow,
      });

      const _response = await mcpToolHandler.addCustomTool(mockContext);

      expect(mockContext.fail).toHaveBeenCalledWith(
        "VALIDATION_ERROR",
        expect.stringContaining("工作流名称不能超过100个字符"),
        undefined,
        400
      );
    });

    it("应该验证业务逻辑", async () => {
      const invalidTimeWorkflow = {
        workflow_id: "123",
        workflow_name: "测试工作流",
        app_id: "app_123",
        description: "测试",
        icon_url: "",
        creator: { id: "user_123", name: "测试用户" },
        created_at: 1699123456,
        updated_at: 1699123400, // 更新时间早于创建时间
      };

      mockContext.req.json = vi.fn().mockResolvedValue({
        workflow: invalidTimeWorkflow,
      });

      const _response = await mcpToolHandler.addCustomTool(mockContext);

      expect(mockContext.fail).toHaveBeenCalledWith(
        "VALIDATION_ERROR",
        expect.stringContaining("工作流的时间信息有误"),
        undefined,
        400
      );
    });
  });
});

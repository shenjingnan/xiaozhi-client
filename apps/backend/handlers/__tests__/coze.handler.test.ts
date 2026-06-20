/**
 * Coze API 处理器测试
 * 测试扣子（Coze）API 路由处理器的各种场景
 */

import type { WorkSpace } from "@/lib/coze";
import type { CozeWorkflowsData } from "@/types/coze";
import type { CustomMCPTool } from "@xiaozhi-client/config";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CozeHandler } from "../coze.handler.js";

// Mock Logger
vi.mock("../../Logger.js", () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
}));

// Mock @xiaozhi-client/config
vi.mock("@xiaozhi-client/config", () => ({
  configManager: {
    isCozeConfigValid: vi.fn(),
    getCozeToken: vi.fn(),
    getCustomMCPTools: vi.fn(),
  },
}));

// Mock @/lib/coze
vi.mock("@/lib/coze", () => ({
  CozeApiService: vi.fn(),
}));

describe("CozeHandler", () => {
  let cozeHandler: CozeHandler;
  let mockLogger: ReturnType<typeof vi.mocked<any>>;
  let mockContext: any;
  let mockConfigManager: any;
  let mockCozeApiService: any;

  // 模拟工作空间数据
  const mockWorkspaces: WorkSpace[] = [
    {
      id: "workspace-1",
      name: "测试工作空间",
      icon_url: "https://example.com/icon.png",
      role_type: "owner",
      workspace_type: "personal",
      enterprise_id: "enterprise-1",
    },
  ];

  // 模拟工作流数据
  const mockWorkflowsData: CozeWorkflowsData = {
    has_more: false,
    items: [
      {
        workflow_id: "workflow-1",
        workflow_name: "测试工作流",
        description: "这是一个测试工作流",
        icon_url: "https://example.com/workflow-icon.png",
        app_id: "app-1",
        creator: {
          id: "user-1",
          name: "测试用户",
        },
        created_at: 1234567890,
        updated_at: 1234567890,
      },
    ],
  };

  // 模拟自定义工具数据
  const mockCustomMCPTools: CustomMCPTool[] = [
    {
      name: "测试工具",
      description: "测试工具描述",
      inputSchema: {
        type: "object",
        properties: {},
      },
      handler: {
        type: "proxy",
        platform: "coze",
        config: {
          workflow_id: "workflow-1",
        },
      },
    },
  ];

  beforeEach(async () => {
    vi.clearAllMocks();

    // 设置 mock logger
    mockLogger = {
      debug: vi.fn(),
      info: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
    };
    const { logger } = await import("../../Logger.js");
    Object.assign(logger, mockLogger);

    // 设置 mock configManager
    mockConfigManager = {
      isCozeConfigValid: vi.fn().mockReturnValue(true),
      getCozeToken: vi.fn().mockReturnValue("test-token"),
      getCustomMCPTools: vi.fn().mockReturnValue(mockCustomMCPTools),
    };
    const { configManager } = await import("@xiaozhi-client/config");
    Object.assign(configManager, mockConfigManager);

    // 设置 mock CozeApiService
    mockCozeApiService = {
      getWorkspaces: vi.fn().mockResolvedValue(mockWorkspaces),
      getWorkflows: vi.fn().mockResolvedValue(mockWorkflowsData),
      clearCache: vi.fn(),
      getCacheStats: vi.fn().mockReturnValue({
        size: 10,
        keys: ["key1", "key2"],
        hits: 100,
        misses: 10,
        hitRate: 0.91,
        ksize: 1000,
        vsize: 5000,
      }),
    };
    const { CozeApiService } = await import("@/lib/coze");
    vi.mocked(CozeApiService).mockImplementation(() => mockCozeApiService);

    // 设置 mock Hono 上下文
    mockContext = {
      get: vi.fn((key: string) => {
        if (key === "logger") return mockLogger;
        return undefined;
      }),
      success: vi
        .fn()
        .mockImplementation((data: unknown, message?: string, status = 200) => {
          const response: {
            success: true;
            data?: unknown;
            message?: string;
          } = {
            success: true,
            message,
          };
          if (data !== undefined) {
            response.data = data;
          }
          return new Response(JSON.stringify(response), {
            status,
            headers: { "Content-Type": "application/json" },
          });
        }),
      fail: vi
        .fn()
        .mockImplementation(
          (code: string, message: string, details?: any, status = 400) => {
            return new Response(
              JSON.stringify({
                success: false,
                error: {
                  code,
                  message,
                  ...(details !== undefined && { details }),
                },
              }),
              {
                status,
                headers: { "Content-Type": "application/json" },
              }
            );
          }
        ),
      req: {
        query: vi.fn(),
        json: vi.fn(),
      },
    };

    cozeHandler = new CozeHandler();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("constructor", () => {
    it("应该正确初始化处理器", () => {
      expect(cozeHandler).toBeInstanceOf(CozeHandler);
    });
  });

  describe("getWorkspaces", () => {
    it("应该成功获取工作空间列表", async () => {
      const response = await cozeHandler.getWorkspaces(mockContext);
      const responseData = await response.json();

      expect(mockConfigManager.isCozeConfigValid).toHaveBeenCalled();
      expect(mockCozeApiService.getWorkspaces).toHaveBeenCalled();
      expect(mockContext.success).toHaveBeenCalledWith({
        workspaces: mockWorkspaces,
      });
      expect(mockLogger.info).toHaveBeenCalledWith(
        `成功获取 ${mockWorkspaces.length} 个工作空间`
      );
    });

    it("配置无效时应该返回 400 错误", async () => {
      mockConfigManager.isCozeConfigValid.mockReturnValue(false);

      const response = await cozeHandler.getWorkspaces(mockContext);
      const responseData = await response.json();

      expect(mockLogger.debug).toHaveBeenCalledWith("扣子配置无效");
      expect(mockContext.fail).toHaveBeenCalledWith(
        "CONFIG_INVALID",
        "扣子配置无效，请检查 platforms.coze.token 配置",
        undefined,
        400
      );
    });

    it("API 认证失败时应该返回 401 错误", async () => {
      const authError = new Error("Authentication failed");
      (authError as any).code = "AUTH_FAILED";
      mockCozeApiService.getWorkspaces.mockRejectedValue(authError);

      const response = await cozeHandler.getWorkspaces(mockContext);
      const responseData = await response.json();

      expect(mockContext.fail).toHaveBeenCalledWith(
        "AUTH_FAILED",
        "扣子 API 认证失败，请检查 Token 配置",
        undefined,
        401
      );
    });

    it("API 请求超时时应该返回 408 错误", async () => {
      const timeoutError = new Error("Request timeout");
      (timeoutError as any).code = "TIMEOUT";
      mockCozeApiService.getWorkspaces.mockRejectedValue(timeoutError);

      const response = await cozeHandler.getWorkspaces(mockContext);
      const responseData = await response.json();

      expect(mockContext.fail).toHaveBeenCalledWith(
        "TIMEOUT",
        "请求超时，请稍后重试",
        undefined,
        408
      );
    });

    it("请求频率限制时应该返回 429 错误", async () => {
      const rateLimitError = new Error("Rate limit exceeded");
      (rateLimitError as any).code = "RATE_LIMITED";
      mockCozeApiService.getWorkspaces.mockRejectedValue(rateLimitError);

      const response = await cozeHandler.getWorkspaces(mockContext);
      const responseData = await response.json();

      expect(mockContext.fail).toHaveBeenCalledWith(
        "RATE_LIMITED",
        "请求过于频繁，请稍后重试",
        undefined,
        429
      );
    });

    it("其他 API 错误应该返回 500 错误", async () => {
      const apiError = new Error("Internal server error");
      mockCozeApiService.getWorkspaces.mockRejectedValue(apiError);

      const response = await cozeHandler.getWorkspaces(mockContext);
      const responseData = await response.json();

      expect(mockContext.fail).toHaveBeenCalledWith(
        "INTERNAL_ERROR",
        "Internal server error",
        undefined,
        500
      );
    });
  });

  describe("getWorkflows", () => {
    beforeEach(() => {
      // 设置默认的 query 参数 mock
      mockContext.req.query = vi.fn((param: string) => {
        const queryParams: Record<string, string> = {
          workspace_id: "workspace-1",
          page_num: "1",
          page_size: "20",
        };
        return queryParams[param] || "";
      });
    });

    it("应该成功获取工作流列表", async () => {
      await cozeHandler.getWorkflows(mockContext);

      expect(mockConfigManager.isCozeConfigValid).toHaveBeenCalled();
      expect(mockCozeApiService.getWorkflows).toHaveBeenCalledWith({
        workspace_id: "workspace-1",
        page_num: 1,
        page_size: 20,
      });
      expect(mockContext.success).toHaveBeenCalled();
    });

    it("缺少 workspace_id 参数时应该返回 400 错误", async () => {
      mockContext.req.query = vi.fn((param: string) => {
        if (param === "workspace_id") return "";
        if (param === "page_num") return "1";
        if (param === "page_size") return "20";
        return "";
      });

      await cozeHandler.getWorkflows(mockContext);

      expect(mockLogger.warn).toHaveBeenCalledWith("缺少 workspace_id 参数");
      expect(mockContext.fail).toHaveBeenCalledWith(
        "MISSING_PARAMETER",
        "缺少必需参数: workspace_id",
        undefined,
        400
      );
    });

    it("page_num 小于 1 时应该返回 400 错误", async () => {
      mockContext.req.query = vi.fn((param: string) => {
        if (param === "workspace_id") return "workspace-1";
        if (param === "page_num") return "0";
        if (param === "page_size") return "20";
        return "";
      });

      await cozeHandler.getWorkflows(mockContext);

      expect(mockContext.fail).toHaveBeenCalledWith(
        "INVALID_PARAMETER",
        "page_num 必须在 1-1000 之间",
        undefined,
        400
      );
    });

    it("page_num 大于 1000 时应该返回 400 错误", async () => {
      mockContext.req.query = vi.fn((param: string) => {
        if (param === "workspace_id") return "workspace-1";
        if (param === "page_num") return "1001";
        if (param === "page_size") return "20";
        return "";
      });

      await cozeHandler.getWorkflows(mockContext);

      expect(mockContext.fail).toHaveBeenCalledWith(
        "INVALID_PARAMETER",
        "page_num 必须在 1-1000 之间",
        undefined,
        400
      );
    });

    it("page_size 小于 1 时应该返回 400 错误", async () => {
      mockContext.req.query = vi.fn((param: string) => {
        if (param === "workspace_id") return "workspace-1";
        if (param === "page_num") return "1";
        if (param === "page_size") return "0";
        return "";
      });

      await cozeHandler.getWorkflows(mockContext);

      expect(mockContext.fail).toHaveBeenCalledWith(
        "INVALID_PARAMETER",
        "page_size 必须在 1-100 之间",
        undefined,
        400
      );
    });

    it("page_size 大于 100 时应该返回 400 错误", async () => {
      mockContext.req.query = vi.fn((param: string) => {
        if (param === "workspace_id") return "workspace-1";
        if (param === "page_num") return "1";
        if (param === "page_size") return "101";
        return "";
      });

      await cozeHandler.getWorkflows(mockContext);

      expect(mockContext.fail).toHaveBeenCalledWith(
        "INVALID_PARAMETER",
        "page_size 必须在 1-100 之间",
        undefined,
        400
      );
    });

    it("应该正确增强工作流工具状态信息", async () => {
      await cozeHandler.getWorkflows(mockContext);

      expect(mockConfigManager.getCustomMCPTools).toHaveBeenCalled();
      expect(mockContext.success).toHaveBeenCalled();

      // 验证调用时包含了增强的工作流数据
      const successCall = mockContext.success.mock.calls[0];
      const data = successCall[0];
      expect(data.items[0].isAddedAsTool).toBe(true);
      expect(data.items[0].toolName).toBe("测试工具");
    });

    it("配置无效时应该返回 400 错误", async () => {
      mockConfigManager.isCozeConfigValid.mockReturnValue(false);

      await cozeHandler.getWorkflows(mockContext);

      expect(mockLogger.debug).toHaveBeenCalledWith("扣子配置无效");
      expect(mockContext.fail).toHaveBeenCalledWith(
        "CONFIG_INVALID",
        "扣子配置无效，请检查 platforms.coze.token 配置",
        undefined,
        400
      );
    });

    it("应该正确处理空的自定义工具列表", async () => {
      mockConfigManager.getCustomMCPTools.mockReturnValue([]);

      await cozeHandler.getWorkflows(mockContext);

      expect(mockContext.success).toHaveBeenCalled();
      const successCall = mockContext.success.mock.calls[0];
      const data = successCall[0];
      expect(data.items[0].isAddedAsTool).toBe(false);
      expect(data.items[0].toolName).toBeNull();
    });
  });

  describe("clearCache", () => {
    beforeEach(() => {
      // 模拟 query 函数返回 undefined（当参数不存在时）
      mockContext.req.query = vi.fn(() => undefined);
    });

    it("应该成功清除所有缓存", async () => {
      const statsBefore = { size: 10, keys: ["key1", "key2"] };
      const statsAfter = { size: 0, keys: [] };

      mockCozeApiService.getCacheStats
        .mockReturnValueOnce(statsBefore)
        .mockReturnValueOnce(statsAfter);

      await cozeHandler.clearCache(mockContext);

      expect(mockCozeApiService.clearCache).toHaveBeenCalledWith(undefined);
      expect(mockContext.success).toHaveBeenCalledWith(
        {
          cleared: 10,
          remaining: 0,
          pattern: "all",
        },
        "缓存清除成功"
      );
    });

    it("应该使用模式清除部分缓存", async () => {
      mockContext.req.query = vi.fn((pattern: string) => {
        if (pattern === "pattern") return "workflows:";
        return "";
      });

      const statsBefore = { size: 10, keys: ["workflows:key1", "key2"] };
      const statsAfter = { size: 1, keys: ["key2"] };

      mockCozeApiService.getCacheStats
        .mockReturnValueOnce(statsBefore)
        .mockReturnValueOnce(statsAfter);

      await cozeHandler.clearCache(mockContext);

      expect(mockCozeApiService.clearCache).toHaveBeenCalledWith("workflows:");
      expect(mockContext.success).toHaveBeenCalledWith(
        {
          cleared: 9,
          remaining: 1,
          pattern: "workflows:",
        },
        "缓存清除成功"
      );
    });

    it("配置无效时应该返回 400 错误", async () => {
      mockConfigManager.isCozeConfigValid.mockReturnValue(false);

      await cozeHandler.clearCache(mockContext);

      expect(mockLogger.debug).toHaveBeenCalledWith("扣子配置无效");
      expect(mockContext.fail).toHaveBeenCalledWith(
        "CONFIG_INVALID",
        "扣子配置无效，请检查 platforms.coze.token 配置",
        undefined,
        400
      );
    });

    it("应该正确计算缓存统计信息", async () => {
      const statsBefore = {
        size: 5,
        keys: ["key1", "key2", "key3", "key4", "key5"],
      };
      const statsAfter = { size: 3, keys: ["key1", "key2", "key3"] };

      mockCozeApiService.getCacheStats
        .mockReturnValueOnce(statsBefore)
        .mockReturnValueOnce(statsAfter);

      await cozeHandler.clearCache(mockContext);

      expect(mockContext.success).toHaveBeenCalledWith(
        {
          cleared: 2,
          remaining: 3,
          pattern: "all",
        },
        "缓存清除成功"
      );
    });
  });

  describe("getCacheStats", () => {
    it("应该成功获取缓存统计信息", async () => {
      const mockStats = {
        size: 10,
        keys: ["key1", "key2", "key3"],
        hits: 100,
        misses: 10,
        hitRate: 0.91,
        ksize: 1000,
        vsize: 5000,
      };

      mockCozeApiService.getCacheStats.mockReturnValue(mockStats);

      await cozeHandler.getCacheStats(mockContext);

      expect(mockCozeApiService.getCacheStats).toHaveBeenCalled();
      expect(mockContext.success).toHaveBeenCalledWith(mockStats);
    });

    it("配置无效时应该返回 400 错误", async () => {
      mockConfigManager.isCozeConfigValid.mockReturnValue(false);

      await cozeHandler.getCacheStats(mockContext);

      expect(mockLogger.debug).toHaveBeenCalledWith("扣子配置无效");
      expect(mockContext.fail).toHaveBeenCalledWith(
        "CONFIG_INVALID",
        "扣子配置无效，请检查 platforms.coze.token 配置",
        undefined,
        400
      );
    });

    it("应该处理获取缓存统计时的错误", async () => {
      const error = new Error("获取缓存统计失败");
      mockCozeApiService.getCacheStats.mockImplementation(() => {
        throw error;
      });

      await cozeHandler.getCacheStats(mockContext);

      expect(mockLogger.error).toHaveBeenCalledWith(
        "获取缓存统计信息失败:",
        error
      );
      expect(mockContext.fail).toHaveBeenCalledWith(
        "INTERNAL_ERROR",
        "获取缓存统计失败",
        undefined,
        500
      );
    });
  });

  describe("handleCozeApiError (私有方法错误处理)", () => {
    it("AUTH_FAILED 错误应该返回 401 状态码", async () => {
      const authError = new Error("Authentication failed");
      (authError as any).code = "AUTH_FAILED";
      mockCozeApiService.getWorkspaces.mockRejectedValue(authError);

      await cozeHandler.getWorkspaces(mockContext);

      expect(mockContext.fail).toHaveBeenCalledWith(
        "AUTH_FAILED",
        "扣子 API 认证失败，请检查 Token 配置",
        undefined,
        401
      );
    });

    it("RATE_LIMITED 错误应该返回 429 状态码", async () => {
      const rateLimitError = new Error("Rate limit exceeded");
      (rateLimitError as any).code = "RATE_LIMITED";
      mockCozeApiService.getWorkspaces.mockRejectedValue(rateLimitError);

      await cozeHandler.getWorkspaces(mockContext);

      expect(mockContext.fail).toHaveBeenCalledWith(
        "RATE_LIMITED",
        "请求过于频繁，请稍后重试",
        undefined,
        429
      );
    });

    it("TIMEOUT 错误应该返回 408 状态码", async () => {
      const timeoutError = new Error("Request timeout");
      (timeoutError as any).code = "TIMEOUT";
      mockCozeApiService.getWorkspaces.mockRejectedValue(timeoutError);

      await cozeHandler.getWorkspaces(mockContext);

      expect(mockContext.fail).toHaveBeenCalledWith(
        "TIMEOUT",
        "请求超时，请稍后重试",
        undefined,
        408
      );
    });

    it("API_ERROR 错误应该返回 500 状态码", async () => {
      const apiError = new Error("API error");
      (apiError as any).code = "API_ERROR";
      mockCozeApiService.getWorkspaces.mockRejectedValue(apiError);

      await cozeHandler.getWorkspaces(mockContext);

      expect(mockContext.fail).toHaveBeenCalledWith(
        "INTERNAL_ERROR",
        "API error",
        undefined,
        500
      );
    });

    it("NETWORK_ERROR 错误应该返回 500 状态码", async () => {
      const networkError = new Error("Network error");
      (networkError as any).code = "NETWORK_ERROR";
      mockCozeApiService.getWorkspaces.mockRejectedValue(networkError);

      await cozeHandler.getWorkspaces(mockContext);

      expect(mockContext.fail).toHaveBeenCalledWith(
        "INTERNAL_ERROR",
        "Network error",
        undefined,
        500
      );
    });

    it("通用错误应该返回 500 状态码", async () => {
      const genericError = new Error("Something went wrong");
      mockCozeApiService.getWorkspaces.mockRejectedValue(genericError);

      await cozeHandler.getWorkspaces(mockContext);

      expect(mockContext.fail).toHaveBeenCalledWith(
        "INTERNAL_ERROR",
        "Something went wrong",
        undefined,
        500
      );
    });

    it("非 Error 类型的错误应该正确处理", async () => {
      mockCozeApiService.getWorkspaces.mockRejectedValue("String error");

      await cozeHandler.getWorkspaces(mockContext);

      expect(mockContext.fail).toHaveBeenCalledWith(
        "INTERNAL_ERROR",
        "获取工作空间列表失败",
        undefined,
        500
      );
    });

    it("开发环境下应该返回错误堆栈", async () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = "development";

      const error = new Error("Test error");
      error.stack = "Error: Test error\n    at test.js:1:1";
      mockCozeApiService.getWorkspaces.mockRejectedValue(error);

      await cozeHandler.getWorkspaces(mockContext);

      expect(mockContext.fail).toHaveBeenCalledWith(
        "INTERNAL_ERROR",
        "Test error",
        "Error: Test error\n    at test.js:1:1",
        500
      );

      process.env.NODE_ENV = originalEnv;
    });
  });
});

/**
 * 扣子 API HTTP 路由处理器测试
 */

import type { CozeWorkflow, CozeWorkspace } from "@/types/coze";
import type { CustomMCPTool } from "@xiaozhi-client/config";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CozeHandler } from "../coze.handler.js";

// 模拟 CozeApiService
vi.mock("@/lib/coze", () => ({
  CozeApiService: vi.fn(),
}));

// 模拟 configManager
vi.mock("@xiaozhi-client/config", () => ({
  configManager: {
    isCozeConfigValid: vi.fn(),
    getCozeToken: vi.fn(),
    getCustomMCPTools: vi.fn(),
  },
}));

describe("CozeHandler", () => {
  let handler: CozeHandler;
  let mockLogger: ReturnType<typeof createMockLogger>;
  let mockContext: ReturnType<typeof createMockContext>;
  let mockCozeApiService: ReturnType<typeof createMockCozeApiService>;

  // 创建模拟日志器
  function createMockLogger() {
    return {
      debug: vi.fn(),
      info: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
    };
  }

  // 创建模拟上下文
  function createMockContext(logger: ReturnType<typeof createMockLogger>) {
    return {
      get: vi.fn((key: string) => {
        if (key === "logger") return logger;
        return undefined;
      }),
      success: vi
        .fn()
        .mockImplementation((data: unknown, message?: string, status = 200) => {
          const response: { success: true; data?: unknown; message?: string } =
            {
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
          (code: string, message: string, details?: unknown, status = 400) => {
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
  }

  // 创建模拟 CozeApiService
  function createMockCozeApiService() {
    return {
      getWorkspaces: vi.fn(),
      getWorkflows: vi.fn(),
      clearCache: vi.fn(),
      getCacheStats: vi.fn(),
    };
  }

  beforeEach(async () => {
    vi.clearAllMocks();

    // 初始化模拟对象
    mockLogger = createMockLogger();
    mockContext = createMockContext(mockLogger);
    mockCozeApiService = createMockCozeApiService();

    // 模拟 CozeApiService 构造函数
    const { CozeApiService } = await import("@/lib/coze");
    vi.mocked(CozeApiService).mockImplementation(
      () => mockCozeApiService as unknown as ReturnType<typeof CozeApiService>
    );

    // 模拟 configManager
    const { configManager } = await import("@xiaozhi-client/config");
    vi.mocked(configManager.isCozeConfigValid).mockReturnValue(true);
    vi.mocked(configManager.getCozeToken).mockReturnValue("test-token");
    vi.mocked(configManager.getCustomMCPTools).mockReturnValue([]);

    handler = new CozeHandler();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("getWorkspaces", () => {
    const mockWorkspaces: CozeWorkspace[] = [
      {
        id: "workspace-1",
        name: "测试工作空间",
        description: "用于测试的工作空间",
        workspace_type: "personal",
        enterprise_id: "enterprise-1",
        admin_uids: ["user-1"],
        icon_url: "https://example.com/icon1.png",
        role_type: "owner",
        joined_status: "joined",
        owner_uid: "user-1",
      },
      {
        id: "workspace-2",
        name: "团队工作空间",
        description: "团队协作工作空间",
        workspace_type: "team",
        enterprise_id: "enterprise-1",
        admin_uids: ["user-1", "user-2"],
        icon_url: "https://example.com/icon2.png",
        role_type: "admin",
        joined_status: "joined",
        owner_uid: "user-1",
      },
    ];

    it("应该成功获取工作空间列表", async () => {
      mockCozeApiService.getWorkspaces.mockResolvedValue(mockWorkspaces);

      const response = await handler.getWorkspaces(mockContext);
      const result = await response.json();

      expect(mockLogger.info).toHaveBeenCalledWith("处理获取工作空间列表请求");
      expect(mockCozeApiService.getWorkspaces).toHaveBeenCalledTimes(1);
      expect(result.success).toBe(true);
      expect(result.data).toEqual({ workspaces: mockWorkspaces });
    });

    it("应该处理扣子配置无效的情况", async () => {
      const { configManager } = await import("@xiaozhi-client/config");
      vi.mocked(configManager.isCozeConfigValid).mockReturnValue(false);

      const response = await handler.getWorkspaces(mockContext);
      const result = await response.json();

      expect(mockLogger.debug).toHaveBeenCalledWith("扣子配置无效");
      expect(mockContext.fail).toHaveBeenCalledWith(
        "CONFIG_INVALID",
        "扣子配置无效，请检查 platforms.coze.token 配置",
        undefined,
        400
      );
      expect(result.success).toBe(false);
    });

    it("应该处理认证失败错误", async () => {
      const authError = new Error("认证失败");
      (authError as { code: string }).code = "AUTH_FAILED";
      mockCozeApiService.getWorkspaces.mockRejectedValue(authError);

      const response = await handler.getWorkspaces(mockContext);
      const result = await response.json();

      expect(mockLogger.error).toHaveBeenCalledWith(
        "获取工作空间列表失败:",
        authError
      );
      expect(mockContext.fail).toHaveBeenCalledWith(
        "AUTH_FAILED",
        "扣子 API 认证失败，请检查 Token 配置",
        undefined,
        401
      );
      expect(result.success).toBe(false);
    });

    it("应该处理速率限制错误", async () => {
      const rateLimitError = new Error("请求过于频繁");
      (rateLimitError as { code: string }).code = "RATE_LIMITED";
      mockCozeApiService.getWorkspaces.mockRejectedValue(rateLimitError);

      const response = await handler.getWorkspaces(mockContext);
      const result = await response.json();

      expect(mockContext.fail).toHaveBeenCalledWith(
        "RATE_LIMITED",
        "请求过于频繁，请稍后重试",
        undefined,
        429
      );
      expect(result.success).toBe(false);
    });

    it("应该处理超时错误", async () => {
      const timeoutError = new Error("请求超时");
      (timeoutError as { code: string }).code = "TIMEOUT";
      mockCozeApiService.getWorkspaces.mockRejectedValue(timeoutError);

      const response = await handler.getWorkspaces(mockContext);
      const result = await response.json();

      expect(mockContext.fail).toHaveBeenCalledWith(
        "TIMEOUT",
        "请求超时，请稍后重试",
        undefined,
        408
      );
      expect(result.success).toBe(false);
    });

    it("应该处理通用错误", async () => {
      const genericError = new Error("网络错误");
      mockCozeApiService.getWorkspaces.mockRejectedValue(genericError);

      const response = await handler.getWorkspaces(mockContext);
      const result = await response.json();

      expect(mockContext.fail).toHaveBeenCalledWith(
        "INTERNAL_ERROR",
        "网络错误",
        undefined,
        500
      );
      expect(result.success).toBe(false);
    });

    it("应该处理非 Error 类型的异常", async () => {
      mockCozeApiService.getWorkspaces.mockRejectedValue("字符串错误");

      const response = await handler.getWorkspaces(mockContext);
      const result = await response.json();

      expect(mockContext.fail).toHaveBeenCalledWith(
        "INTERNAL_ERROR",
        "获取工作空间列表失败",
        undefined,
        500
      );
      expect(result.success).toBe(false);
    });

    it("应该处理 Token 未配置的情况", async () => {
      const { configManager } = await import("@xiaozhi-client/config");
      vi.mocked(configManager.getCozeToken).mockReturnValue(null);

      const response = await handler.getWorkspaces(mockContext);
      const result = await response.json();

      expect(mockContext.fail).toHaveBeenCalledWith(
        "INTERNAL_ERROR",
        "扣子 API Token 未配置，请在配置文件中设置 platforms.coze.token",
        undefined,
        500
      );
      expect(result.success).toBe(false);
    });
  });

  describe("getWorkflows", () => {
    const mockWorkflows: CozeWorkflow[] = [
      {
        workflow_id: "workflow-1",
        workflow_name: "测试工作流",
        description: "用于测试的工作流",
        icon_url: "https://example.com/icon1.png",
        app_id: "app-1",
        creator: {
          id: "user-1",
          name: "测试用户",
        },
        created_at: 1704067200000,
        updated_at: 1704153600000,
      },
      {
        workflow_id: "workflow-2",
        workflow_name: "数据处理工作流",
        description: "处理数据的自动化流程",
        icon_url: "https://example.com/icon2.png",
        app_id: "app-1",
        creator: {
          id: "user-2",
          name: "开发者",
        },
        created_at: 1704240000000,
        updated_at: 1704326400000,
      },
    ];

    const mockWorkflowsResponse = {
      items: mockWorkflows,
      has_more: false,
    };

    it("应该成功获取工作流列表", async () => {
      mockContext.req.query.mockImplementation((key: string) => {
        if (key === "workspace_id") return "workspace-1";
        if (key === "page_num") return "1";
        if (key === "page_size") return "20";
        return undefined;
      });
      mockCozeApiService.getWorkflows.mockResolvedValue(mockWorkflowsResponse);

      const response = await handler.getWorkflows(mockContext);
      const result = await response.json();

      expect(mockLogger.info).toHaveBeenCalledWith("处理获取工作流列表请求");
      expect(mockCozeApiService.getWorkflows).toHaveBeenCalledWith({
        workspace_id: "workspace-1",
        page_num: 1,
        page_size: 20,
      });
      expect(result.success).toBe(true);
      expect(result.data.items).toHaveLength(2);
      expect(result.data.has_more).toBe(false);
    });

    it("应该为工作流添加工具状态信息", async () => {
      const customTools: CustomMCPTool[] = [
        {
          name: "test-tool",
          description: "测试工具",
          inputSchema: { type: "object" },
          handler: {
            type: "proxy",
            platform: "coze",
            config: {
              workflow_id: "workflow-1",
            },
          },
        },
      ];
      const { configManager } = await import("@xiaozhi-client/config");
      vi.mocked(configManager.getCustomMCPTools).mockReturnValue(customTools);

      mockContext.req.query.mockImplementation((key: string) => {
        if (key === "workspace_id") return "workspace-1";
        return undefined;
      });
      mockCozeApiService.getWorkflows.mockResolvedValue(mockWorkflowsResponse);

      const response = await handler.getWorkflows(mockContext);
      const result = await response.json();

      expect(result.success).toBe(true);
      expect(result.data.items[0].isAddedAsTool).toBe(true);
      expect(result.data.items[0].toolName).toBe("test-tool");
      expect(result.data.items[1].isAddedAsTool).toBe(false);
      expect(result.data.items[1].toolName).toBe(null);
    });

    it("应该处理缺少 workspace_id 参数", async () => {
      mockContext.req.query.mockImplementation((key: string) => {
        if (key === "workspace_id") return undefined;
        return undefined;
      });

      const response = await handler.getWorkflows(mockContext);
      const result = await response.json();

      expect(mockLogger.warn).toHaveBeenCalledWith("缺少 workspace_id 参数");
      expect(mockContext.fail).toHaveBeenCalledWith(
        "MISSING_PARAMETER",
        "缺少必需参数: workspace_id",
        undefined,
        400
      );
      expect(result.success).toBe(false);
    });

    it("应该处理 page_num 参数范围无效（小于1）", async () => {
      mockContext.req.query.mockImplementation((key: string) => {
        if (key === "workspace_id") return "workspace-1";
        if (key === "page_num") return "0";
        return undefined;
      });

      const response = await handler.getWorkflows(mockContext);
      const result = await response.json();

      expect(mockContext.fail).toHaveBeenCalledWith(
        "INVALID_PARAMETER",
        "page_num 必须在 1-1000 之间",
        undefined,
        400
      );
      expect(result.success).toBe(false);
    });

    it("应该处理 page_num 参数范围无效（大于1000）", async () => {
      mockContext.req.query.mockImplementation((key: string) => {
        if (key === "workspace_id") return "workspace-1";
        if (key === "page_num") return "1001";
        return undefined;
      });

      const response = await handler.getWorkflows(mockContext);
      const result = await response.json();

      expect(mockContext.fail).toHaveBeenCalledWith(
        "INVALID_PARAMETER",
        "page_num 必须在 1-1000 之间",
        undefined,
        400
      );
      expect(result.success).toBe(false);
    });

    it("应该处理 page_size 参数范围无效（小于1）", async () => {
      mockContext.req.query.mockImplementation((key: string) => {
        if (key === "workspace_id") return "workspace-1";
        if (key === "page_size") return "0";
        return undefined;
      });

      const response = await handler.getWorkflows(mockContext);
      const result = await response.json();

      expect(mockContext.fail).toHaveBeenCalledWith(
        "INVALID_PARAMETER",
        "page_size 必须在 1-100 之间",
        undefined,
        400
      );
      expect(result.success).toBe(false);
    });

    it("应该处理 page_size 参数范围无效（大于100）", async () => {
      mockContext.req.query.mockImplementation((key: string) => {
        if (key === "workspace_id") return "workspace-1";
        if (key === "page_size") return "101";
        return undefined;
      });

      const response = await handler.getWorkflows(mockContext);
      const result = await response.json();

      expect(mockContext.fail).toHaveBeenCalledWith(
        "INVALID_PARAMETER",
        "page_size 必须在 1-100 之间",
        undefined,
        400
      );
      expect(result.success).toBe(false);
    });

    it("应该使用默认分页参数", async () => {
      mockContext.req.query.mockImplementation((key: string) => {
        if (key === "workspace_id") return "workspace-1";
        return undefined;
      });
      mockCozeApiService.getWorkflows.mockResolvedValue(mockWorkflowsResponse);

      const response = await handler.getWorkflows(mockContext);
      const result = await response.json();

      expect(mockCozeApiService.getWorkflows).toHaveBeenCalledWith({
        workspace_id: "workspace-1",
        page_num: 1,
        page_size: 20,
      });
      expect(result.success).toBe(true);
    });

    it("应该处理扣子配置无效的情况", async () => {
      const { configManager } = await import("@xiaozhi-client/config");
      vi.mocked(configManager.isCozeConfigValid).mockReturnValue(false);

      const response = await handler.getWorkflows(mockContext);
      const result = await response.json();

      expect(mockContext.fail).toHaveBeenCalledWith(
        "CONFIG_INVALID",
        "扣子配置无效，请检查 platforms.coze.token 配置",
        undefined,
        400
      );
      expect(result.success).toBe(false);
    });

    it("应该处理 API 错误", async () => {
      mockContext.req.query.mockImplementation((key: string) => {
        if (key === "workspace_id") return "workspace-1";
        return undefined;
      });
      const apiError = new Error("API 错误");
      mockCozeApiService.getWorkflows.mockRejectedValue(apiError);

      const response = await handler.getWorkflows(mockContext);
      const result = await response.json();

      expect(mockContext.fail).toHaveBeenCalledWith(
        "INTERNAL_ERROR",
        "API 错误",
        undefined,
        500
      );
      expect(result.success).toBe(false);
    });
  });

  describe("clearCache", () => {
    it("应该成功清除所有缓存", async () => {
      mockCozeApiService.getCacheStats
        .mockReturnValueOnce({
          size: 5,
          keys: ["key1", "key2", "key3", "key4", "key5"],
          hits: 10,
          misses: 2,
          hitRate: 0.833,
          ksize: 100,
          vsize: 200,
        })
        .mockReturnValueOnce({
          size: 0,
          keys: [],
          hits: 10,
          misses: 2,
          hitRate: 0.833,
          ksize: 0,
          vsize: 0,
        });

      const response = await handler.clearCache(mockContext);
      const result = await response.json();

      expect(mockLogger.info).toHaveBeenCalledWith("处理清除扣子 API 缓存请求");
      expect(mockCozeApiService.clearCache).toHaveBeenCalledWith(undefined);
      expect(result.success).toBe(true);
      expect(result.data.cleared).toBe(5);
      expect(result.data.remaining).toBe(0);
      expect(result.data.pattern).toBe("all");
    });

    it("应该按模式清除缓存", async () => {
      mockContext.req.query.mockImplementation((key: string) => {
        if (key === "pattern") return "workflows:";
        return undefined;
      });
      mockCozeApiService.getCacheStats
        .mockReturnValueOnce({
          size: 10,
          keys: ["workflows:1", "workspaces", "other"],
          hits: 10,
          misses: 2,
          hitRate: 0.833,
          ksize: 100,
          vsize: 200,
        })
        .mockReturnValueOnce({
          size: 2,
          keys: ["workspaces", "other"],
          hits: 10,
          misses: 2,
          hitRate: 0.833,
          ksize: 50,
          vsize: 100,
        });

      const response = await handler.clearCache(mockContext);
      const result = await response.json();

      expect(mockCozeApiService.clearCache).toHaveBeenCalledWith("workflows:");
      expect(result.success).toBe(true);
      expect(result.data.pattern).toBe("workflows:");
    });

    it("应该处理扣子配置无效的情况", async () => {
      const { configManager } = await import("@xiaozhi-client/config");
      vi.mocked(configManager.isCozeConfigValid).mockReturnValue(false);

      const response = await handler.clearCache(mockContext);
      const result = await response.json();

      expect(mockContext.fail).toHaveBeenCalledWith(
        "CONFIG_INVALID",
        "扣子配置无效，请检查 platforms.coze.token 配置",
        undefined,
        400
      );
      expect(result.success).toBe(false);
    });

    it("应该处理清除缓存错误", async () => {
      const cacheError = new Error("缓存清除失败");
      mockCozeApiService.getCacheStats.mockImplementation(() => {
        throw cacheError;
      });

      const response = await handler.clearCache(mockContext);
      const result = await response.json();

      expect(mockLogger.error).toHaveBeenCalledWith("清除缓存失败:", cacheError);
      expect(mockContext.fail).toHaveBeenCalledWith(
        "INTERNAL_ERROR",
        "缓存清除失败",
        undefined,
        500
      );
      expect(result.success).toBe(false);
    });

    it("应该处理非 Error 类型的异常", async () => {
      mockCozeApiService.getCacheStats.mockImplementation(() => {
        throw "字符串错误";
      });

      const response = await handler.clearCache(mockContext);
      const result = await response.json();

      expect(mockContext.fail).toHaveBeenCalledWith(
        "INTERNAL_ERROR",
        "清除缓存失败",
        undefined,
        500
      );
      expect(result.success).toBe(false);
    });
  });

  describe("getCacheStats", () => {
    it("应该成功获取缓存统计信息", async () => {
      const mockStats = {
        size: 5,
        keys: ["key1", "key2", "key3", "key4", "key5"],
        hits: 10,
        misses: 2,
        hitRate: 0.833,
        ksize: 100,
        vsize: 200,
      };
      mockCozeApiService.getCacheStats.mockReturnValue(mockStats);

      const response = await handler.getCacheStats(mockContext);
      const result = await response.json();

      expect(mockLogger.info).toHaveBeenCalledWith(
        "处理获取缓存统计信息请求"
      );
      expect(mockCozeApiService.getCacheStats).toHaveBeenCalledTimes(1);
      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockStats);
    });

    it("应该处理扣子配置无效的情况", async () => {
      const { configManager } = await import("@xiaozhi-client/config");
      vi.mocked(configManager.isCozeConfigValid).mockReturnValue(false);

      const response = await handler.getCacheStats(mockContext);
      const result = await response.json();

      expect(mockContext.fail).toHaveBeenCalledWith(
        "CONFIG_INVALID",
        "扣子配置无效，请检查 platforms.coze.token 配置",
        undefined,
        400
      );
      expect(result.success).toBe(false);
    });

    it("应该处理获取统计信息错误", async () => {
      const statsError = new Error("获取统计失败");
      mockCozeApiService.getCacheStats.mockImplementation(() => {
        throw statsError;
      });

      const response = await handler.getCacheStats(mockContext);
      const result = await response.json();

      expect(mockLogger.error).toHaveBeenCalledWith(
        "获取缓存统计信息失败:",
        statsError
      );
      expect(mockContext.fail).toHaveBeenCalledWith(
        "INTERNAL_ERROR",
        "获取统计失败",
        undefined,
        500
      );
      expect(result.success).toBe(false);
    });

    it("应该处理非 Error 类型的异常", async () => {
      mockCozeApiService.getCacheStats.mockImplementation(() => {
        throw "字符串错误";
      });

      const response = await handler.getCacheStats(mockContext);
      const result = await response.json();

      expect(mockContext.fail).toHaveBeenCalledWith(
        "INTERNAL_ERROR",
        "获取缓存统计信息失败",
        undefined,
        500
      );
      expect(result.success).toBe(false);
    });
  });
});
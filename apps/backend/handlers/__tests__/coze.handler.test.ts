/**
 * 扣子 API HTTP 路由处理器测试
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CozeHandler } from "../coze.handler.js";

// 模拟依赖项
vi.mock("../../Logger.js", () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
}));

vi.mock("@xiaozhi-client/config", () => ({
  configManager: {
    isCozeConfigValid: vi.fn(),
    getCozeToken: vi.fn(),
    getCustomMCPTools: vi.fn().mockReturnValue([]),
  },
}));

vi.mock("@/lib/coze", () => ({
  CozeApiService: vi.fn(),
}));

describe("CozeHandler", () => {
  let cozeHandler: CozeHandler;
  let mockConfigManager: any;
  let mockLogger: any;
  let mockContext: any;
  let mockCozeApiService: any;

  /**
   * 创建模拟的 Hono 上下文
   */
  function createMockContext() {
    return {
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
      json: vi.fn().mockReturnValue(new Response()),
      req: {
        json: vi.fn(),
        query: vi.fn().mockReturnValue(undefined),
      },
      logger: mockLogger,
    };
  }

  beforeEach(async () => {
    vi.clearAllMocks();

    // 模拟 Logger
    mockLogger = {
      debug: vi.fn(),
      info: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
    };
    const { logger } = await import("../../Logger.js");
    Object.assign(logger, mockLogger);

    // 模拟 ConfigManager
    mockConfigManager = {
      isCozeConfigValid: vi.fn(),
      getCozeToken: vi.fn(),
      getCustomMCPTools: vi.fn().mockReturnValue([]),
    };
    const { configManager } = await import("@xiaozhi-client/config");
    Object.assign(configManager, mockConfigManager);

    // 模拟 CozeApiService
    mockCozeApiService = {
      getWorkspaces: vi.fn(),
      getWorkflows: vi.fn(),
      clearCache: vi.fn(),
      getCacheStats: vi.fn().mockReturnValue({
        size: 0,
        keys: [],
        hits: 0,
        misses: 0,
        hitRate: 0,
        ksize: 0,
        vsize: 0,
      }),
    };

    const { CozeApiService } = await import("@/lib/coze");
    vi.mocked(CozeApiService).mockImplementation(
      () => mockCozeApiService as unknown as InstanceType<typeof CozeApiService>
    );

    mockContext = createMockContext();
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
    it("配置无效时应该返回错误响应", async () => {
      mockConfigManager.isCozeConfigValid.mockReturnValue(false);

      await cozeHandler.getWorkspaces(mockContext);

      expect(mockLogger.info).toHaveBeenCalledWith("处理获取工作空间列表请求");
      expect(mockLogger.debug).toHaveBeenCalledWith("扣子配置无效");
      expect(mockContext.fail).toHaveBeenCalledWith(
        "CONFIG_INVALID",
        "扣子配置无效，请检查 platforms.coze.token 配置",
        undefined,
        400
      );
    });

    it("应该成功获取工作空间列表", async () => {
      mockConfigManager.isCozeConfigValid.mockReturnValue(true);
      mockConfigManager.getCozeToken.mockReturnValue("test-token");
      const mockWorkspaces = [
        { id: "ws-1", name: "工作空间1" },
        { id: "ws-2", name: "工作空间2" },
      ];
      mockCozeApiService.getWorkspaces.mockResolvedValue(mockWorkspaces);

      await cozeHandler.getWorkspaces(mockContext);

      expect(mockConfigManager.getCozeToken).toHaveBeenCalled();
      expect(mockCozeApiService.getWorkspaces).toHaveBeenCalled();
      expect(mockLogger.info).toHaveBeenCalledWith(
        "调用 Coze API 获取工作空间列表"
      );
      expect(mockLogger.info).toHaveBeenCalledWith("成功获取 2 个工作空间");
      expect(mockContext.success).toHaveBeenCalledWith({
        workspaces: mockWorkspaces,
      });
    });

    it("API 认证失败时应该返回 401 错误", async () => {
      mockConfigManager.isCozeConfigValid.mockReturnValue(true);
      mockConfigManager.getCozeToken.mockReturnValue("test-token");

      const authError = new Error("认证失败");
      (authError as unknown as Record<string, unknown>).code = "AUTH_FAILED";
      mockCozeApiService.getWorkspaces.mockRejectedValue(authError);

      await cozeHandler.getWorkspaces(mockContext);

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
    });

    it("API 超时时应该返回 408 错误", async () => {
      mockConfigManager.isCozeConfigValid.mockReturnValue(true);
      mockConfigManager.getCozeToken.mockReturnValue("test-token");

      const timeoutError = new Error("请求超时");
      (timeoutError as unknown as Record<string, unknown>).code = "TIMEOUT";
      mockCozeApiService.getWorkspaces.mockRejectedValue(timeoutError);

      await cozeHandler.getWorkspaces(mockContext);

      expect(mockLogger.error).toHaveBeenCalledWith(
        "获取工作空间列表失败:",
        timeoutError
      );
      expect(mockContext.fail).toHaveBeenCalledWith(
        "TIMEOUT",
        "请求超时，请稍后重试",
        undefined,
        408
      );
    });

    it("API 被限流时应该返回 429 错误", async () => {
      mockConfigManager.isCozeConfigValid.mockReturnValue(true);
      mockConfigManager.getCozeToken.mockReturnValue("test-token");

      const rateLimitError = new Error("请求过于频繁");
      (rateLimitError as unknown as Record<string, unknown>).code =
        "RATE_LIMITED";
      mockCozeApiService.getWorkspaces.mockRejectedValue(rateLimitError);

      await cozeHandler.getWorkspaces(mockContext);

      expect(mockLogger.error).toHaveBeenCalledWith(
        "获取工作空间列表失败:",
        rateLimitError
      );
      expect(mockContext.fail).toHaveBeenCalledWith(
        "RATE_LIMITED",
        "请求过于频繁，请稍后重试",
        undefined,
        429
      );
    });

    it("其他 API 错误应该返回 500 错误", async () => {
      mockConfigManager.isCozeConfigValid.mockReturnValue(true);
      mockConfigManager.getCozeToken.mockReturnValue("test-token");

      const apiError = new Error("API 服务异常");
      mockCozeApiService.getWorkspaces.mockRejectedValue(apiError);

      await cozeHandler.getWorkspaces(mockContext);

      expect(mockLogger.error).toHaveBeenCalledWith(
        "获取工作空间列表失败:",
        apiError
      );
      expect(mockContext.fail).toHaveBeenCalledWith(
        "INTERNAL_ERROR",
        "API 服务异常",
        undefined,
        500
      );
    });

    it("非标准错误对象应该返回默认错误消息", async () => {
      mockConfigManager.isCozeConfigValid.mockReturnValue(true);
      mockConfigManager.getCozeToken.mockReturnValue("test-token");

      mockCozeApiService.getWorkspaces.mockRejectedValue("字符串错误");

      await cozeHandler.getWorkspaces(mockContext);

      expect(mockContext.fail).toHaveBeenCalledWith(
        "INTERNAL_ERROR",
        "获取工作空间列表失败",
        undefined,
        500
      );
    });

    it("Token 未配置时应该抛出错误", async () => {
      mockConfigManager.isCozeConfigValid.mockReturnValue(true);
      mockConfigManager.getCozeToken.mockReturnValue(undefined);

      await cozeHandler.getWorkspaces(mockContext);

      expect(mockContext.fail).toHaveBeenCalledWith(
        "INTERNAL_ERROR",
        "扣子 API Token 未配置，请在配置文件中设置 platforms.coze.token",
        undefined,
        500
      );
    });
  });

  describe("getWorkflows", () => {
    it("配置无效时应该返回错误响应", async () => {
      mockConfigManager.isCozeConfigValid.mockReturnValue(false);

      await cozeHandler.getWorkflows(mockContext);

      expect(mockLogger.info).toHaveBeenCalledWith("处理获取工作流列表请求");
      expect(mockLogger.debug).toHaveBeenCalledWith("扣子配置无效");
      expect(mockContext.fail).toHaveBeenCalledWith(
        "CONFIG_INVALID",
        "扣子配置无效，请检查 platforms.coze.token 配置",
        undefined,
        400
      );
    });

    it("缺少 workspace_id 参数时应该返回错误响应", async () => {
      mockConfigManager.isCozeConfigValid.mockReturnValue(true);
      mockConfigManager.getCozeToken.mockReturnValue("test-token");
      mockContext.req.query.mockImplementation((key: string) => {
        if (key === "workspace_id") return undefined;
        if (key === "page_num") return "1";
        if (key === "page_size") return "20";
        return undefined;
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

    it("page_num 超出范围时应该返回错误响应 - 小于 1", async () => {
      mockConfigManager.isCozeConfigValid.mockReturnValue(true);
      mockConfigManager.getCozeToken.mockReturnValue("test-token");
      mockContext.req.query.mockImplementation((key: string) => {
        if (key === "workspace_id") return "ws-1";
        if (key === "page_num") return "0";
        if (key === "page_size") return "20";
        return undefined;
      });

      await cozeHandler.getWorkflows(mockContext);

      expect(mockContext.fail).toHaveBeenCalledWith(
        "INVALID_PARAMETER",
        "page_num 必须在 1-1000 之间",
        undefined,
        400
      );
    });

    it("page_num 超出范围时应该返回错误响应 - 大于 1000", async () => {
      mockConfigManager.isCozeConfigValid.mockReturnValue(true);
      mockConfigManager.getCozeToken.mockReturnValue("test-token");
      mockContext.req.query.mockImplementation((key: string) => {
        if (key === "workspace_id") return "ws-1";
        if (key === "page_num") return "1001";
        if (key === "page_size") return "20";
        return undefined;
      });

      await cozeHandler.getWorkflows(mockContext);

      expect(mockContext.fail).toHaveBeenCalledWith(
        "INVALID_PARAMETER",
        "page_num 必须在 1-1000 之间",
        undefined,
        400
      );
    });

    it("page_size 超出范围时应该返回错误响应 - 小于 1", async () => {
      mockConfigManager.isCozeConfigValid.mockReturnValue(true);
      mockConfigManager.getCozeToken.mockReturnValue("test-token");
      mockContext.req.query.mockImplementation((key: string) => {
        if (key === "workspace_id") return "ws-1";
        if (key === "page_num") return "1";
        if (key === "page_size") return "0";
        return undefined;
      });

      await cozeHandler.getWorkflows(mockContext);

      expect(mockContext.fail).toHaveBeenCalledWith(
        "INVALID_PARAMETER",
        "page_size 必须在 1-100 之间",
        undefined,
        400
      );
    });

    it("page_size 超出范围时应该返回错误响应 - 大于 100", async () => {
      mockConfigManager.isCozeConfigValid.mockReturnValue(true);
      mockConfigManager.getCozeToken.mockReturnValue("test-token");
      mockContext.req.query.mockImplementation((key: string) => {
        if (key === "workspace_id") return "ws-1";
        if (key === "page_num") return "1";
        if (key === "page_size") return "101";
        return undefined;
      });

      await cozeHandler.getWorkflows(mockContext);

      expect(mockContext.fail).toHaveBeenCalledWith(
        "INVALID_PARAMETER",
        "page_size 必须在 1-100 之间",
        undefined,
        400
      );
    });

    it("应该成功获取工作流列表", async () => {
      mockConfigManager.isCozeConfigValid.mockReturnValue(true);
      mockConfigManager.getCozeToken.mockReturnValue("test-token");
      mockConfigManager.getCustomMCPTools.mockReturnValue([]);
      mockContext.req.query.mockImplementation((key: string) => {
        if (key === "workspace_id") return "ws-1";
        if (key === "page_num") return "1";
        if (key === "page_size") return "20";
        return undefined;
      });

      const mockWorkflows = [
        { workflow_id: "wf-1", workflow_name: "工作流1" },
        { workflow_id: "wf-2", workflow_name: "工作流2" },
      ];
      mockCozeApiService.getWorkflows.mockResolvedValue({
        items: mockWorkflows,
        has_more: false,
      });

      await cozeHandler.getWorkflows(mockContext);

      expect(mockCozeApiService.getWorkflows).toHaveBeenCalledWith({
        workspace_id: "ws-1",
        page_num: 1,
        page_size: 20,
      });
      expect(mockLogger.info).toHaveBeenCalledWith(
        "开始获取工作空间 ws-1 的工作流列表，页码: 1，每页: 20"
      );
      expect(mockLogger.info).toHaveBeenCalledWith(
        "成功获取工作空间 ws-1 的 2 个工作流"
      );
      expect(mockContext.success).toHaveBeenCalledWith(
        {
          items: [
            {
              workflow_id: "wf-1",
              workflow_name: "工作流1",
              isAddedAsTool: false,
              toolName: null,
            },
            {
              workflow_id: "wf-2",
              workflow_name: "工作流2",
              isAddedAsTool: false,
              toolName: null,
            },
          ],
          has_more: false,
          page_num: 1,
          page_size: 20,
          total_count: 2,
        },
        "成功获取 2 个工作流"
      );
    });

    it("应该正确标识已添加为工具的工作流", async () => {
      mockConfigManager.isCozeConfigValid.mockReturnValue(true);
      mockConfigManager.getCozeToken.mockReturnValue("test-token");
      mockConfigManager.getCustomMCPTools.mockReturnValue([
        {
          name: "coze-tool-1",
          handler: {
            type: "proxy",
            platform: "coze",
            config: { workflow_id: "wf-1" },
          },
        },
      ]);
      mockContext.req.query.mockImplementation((key: string) => {
        if (key === "workspace_id") return "ws-1";
        if (key === "page_num") return "1";
        if (key === "page_size") return "20";
        return undefined;
      });

      const mockWorkflows = [
        { workflow_id: "wf-1", workflow_name: "工作流1" },
        { workflow_id: "wf-2", workflow_name: "工作流2" },
      ];
      mockCozeApiService.getWorkflows.mockResolvedValue({
        items: mockWorkflows,
        has_more: false,
      });

      await cozeHandler.getWorkflows(mockContext);

      expect(mockLogger.info).toHaveBeenCalledWith(
        "工作流工具状态检查完成，共 1 个工作流已添加为工具"
      );
      expect(mockContext.success).toHaveBeenCalledWith(
        expect.objectContaining({
          items: [
            {
              workflow_id: "wf-1",
              workflow_name: "工作流1",
              isAddedAsTool: true,
              toolName: "coze-tool-1",
            },
            {
              workflow_id: "wf-2",
              workflow_name: "工作流2",
              isAddedAsTool: false,
              toolName: null,
            },
          ],
        }),
        "成功获取 2 个工作流"
      );
    });

    it("应该使用默认分页参数", async () => {
      mockConfigManager.isCozeConfigValid.mockReturnValue(true);
      mockConfigManager.getCozeToken.mockReturnValue("test-token");
      mockConfigManager.getCustomMCPTools.mockReturnValue([]);
      mockContext.req.query.mockImplementation((key: string) => {
        if (key === "workspace_id") return "ws-1";
        // page_num 和 page_size 未提供，使用默认值
        return undefined;
      });

      const mockWorkflows = [{ workflow_id: "wf-1", workflow_name: "工作流1" }];
      mockCozeApiService.getWorkflows.mockResolvedValue({
        items: mockWorkflows,
        has_more: true,
      });

      await cozeHandler.getWorkflows(mockContext);

      expect(mockCozeApiService.getWorkflows).toHaveBeenCalledWith({
        workspace_id: "ws-1",
        page_num: 1,
        page_size: 20,
      });
    });

    it("API 认证失败时应该返回 401 错误", async () => {
      mockConfigManager.isCozeConfigValid.mockReturnValue(true);
      mockConfigManager.getCozeToken.mockReturnValue("test-token");
      mockContext.req.query.mockImplementation((key: string) => {
        if (key === "workspace_id") return "ws-1";
        return undefined;
      });

      const authError = new Error("认证失败");
      (authError as unknown as Record<string, unknown>).code = "AUTH_FAILED";
      mockCozeApiService.getWorkflows.mockRejectedValue(authError);

      await cozeHandler.getWorkflows(mockContext);

      expect(mockContext.fail).toHaveBeenCalledWith(
        "AUTH_FAILED",
        "扣子 API 认证失败，请检查 Token 配置",
        undefined,
        401
      );
    });

    it("其他 API 错误应该返回 500 错误", async () => {
      mockConfigManager.isCozeConfigValid.mockReturnValue(true);
      mockConfigManager.getCozeToken.mockReturnValue("test-token");
      mockContext.req.query.mockImplementation((key: string) => {
        if (key === "workspace_id") return "ws-1";
        return undefined;
      });

      const apiError = new Error("获取工作流失败");
      mockCozeApiService.getWorkflows.mockRejectedValue(apiError);

      await cozeHandler.getWorkflows(mockContext);

      expect(mockContext.fail).toHaveBeenCalledWith(
        "INTERNAL_ERROR",
        "获取工作流失败",
        undefined,
        500
      );
    });
  });

  describe("clearCache", () => {
    it("配置无效时应该返回错误响应", async () => {
      mockConfigManager.isCozeConfigValid.mockReturnValue(false);

      await cozeHandler.clearCache(mockContext);

      expect(mockLogger.info).toHaveBeenCalledWith("处理清除扣子 API 缓存请求");
      expect(mockLogger.debug).toHaveBeenCalledWith("扣子配置无效");
      expect(mockContext.fail).toHaveBeenCalledWith(
        "CONFIG_INVALID",
        "扣子配置无效，请检查 platforms.coze.token 配置",
        undefined,
        400
      );
    });

    it("应该成功清除全部缓存", async () => {
      mockConfigManager.isCozeConfigValid.mockReturnValue(true);
      mockConfigManager.getCozeToken.mockReturnValue("test-token");
      mockContext.req.query.mockImplementation(() => undefined);

      mockCozeApiService.getCacheStats.mockReturnValueOnce({
        size: 5,
        keys: ["key1", "key2", "key3", "key4", "key5"],
        hits: 10,
        misses: 2,
        hitRate: 0.83,
        ksize: 50,
        vsize: 100,
      });
      mockCozeApiService.getCacheStats.mockReturnValueOnce({
        size: 0,
        keys: [],
        hits: 10,
        misses: 2,
        hitRate: 0.83,
        ksize: 0,
        vsize: 0,
      });

      await cozeHandler.clearCache(mockContext);

      expect(mockLogger.info).toHaveBeenCalledWith("开始清除缓存");
      expect(mockLogger.info).toHaveBeenCalledWith(
        "缓存清除完成，清除前: 5 项，清除后: 0 项"
      );
      expect(mockContext.success).toHaveBeenCalledWith(
        {
          cleared: 5,
          remaining: 0,
          pattern: "all",
        },
        "缓存清除成功"
      );
    });

    it("应该成功清除指定模式的缓存", async () => {
      mockConfigManager.isCozeConfigValid.mockReturnValue(true);
      mockConfigManager.getCozeToken.mockReturnValue("test-token");
      mockContext.req.query.mockImplementation((key: string) => {
        if (key === "pattern") return "workflows";
        return undefined;
      });

      mockCozeApiService.getCacheStats.mockReturnValueOnce({
        size: 10,
        keys: ["workflows:ws1:1:20", "workspaces", "other"],
        hits: 10,
        misses: 2,
        hitRate: 0.83,
        ksize: 50,
        vsize: 100,
      });
      mockCozeApiService.getCacheStats.mockReturnValueOnce({
        size: 8,
        keys: ["workspaces", "other"],
        hits: 10,
        misses: 2,
        hitRate: 0.83,
        ksize: 40,
        vsize: 80,
      });

      await cozeHandler.clearCache(mockContext);

      expect(mockCozeApiService.clearCache).toHaveBeenCalledWith("workflows");
      expect(mockLogger.info).toHaveBeenCalledWith(
        "开始清除缓存 (模式: workflows)"
      );
      expect(mockContext.success).toHaveBeenCalledWith(
        {
          cleared: 2,
          remaining: 8,
          pattern: "workflows",
        },
        "缓存清除成功"
      );
    });

    it("清除缓存失败时应该返回错误响应", async () => {
      mockConfigManager.isCozeConfigValid.mockReturnValue(true);
      mockConfigManager.getCozeToken.mockReturnValue("test-token");
      mockContext.req.query.mockImplementation(() => undefined);

      const error = new Error("缓存清除失败");
      mockCozeApiService.getCacheStats.mockImplementation(() => {
        throw error;
      });

      await cozeHandler.clearCache(mockContext);

      expect(mockLogger.error).toHaveBeenCalledWith("清除缓存失败:", error);
      expect(mockContext.fail).toHaveBeenCalledWith(
        "INTERNAL_ERROR",
        "缓存清除失败",
        undefined,
        500
      );
    });

    it("Token 未配置时应该返回错误", async () => {
      mockConfigManager.isCozeConfigValid.mockReturnValue(true);
      mockConfigManager.getCozeToken.mockReturnValue(undefined);

      await cozeHandler.clearCache(mockContext);

      expect(mockContext.fail).toHaveBeenCalledWith(
        "INTERNAL_ERROR",
        "扣子 API Token 未配置，请在配置文件中设置 platforms.coze.token",
        undefined,
        500
      );
    });
  });

  describe("getCacheStats", () => {
    it("配置无效时应该返回错误响应", async () => {
      mockConfigManager.isCozeConfigValid.mockReturnValue(false);

      await cozeHandler.getCacheStats(mockContext);

      expect(mockLogger.info).toHaveBeenCalledWith("处理获取缓存统计信息请求");
      expect(mockLogger.debug).toHaveBeenCalledWith("扣子配置无效");
      expect(mockContext.fail).toHaveBeenCalledWith(
        "CONFIG_INVALID",
        "扣子配置无效，请检查 platforms.coze.token 配置",
        undefined,
        400
      );
    });

    it("应该成功获取缓存统计信息", async () => {
      mockConfigManager.isCozeConfigValid.mockReturnValue(true);
      mockConfigManager.getCozeToken.mockReturnValue("test-token");

      const mockStats = {
        size: 5,
        keys: ["key1", "key2", "key3", "key4", "key5"],
        hits: 10,
        misses: 2,
        hitRate: 0.83,
        ksize: 50,
        vsize: 100,
      };
      mockCozeApiService.getCacheStats.mockReturnValue(mockStats);

      await cozeHandler.getCacheStats(mockContext);

      expect(mockCozeApiService.getCacheStats).toHaveBeenCalled();
      expect(mockContext.success).toHaveBeenCalledWith(mockStats);
    });

    it("获取缓存统计失败时应该返回错误响应", async () => {
      mockConfigManager.isCozeConfigValid.mockReturnValue(true);
      mockConfigManager.getCozeToken.mockReturnValue("test-token");

      const error = new Error("获取统计失败");
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
        "获取统计失败",
        undefined,
        500
      );
    });

    it("Token 未配置时应该返回错误", async () => {
      mockConfigManager.isCozeConfigValid.mockReturnValue(true);
      mockConfigManager.getCozeToken.mockReturnValue(undefined);

      await cozeHandler.getCacheStats(mockContext);

      expect(mockContext.fail).toHaveBeenCalledWith(
        "INTERNAL_ERROR",
        "扣子 API Token 未配置，请在配置文件中设置 platforms.coze.token",
        undefined,
        500
      );
    });
  });
});

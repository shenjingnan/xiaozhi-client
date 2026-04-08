/**
 * CozeHandler 测试套件
 * 测试扣子 API 路由处理器的各种功能
 */

import { CozeApiService } from "@/lib/coze";
import type { CozeWorkflow, CozeWorkflowsData } from "@/types/coze";
import type { AppContext } from "@/types/hono.context.js";
import { configManager } from "@xiaozhi-client/config";
import type { Context } from "hono";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CozeHandler } from "../coze.handler.js";

// 模拟 Logger
vi.mock("../../Logger.js", () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

// 模拟 configManager
vi.mock("@xiaozhi-client/config", () => ({
  configManager: {
    isCozeConfigValid: vi.fn(),
    getCozeToken: vi.fn(),
    getCustomMCPTools: vi.fn(),
  },
}));

// 模拟 CozeApiService
vi.mock("@/lib/coze", () => ({
  CozeApiService: vi.fn(),
}));

describe("CozeHandler 扣子 API 处理器", () => {
  let cozeHandler: CozeHandler;
  let mockLogger: any;
  let mockContext: Context<AppContext>;
  let mockConfigManager: any;
  let mockCozeApiService: any;

  // 模拟工作空间数据
  const mockWorkspaces = [
    {
      id: "workspace-1",
      name: "测试工作空间1",
      description: "这是测试工作空间1",
      workspace_type: "personal" as const,
      enterprise_id: "ent-1",
      admin_uids: ["admin-1"],
      icon_url: "https://example.com/icon1.png",
      role_type: "owner" as const,
      joined_status: "joined" as const,
      owner_uid: "owner-1",
    },
    {
      id: "workspace-2",
      name: "测试工作空间2",
      description: "这是测试工作空间2",
      workspace_type: "team" as const,
      enterprise_id: "ent-2",
      admin_uids: ["admin-2"],
      icon_url: "https://example.com/icon2.png",
      role_type: "admin" as const,
      joined_status: "joined" as const,
      owner_uid: "owner-2",
    },
  ];

  // 模拟工作流数据
  const mockWorkflows: CozeWorkflow[] = [
    {
      workflow_id: "workflow-1",
      workflow_name: "测试工作流1",
      description: "这是测试工作流1",
      icon_url: "https://example.com/wf1.png",
      app_id: "app-1",
      creator: {
        id: "creator-1",
        name: "创建者1",
      },
      created_at: 1234567890,
      updated_at: 1234567890,
    },
    {
      workflow_id: "workflow-2",
      workflow_name: "测试工作流2",
      description: "这是测试工作流2",
      icon_url: "https://example.com/wf2.png",
      app_id: "app-2",
      creator: {
        id: "creator-2",
        name: "创建者2",
      },
      created_at: 1234567890,
      updated_at: 1234567890,
    },
  ];

  // 模拟自定义 MCP 工具列表
  const mockCustomMCPTools = [
    {
      name: "工具1",
      handler: {
        type: "proxy" as const,
        platform: "coze" as const,
        config: {
          workflow_id: "workflow-1",
        },
      },
    },
    {
      name: "工具2",
      handler: {
        type: "stdio" as const,
        platform: "mcp" as const,
      },
    },
  ];

  beforeEach(async () => {
    vi.clearAllMocks();

    // 设置模拟 Logger
    mockLogger = {
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    };
    const { logger } = await import("../../Logger.js");
    Object.assign(logger, mockLogger);

    // 设置模拟 ConfigManager
    mockConfigManager = {
      isCozeConfigValid: vi.fn(),
      getCozeToken: vi.fn().mockReturnValue("test-token"),
      getCustomMCPTools: vi.fn(),
    };
    Object.assign(configManager, mockConfigManager);

    // 设置模拟 CozeApiService
    mockCozeApiService = {
      getWorkspaces: vi.fn(),
      getWorkflows: vi.fn(),
      clearCache: vi.fn(),
      getCacheStats: vi.fn(),
    };
    vi.mocked(CozeApiService).mockImplementation(() => mockCozeApiService);

    // 设置模拟 Context
    mockContext = {
      get: vi.fn((key: string) => {
        if (key === "logger") return mockLogger;
        return undefined;
      }),
      logger: mockLogger,
      req: {
        query: vi.fn(((name?: string) => {
          const queries: Record<string, string> = {};
          return name ? queries[name] : queries;
        }) as any),
        json: vi.fn(),
      },
      success: vi.fn((data?: unknown, message?: string, status = 200) => {
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
      fail: vi.fn(
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
    } as any;

    // 设置默认配置有效
    mockConfigManager.isCozeConfigValid.mockReturnValue(true);

    cozeHandler = new CozeHandler();
  });

  describe("构造函数", () => {
    it("应该正确初始化处理器", () => {
      expect(cozeHandler).toBeInstanceOf(CozeHandler);
      expect(mockLogger).toBeDefined();
    });
  });

  describe("getWorkspaces 获取工作空间列表", () => {
    it("应该成功返回工作空间列表", async () => {
      mockCozeApiService.getWorkspaces.mockResolvedValue(mockWorkspaces);

      const response = await cozeHandler.getWorkspaces(mockContext);
      const responseData = await response.json();

      expect(mockConfigManager.isCozeConfigValid).toHaveBeenCalled();
      expect(mockCozeApiService.getWorkspaces).toHaveBeenCalled();
      expect(mockLogger.info).toHaveBeenCalledWith("处理获取工作空间列表请求");
      expect(mockLogger.info).toHaveBeenCalledWith(
        `成功获取 ${mockWorkspaces.length} 个工作空间`
      );
      expect(responseData).toEqual({
        success: true,
        data: { workspaces: mockWorkspaces },
      });
      expect(response.status).toBe(200);
    });

    it("应该在配置无效时返回 400 错误", async () => {
      mockConfigManager.isCozeConfigValid.mockReturnValue(false);

      const response = await cozeHandler.getWorkspaces(mockContext);
      const responseData = await response.json();

      expect(mockLogger.debug).toHaveBeenCalledWith("扣子配置无效");
      expect(responseData).toEqual({
        success: false,
        error: {
          code: "CONFIG_INVALID",
          message: "扣子配置无效，请检查 platforms.coze.token 配置",
        },
      });
      expect(response.status).toBe(400);
    });

    it("应该处理 CozeApiService 抛出的错误", async () => {
      const error = new Error("获取工作空间列表失败: API 调用失败");
      mockCozeApiService.getWorkspaces.mockRejectedValue(error);

      const response = await cozeHandler.getWorkspaces(mockContext);
      const responseData = await response.json();

      expect(mockLogger.error).toHaveBeenCalledWith(
        "获取工作空间列表失败:",
        error
      );
      expect(responseData).toEqual({
        success: false,
        error: {
          code: "INTERNAL_ERROR",
          message: "获取工作空间列表失败: API 调用失败",
        },
      });
      expect(response.status).toBe(500);
    });

    it("应该处理空工作空间列表", async () => {
      mockCozeApiService.getWorkspaces.mockResolvedValue([]);

      const response = await cozeHandler.getWorkspaces(mockContext);
      const responseData = await response.json();

      expect(responseData.success).toBe(true);
      expect(responseData.data.workspaces).toEqual([]);
      expect(response.status).toBe(200);
    });

    it("应该处理非 Error 类型的异常", async () => {
      mockCozeApiService.getWorkspaces.mockRejectedValue("字符串错误");

      const response = await cozeHandler.getWorkspaces(mockContext);
      const responseData = await response.json();

      // CozeApiService 将非 Error 类型包装成 Error，但只返回默认错误消息
      expect(responseData).toEqual({
        success: false,
        error: {
          code: "INTERNAL_ERROR",
          message: "获取工作空间列表失败",
        },
      });
      expect(response.status).toBe(500);
    });
  });

  describe("getWorkflows 获取工作流列表", () => {
    const mockWorkflowsData: CozeWorkflowsData = {
      has_more: false,
      items: mockWorkflows,
    };

    it("应该成功返回工作流列表", async () => {
      mockCozeApiService.getWorkflows.mockResolvedValue(mockWorkflowsData);
      mockConfigManager.getCustomMCPTools.mockReturnValue(mockCustomMCPTools);
      mockContext.req.query = vi.fn(((name?: string) => {
        const queries: Record<string, string> = {
          workspace_id: "workspace-1",
          page_num: "1",
          page_size: "20",
        };
        return name ? queries[name] : undefined;
      }) as any);

      const response = await cozeHandler.getWorkflows(mockContext);
      const responseData = await response.json();

      expect(mockConfigManager.isCozeConfigValid).toHaveBeenCalled();
      expect(mockCozeApiService.getWorkflows).toHaveBeenCalledWith({
        workspace_id: "workspace-1",
        page_num: 1,
        page_size: 20,
      });
      expect(mockConfigManager.getCustomMCPTools).toHaveBeenCalled();
      expect(responseData.success).toBe(true);
      expect(responseData.data.items).toHaveLength(2);
      // 验证工具状态增强
      expect(responseData.data.items[0].isAddedAsTool).toBe(true);
      expect(responseData.data.items[0].toolName).toBe("工具1");
      expect(responseData.data.items[1].isAddedAsTool).toBe(false);
      expect(response.status).toBe(200);
    });

    it("应该在缺少 workspace_id 参数时返回 400 错误", async () => {
      mockContext.req.query = vi.fn(((name?: string) => {
        const queries: Record<string, string> = {};
        return name ? queries[name] : undefined;
      }) as any);

      const response = await cozeHandler.getWorkflows(mockContext);
      const responseData = await response.json();

      expect(mockLogger.warn).toHaveBeenCalledWith("缺少 workspace_id 参数");
      expect(responseData).toEqual({
        success: false,
        error: {
          code: "MISSING_PARAMETER",
          message: "缺少必需参数: workspace_id",
        },
      });
      expect(response.status).toBe(400);
    });

    it("应该在 page_num 超出范围时返回 400 错误", async () => {
      mockContext.req.query = vi.fn(((name?: string) => {
        const queries: Record<string, string> = {
          workspace_id: "workspace-1",
          page_num: "0",
        };
        return name ? queries[name] : undefined;
      }) as any);

      const response = await cozeHandler.getWorkflows(mockContext);
      const responseData = await response.json();

      expect(responseData).toEqual({
        success: false,
        error: {
          code: "INVALID_PARAMETER",
          message: "page_num 必须在 1-1000 之间",
        },
      });
      expect(response.status).toBe(400);
    });

    it("应该在 page_num 大于 1000 时返回 400 错误", async () => {
      mockContext.req.query = vi.fn(((name?: string) => {
        const queries: Record<string, string> = {
          workspace_id: "workspace-1",
          page_num: "1001",
        };
        return name ? queries[name] : undefined;
      }) as any);

      const response = await cozeHandler.getWorkflows(mockContext);
      const responseData = await response.json();

      expect(responseData.error.code).toBe("INVALID_PARAMETER");
      expect(responseData.error.message).toBe("page_num 必须在 1-1000 之间");
      expect(response.status).toBe(400);
    });

    it("应该在 page_size 超出范围时返回 400 错误", async () => {
      mockContext.req.query = vi.fn(((name?: string) => {
        const queries: Record<string, string> = {
          workspace_id: "workspace-1",
          page_num: "1",
          page_size: "0",
        };
        return name ? queries[name] : undefined;
      }) as any);

      const response = await cozeHandler.getWorkflows(mockContext);
      const responseData = await response.json();

      expect(responseData).toEqual({
        success: false,
        error: {
          code: "INVALID_PARAMETER",
          message: "page_size 必须在 1-100 之间",
        },
      });
      expect(response.status).toBe(400);
    });

    it("应该在 page_size 大于 100 时返回 400 错误", async () => {
      mockContext.req.query = vi.fn(((name?: string) => {
        const queries: Record<string, string> = {
          workspace_id: "workspace-1",
          page_num: "1",
          page_size: "101",
        };
        return name ? queries[name] : undefined;
      }) as any);

      const response = await cozeHandler.getWorkflows(mockContext);
      const responseData = await response.json();

      expect(responseData.error.code).toBe("INVALID_PARAMETER");
      expect(responseData.error.message).toBe("page_size 必须在 1-100 之间");
      expect(response.status).toBe(400);
    });

    it("应该在配置无效时返回 400 错误", async () => {
      mockConfigManager.isCozeConfigValid.mockReturnValue(false);

      const response = await cozeHandler.getWorkflows(mockContext);
      const responseData = await response.json();

      expect(mockLogger.debug).toHaveBeenCalledWith("扣子配置无效");
      expect(responseData.error.code).toBe("CONFIG_INVALID");
      expect(response.status).toBe(400);
    });

    it("应该使用默认分页参数", async () => {
      mockCozeApiService.getWorkflows.mockResolvedValue(mockWorkflowsData);
      mockConfigManager.getCustomMCPTools.mockReturnValue([]);
      mockContext.req.query = vi.fn(((name?: string) => {
        const queries: Record<string, string> = {
          workspace_id: "workspace-1",
        };
        return name ? queries[name] : undefined;
      }) as any);

      const response = await cozeHandler.getWorkflows(mockContext);
      const responseData = await response.json();

      expect(mockCozeApiService.getWorkflows).toHaveBeenCalledWith({
        workspace_id: "workspace-1",
        page_num: 1,
        page_size: 20,
      });
      expect(responseData.success).toBe(true);
    });

    it("应该处理没有添加为工具的工作流", async () => {
      mockCozeApiService.getWorkflows.mockResolvedValue(mockWorkflowsData);
      mockConfigManager.getCustomMCPTools.mockReturnValue([]);
      mockContext.req.query = vi.fn(((name?: string) => {
        const queries: Record<string, string> = {
          workspace_id: "workspace-1",
        };
        return name ? queries[name] : undefined;
      }) as any);

      const response = await cozeHandler.getWorkflows(mockContext);
      const responseData = await response.json();

      expect(responseData.data.items[0].isAddedAsTool).toBe(false);
      expect(responseData.data.items[0].toolName).toBeNull();
      expect(responseData.data.items[1].isAddedAsTool).toBe(false);
    });

    it("应该正确处理响应格式", async () => {
      mockCozeApiService.getWorkflows.mockResolvedValue(mockWorkflowsData);
      mockConfigManager.getCustomMCPTools.mockReturnValue([]);
      mockContext.req.query = vi.fn(((name?: string) => {
        const queries: Record<string, string> = {
          workspace_id: "workspace-1",
          page_num: "2",
          page_size: "10",
        };
        return name ? queries[name] : undefined;
      }) as any);

      const response = await cozeHandler.getWorkflows(mockContext);
      const responseData = await response.json();

      // 验证响应结构包含所有必需字段
      expect(responseData.data).toHaveProperty("items");
      expect(responseData.data).toHaveProperty("has_more", false);
      expect(responseData.data).toHaveProperty("page_num", 2);
      expect(responseData.data).toHaveProperty("page_size", 10);
      expect(responseData.data).toHaveProperty("total_count", 2);

      // 验证每个工作流项目都有增强的字段
      expect(responseData.data.items).toHaveLength(2);
      expect(responseData.data.items[0]).toHaveProperty("workflow_id");
      expect(responseData.data.items[0]).toHaveProperty("isAddedAsTool");
      expect(responseData.data.items[0]).toHaveProperty("toolName");
    });

    it("应该处理 API 调用失败", async () => {
      const error = new Error("获取工作流列表失败: API 错误");
      mockCozeApiService.getWorkflows.mockRejectedValue(error);
      mockContext.req.query = vi.fn(((name?: string) => {
        const queries: Record<string, string> = {
          workspace_id: "workspace-1",
        };
        return name ? queries[name] : undefined;
      }) as any);

      const response = await cozeHandler.getWorkflows(mockContext);
      const responseData = await response.json();

      expect(mockLogger.error).toHaveBeenCalledWith(
        "获取工作流列表失败:",
        error
      );
      expect(responseData.error.code).toBe("INTERNAL_ERROR");
      expect(response.status).toBe(500);
    });
  });

  describe("clearCache 清除缓存", () => {
    it("应该成功清除所有缓存", async () => {
      const mockStatsBefore = { size: 10 };
      const mockStatsAfter = { size: 0 };

      mockCozeApiService.getCacheStats
        .mockReturnValueOnce(mockStatsBefore)
        .mockReturnValueOnce(mockStatsAfter);
      mockContext.req.query = vi.fn((() => undefined) as any);

      const response = await cozeHandler.clearCache(mockContext);
      const responseData = await response.json();

      // 当 pattern 为 undefined 时，会清除所有缓存
      expect(mockCozeApiService.clearCache).toHaveBeenCalledWith(undefined);
      expect(mockCozeApiService.getCacheStats).toHaveBeenCalledTimes(2);
      expect(responseData).toEqual({
        success: true,
        data: {
          cleared: 10,
          remaining: 0,
          pattern: "all",
        },
        message: "缓存清除成功",
      });
      expect(response.status).toBe(200);
    });

    it("应该成功清除指定模式的缓存", async () => {
      const mockStatsBefore = { size: 5 };
      const mockStatsAfter = { size: 2 };

      mockCozeApiService.getCacheStats
        .mockReturnValueOnce(mockStatsBefore)
        .mockReturnValueOnce(mockStatsAfter);
      mockContext.req.query = vi.fn(((name?: string) => {
        if (name === "pattern") return "workflows";
        return undefined;
      }) as any);

      const response = await cozeHandler.clearCache(mockContext);
      const responseData = await response.json();

      expect(mockCozeApiService.clearCache).toHaveBeenCalledWith("workflows");
      expect(responseData).toEqual({
        success: true,
        data: {
          cleared: 3,
          remaining: 2,
          pattern: "workflows",
        },
        message: "缓存清除成功",
      });
      expect(response.status).toBe(200);
    });

    it("应该在配置无效时返回 400 错误", async () => {
      mockConfigManager.isCozeConfigValid.mockReturnValue(false);

      const response = await cozeHandler.clearCache(mockContext);
      const responseData = await response.json();

      expect(mockLogger.debug).toHaveBeenCalledWith("扣子配置无效");
      expect(responseData).toEqual({
        success: false,
        error: {
          code: "CONFIG_INVALID",
          message: "扣子配置无效，请检查 platforms.coze.token 配置",
        },
      });
      expect(response.status).toBe(400);
    });

    it("应该处理清除缓存时的错误", async () => {
      const error = new Error("清除缓存失败");
      mockCozeApiService.getCacheStats.mockImplementation(() => {
        throw error;
      });

      const response = await cozeHandler.clearCache(mockContext);
      const responseData = await response.json();

      expect(mockLogger.error).toHaveBeenCalledWith("清除缓存失败:", error);
      expect(responseData).toEqual({
        success: false,
        error: {
          code: "INTERNAL_ERROR",
          message: "清除缓存失败",
        },
      });
      expect(response.status).toBe(500);
    });

    it("应该处理非 Error 类型的异常", async () => {
      mockCozeApiService.getCacheStats.mockImplementation(() => {
        throw "未知错误";
      });

      const response = await cozeHandler.clearCache(mockContext);
      const responseData = await response.json();

      // 非 Error 类型会使用默认消息 "清除缓存失败"
      expect(responseData).toEqual({
        success: false,
        error: {
          code: "INTERNAL_ERROR",
          message: "清除缓存失败",
        },
      });
      expect(response.status).toBe(500);
    });
  });

  describe("getCacheStats 获取缓存统计信息", () => {
    const mockCacheStats = {
      size: 5,
      keys: ["key1", "key2", "key3", "key4", "key5"],
      hits: 100,
      misses: 20,
      hitRate: 0.8333333333333334,
      ksize: 100,
      vsize: 500,
    };

    it("应该成功返回缓存统计信息", async () => {
      mockCozeApiService.getCacheStats.mockReturnValue(mockCacheStats);

      const response = await cozeHandler.getCacheStats(mockContext);
      const responseData = await response.json();

      expect(mockCozeApiService.getCacheStats).toHaveBeenCalled();
      expect(responseData).toEqual({
        success: true,
        data: mockCacheStats,
      });
      expect(response.status).toBe(200);
    });

    it("应该在配置无效时返回 400 错误", async () => {
      mockConfigManager.isCozeConfigValid.mockReturnValue(false);

      const response = await cozeHandler.getCacheStats(mockContext);
      const responseData = await response.json();

      expect(mockLogger.debug).toHaveBeenCalledWith("扣子配置无效");
      expect(responseData).toEqual({
        success: false,
        error: {
          code: "CONFIG_INVALID",
          message: "扣子配置无效，请检查 platforms.coze.token 配置",
        },
      });
      expect(response.status).toBe(400);
    });

    it("应该处理获取缓存统计时的错误", async () => {
      const error = new Error("获取缓存统计失败");
      mockCozeApiService.getCacheStats.mockImplementation(() => {
        throw error;
      });

      const response = await cozeHandler.getCacheStats(mockContext);
      const responseData = await response.json();

      expect(mockLogger.error).toHaveBeenCalledWith(
        "获取缓存统计信息失败:",
        error
      );
      expect(responseData).toEqual({
        success: false,
        error: {
          code: "INTERNAL_ERROR",
          message: "获取缓存统计失败",
        },
      });
      expect(response.status).toBe(500);
    });

    it("应该处理空缓存统计", async () => {
      const emptyStats = {
        size: 0,
        keys: [],
        hits: 0,
        misses: 0,
        hitRate: 0,
        ksize: 0,
        vsize: 0,
      };
      mockCozeApiService.getCacheStats.mockReturnValue(emptyStats);

      const response = await cozeHandler.getCacheStats(mockContext);
      const responseData = await response.json();

      expect(responseData.success).toBe(true);
      expect(responseData.data).toEqual(emptyStats);
    });
  });

  describe("错误处理 - 特定错误类型", () => {
    it("应该处理 AUTH_FAILED 错误并返回 401", async () => {
      const authError = new Error("认证失败") as Error & { code: string };
      authError.code = "AUTH_FAILED";
      mockCozeApiService.getWorkspaces.mockRejectedValue(authError);

      const response = await cozeHandler.getWorkspaces(mockContext);
      const responseData = await response.json();

      expect(responseData).toEqual({
        success: false,
        error: {
          code: "AUTH_FAILED",
          message: "扣子 API 认证失败，请检查 Token 配置",
        },
      });
      expect(response.status).toBe(401);
    });

    it("应该处理 RATE_LIMITED 错误并返回 429", async () => {
      const rateLimitError = new Error("请求过于频繁") as Error & {
        code: string;
      };
      rateLimitError.code = "RATE_LIMITED";
      mockCozeApiService.getWorkspaces.mockRejectedValue(rateLimitError);

      const response = await cozeHandler.getWorkspaces(mockContext);
      const responseData = await response.json();

      expect(responseData).toEqual({
        success: false,
        error: {
          code: "RATE_LIMITED",
          message: "请求过于频繁，请稍后重试",
        },
      });
      expect(response.status).toBe(429);
    });

    it("应该处理 TIMEOUT 错误并返回 408", async () => {
      const timeoutError = new Error("请求超时") as Error & { code: string };
      timeoutError.code = "TIMEOUT";
      mockCozeApiService.getWorkspaces.mockRejectedValue(timeoutError);

      const response = await cozeHandler.getWorkspaces(mockContext);
      const responseData = await response.json();

      expect(responseData).toEqual({
        success: false,
        error: {
          code: "TIMEOUT",
          message: "请求超时，请稍后重试",
        },
      });
      expect(response.status).toBe(408);
    });

    it("应该处理其他 API_ERROR 错误并返回 500", async () => {
      const apiError = new Error("API 错误") as Error & { code: string };
      apiError.code = "API_ERROR";
      mockCozeApiService.getWorkspaces.mockRejectedValue(apiError);

      const response = await cozeHandler.getWorkspaces(mockContext);
      const responseData = await response.json();

      expect(responseData.error.code).toBe("INTERNAL_ERROR");
      expect(response.status).toBe(500);
    });
  });

  describe("边界条件和集成测试", () => {
    it("应该处理特殊字符的工作空间 ID", async () => {
      mockCozeApiService.getWorkflows.mockResolvedValue({
        has_more: false,
        items: [],
      });
      mockConfigManager.getCustomMCPTools.mockReturnValue([]);
      mockContext.req.query = vi.fn(((name?: string) => {
        const queries: Record<string, string> = {
          workspace_id: "workspace-with-special-chars-中文-123",
        };
        return name ? queries[name] : undefined;
      }) as any);

      const response = await cozeHandler.getWorkflows(mockContext);
      const responseData = await response.json();

      expect(responseData.success).toBe(true);
      expect(mockCozeApiService.getWorkflows).toHaveBeenCalledWith({
        workspace_id: "workspace-with-special-chars-中文-123",
        page_num: 1,
        page_size: 20,
      });
    });

    it("应该正确记录所有关键操作的日志", async () => {
      mockCozeApiService.getWorkspaces.mockResolvedValue(mockWorkspaces);

      await cozeHandler.getWorkspaces(mockContext);

      expect(mockLogger.info).toHaveBeenCalledWith("处理获取工作空间列表请求");
      expect(mockLogger.info).toHaveBeenCalledWith(
        "调用 Coze API 获取工作空间列表"
      );
      expect(mockLogger.info).toHaveBeenCalledWith(
        `成功获取 ${mockWorkspaces.length} 个工作空间`
      );
    });

    it("应该处理大量工作流数据", async () => {
      const largeWorkflows: CozeWorkflow[] = Array.from(
        { length: 100 },
        (_, i) => ({
          workflow_id: `workflow-${i}`,
          workflow_name: `工作流${i}`,
          description: `描述${i}`,
          icon_url: `https://example.com/wf${i}.png`,
          app_id: `app-${i}`,
          creator: {
            id: `creator-${i}`,
            name: `创建者${i}`,
          },
          created_at: 1234567890,
          updated_at: 1234567890,
        })
      );

      mockCozeApiService.getWorkflows.mockResolvedValue({
        has_more: true,
        items: largeWorkflows,
      });
      mockConfigManager.getCustomMCPTools.mockReturnValue([]);
      mockContext.req.query = vi.fn(((name?: string) => {
        const queries: Record<string, string> = {
          workspace_id: "workspace-1",
          page_num: "1",
          page_size: "100",
        };
        return name ? queries[name] : undefined;
      }) as any);

      const response = await cozeHandler.getWorkflows(mockContext);
      const responseData = await response.json();

      expect(responseData.success).toBe(true);
      expect(responseData.data.items).toHaveLength(100);
      expect(responseData.data.total_count).toBe(100);
    });

    it("应该在多次调用后保持稳定", async () => {
      mockCozeApiService.getCacheStats.mockReturnValue({
        size: 5,
        keys: ["key1"],
        hits: 10,
        misses: 2,
        hitRate: 0.833,
        ksize: 50,
        vsize: 250,
      });

      for (let i = 0; i < 10; i++) {
        const response = await cozeHandler.getCacheStats(mockContext);
        const responseData = await response.json();
        expect(responseData.success).toBe(true);
      }

      expect(mockCozeApiService.getCacheStats).toHaveBeenCalledTimes(10);
    });
  });

  describe("响应格式验证", () => {
    it("成功响应应该包含正确的结构", async () => {
      mockCozeApiService.getWorkspaces.mockResolvedValue(mockWorkspaces);

      const response = await cozeHandler.getWorkspaces(mockContext);
      const responseData = await response.json();

      expect(responseData).toHaveProperty("success", true);
      expect(responseData).toHaveProperty("data");
      expect(responseData.data).toHaveProperty("workspaces");
      expect(responseData).not.toHaveProperty("error");
    });

    it("错误响应应该包含正确的结构", async () => {
      mockConfigManager.isCozeConfigValid.mockReturnValue(false);

      const response = await cozeHandler.getWorkspaces(mockContext);
      const responseData = await response.json();

      expect(responseData).toHaveProperty("success", false);
      expect(responseData).toHaveProperty("error");
      expect(responseData.error).toHaveProperty("code");
      expect(responseData.error).toHaveProperty("message");
    });
  });
});

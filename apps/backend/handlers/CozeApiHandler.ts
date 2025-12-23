/**
 * 扣子 API HTTP 路由处理器
 * 提供扣子工作空间和工作流相关的 RESTful API 接口
 */

import { configManager } from "@/lib/config/configManager.js";
import { CozeApiService } from "@/lib/coze";
import { logger } from "@root/Logger";
import type { CozeWorkflowsParams } from "@root/types/coze";
import type { Context } from "hono";

/**
 * 错误代码类型
 */
type CozeErrorCode =
  | "AUTH_FAILED"
  | "RATE_LIMITED"
  | "TIMEOUT"
  | "API_ERROR"
  | "NETWORK_ERROR";

/**
 * 带 code 属性的错误接口
 */
interface ErrorWithCode {
  code: CozeErrorCode;
  message: string;
  statusCode?: number;
  response?: unknown;
}

/**
 * 类型守卫函数：检查错误是否带有 code 属性
 */
function isErrorWithCode(error: unknown): error is ErrorWithCode {
  if (!(error instanceof Error && "code" in error)) {
    return false;
  }

  const code = (error as ErrorWithCode).code;
  const validCodes: CozeErrorCode[] = [
    "AUTH_FAILED",
    "RATE_LIMITED",
    "TIMEOUT",
    "API_ERROR",
    "NETWORK_ERROR",
  ];

  return typeof code === "string" && validCodes.includes(code as CozeErrorCode);
}

/**
 * 统一的 API 响应格式
 */
interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  message?: string;
}

/**
 * 错误响应格式
 */
interface ErrorResponse {
  success: false;
  message: string;
  error?: {
    code: string;
    details?: unknown;
  };
}

/**
 * 创建成功响应
 */
function createSuccessResponse<T>(data: T, message?: string): ApiResponse<T> {
  return {
    success: true,
    data,
    message,
  };
}

/**
 * 创建错误响应
 */
function createErrorResponse(
  message: string,
  code?: string,
  details?: unknown
): ErrorResponse {
  return {
    success: false,
    message,
    error: code ? { code, details } : undefined,
  };
}

/**
 * 获取扣子 API 服务实例
 */
function getCozeApiService(): CozeApiService {
  const token = configManager.getCozeToken();

  if (!token) {
    throw new Error(
      "扣子 API Token 未配置，请在配置文件中设置 platforms.coze.token"
    );
  }

  return new CozeApiService(token);
}

/**
 * 扣子 API 路由处理器类
 */
export class CozeApiHandler {
  /**
   * 获取工作空间列表
   * GET /api/coze/workspaces
   */
  async getWorkspaces(c: Context): Promise<Response> {
    try {
      logger.info("处理获取工作空间列表请求");

      // 检查扣子配置
      if (!configManager.isCozeConfigValid()) {
        logger.debug("扣子配置无效");
        return c.json(
          createErrorResponse(
            "扣子配置无效，请检查 platforms.coze.token 配置",
            "CONFIG_INVALID"
          ),
          400
        );
      }

      const cozeApiService = getCozeApiService();

      logger.info("调用 Coze API 获取工作空间列表");
      const workspaces = await cozeApiService.getWorkspaces();
      logger.info(`成功获取 ${workspaces.length} 个工作空间`);

      return c.json(
        createSuccessResponse({
          workspaces,
        })
      );
    } catch (error) {
      logger.error("获取工作空间列表失败:", error);

      // 根据错误类型返回不同的响应
      if (isErrorWithCode(error) && error.code === "AUTH_FAILED") {
        return c.json(
          createErrorResponse(
            "扣子 API 认证失败，请检查 Token 配置",
            "AUTH_FAILED"
          ),
          401
        );
      }

      if (isErrorWithCode(error) && error.code === "RATE_LIMITED") {
        return c.json(
          createErrorResponse("请求过于频繁，请稍后重试", "RATE_LIMITED"),
          429
        );
      }

      if (isErrorWithCode(error) && error.code === "TIMEOUT") {
        return c.json(
          createErrorResponse("请求超时，请稍后重试", "TIMEOUT"),
          408
        );
      }

      return c.json(
        createErrorResponse(
          error instanceof Error ? error.message : "获取工作空间列表失败",
          "INTERNAL_ERROR",
          process.env.NODE_ENV === "development" && error instanceof Error
            ? error.stack
            : undefined
        ),
        500
      );
    }
  }

  /**
   * 获取工作流列表
   * GET /api/coze/workflows?workspace_id=xxx&page_num=1&page_size=20
   */
  async getWorkflows(c: Context): Promise<Response> {
    try {
      logger.info("处理获取工作流列表请求");

      // 检查扣子配置
      if (!configManager.isCozeConfigValid()) {
        logger.debug("扣子配置无效");
        return c.json(
          createErrorResponse(
            "扣子配置无效，请检查 platforms.coze.token 配置",
            "CONFIG_INVALID"
          ),
          400
        );
      }

      // 解析查询参数
      const workspace_id = c.req.query("workspace_id");
      const page_num = Number.parseInt(c.req.query("page_num") || "1", 10);
      const page_size = Number.parseInt(c.req.query("page_size") || "20", 10);

      // 验证必需参数
      if (!workspace_id) {
        logger.warn("缺少 workspace_id 参数");
        return c.json(
          createErrorResponse(
            "缺少必需参数: workspace_id",
            "MISSING_PARAMETER"
          ),
          400
        );
      }

      // 验证分页参数
      if (page_num < 1 || page_num > 1000) {
        return c.json(
          createErrorResponse(
            "page_num 必须在 1-1000 之间",
            "INVALID_PARAMETER"
          ),
          400
        );
      }

      if (page_size < 1 || page_size > 100) {
        return c.json(
          createErrorResponse(
            "page_size 必须在 1-100 之间",
            "INVALID_PARAMETER"
          ),
          400
        );
      }

      const params: CozeWorkflowsParams = {
        workspace_id,
        page_num,
        page_size,
      };

      const cozeApiService = getCozeApiService();

      logger.info(
        `开始获取工作空间 ${workspace_id} 的工作流列表，页码: ${page_num}，每页: ${page_size}`
      );
      const result = await cozeApiService.getWorkflows(params);
      logger.info(
        `成功获取工作空间 ${workspace_id} 的 ${result.items.length} 个工作流`
      );

      // 获取已添加的自定义工具列表，检查工作流是否已被添加为工具
      const customMCPTools = configManager.getCustomMCPTools();

      // 为每个工作流添加工具状态信息
      const enhancedItems = result.items.map((item) => {
        // 查找对应的自定义工具
        const addedTool = customMCPTools.find(
          (tool) =>
            tool.handler.type === "proxy" &&
            tool.handler.platform === "coze" &&
            tool.handler.config.workflow_id === item.workflow_id
        );

        return {
          ...item,
          isAddedAsTool: !!addedTool,
          toolName: addedTool?.name || null,
        };
      });

      logger.info(
        `工作流工具状态检查完成，共 ${enhancedItems.filter((item) => item.isAddedAsTool).length} 个工作流已添加为工具`
      );

      return c.json(
        createSuccessResponse({
          items: enhancedItems,
          has_more: result.has_more,
          page_num,
          page_size,
          total_count: result.items.length, // 当前页的数量
        })
      );
    } catch (error) {
      logger.error("获取工作流列表失败:", error);

      // 根据错误类型返回不同的响应
      if (isErrorWithCode(error) && error.code === "AUTH_FAILED") {
        return c.json(
          createErrorResponse(
            "扣子 API 认证失败，请检查 Token 配置",
            "AUTH_FAILED"
          ),
          401
        );
      }

      if (isErrorWithCode(error) && error.code === "RATE_LIMITED") {
        return c.json(
          createErrorResponse("请求过于频繁，请稍后重试", "RATE_LIMITED"),
          429
        );
      }

      if (isErrorWithCode(error) && error.code === "TIMEOUT") {
        return c.json(
          createErrorResponse("请求超时，请稍后重试", "TIMEOUT"),
          408
        );
      }

      return c.json(
        createErrorResponse(
          error instanceof Error ? error.message : "获取工作流列表失败",
          "INTERNAL_ERROR",
          process.env.NODE_ENV === "development" && error instanceof Error
            ? error.stack
            : undefined
        ),
        500
      );
    }
  }

  /**
   * 清除扣子 API 缓存
   * POST /api/coze/cache/clear
   */
  async clearCache(c: Context): Promise<Response> {
    try {
      logger.info("处理清除扣子 API 缓存请求");

      // 检查扣子配置
      if (!configManager.isCozeConfigValid()) {
        logger.debug("扣子配置无效");
        return c.json(
          createErrorResponse(
            "扣子配置无效，请检查 platforms.coze.token 配置",
            "CONFIG_INVALID"
          ),
          400
        );
      }

      const pattern = c.req.query("pattern"); // 可选的缓存模式参数

      const cozeApiService = getCozeApiService();

      const statsBefore = cozeApiService.getCacheStats();
      logger.info(`开始清除缓存${pattern ? ` (模式: ${pattern})` : ""}`);

      cozeApiService.clearCache(pattern);

      const statsAfter = cozeApiService.getCacheStats();

      logger.info(
        `缓存清除完成，清除前: ${statsBefore.size} 项，清除后: ${statsAfter.size} 项`
      );

      return c.json(
        createSuccessResponse(
          {
            cleared: statsBefore.size - statsAfter.size,
            remaining: statsAfter.size,
            pattern: pattern || "all",
          },
          "缓存清除成功"
        )
      );
    } catch (error) {
      logger.error("清除缓存失败:", error);

      return c.json(
        createErrorResponse(
          error instanceof Error ? error.message : "清除缓存失败",
          "INTERNAL_ERROR",
          process.env.NODE_ENV === "development" && error instanceof Error
            ? error.stack
            : undefined
        ),
        500
      );
    }
  }

  /**
   * 获取缓存统计信息
   * GET /api/coze/cache/stats
   */
  async getCacheStats(c: Context): Promise<Response> {
    try {
      logger.info("处理获取缓存统计信息请求");

      // 检查扣子配置
      if (!configManager.isCozeConfigValid()) {
        logger.debug("扣子配置无效");
        return c.json(
          createErrorResponse(
            "扣子配置无效，请检查 platforms.coze.token 配置",
            "CONFIG_INVALID"
          ),
          400
        );
      }

      const cozeApiService = getCozeApiService();
      const stats = cozeApiService.getCacheStats();

      return c.json(createSuccessResponse(stats));
    } catch (error) {
      logger.error("获取缓存统计信息失败:", error);

      return c.json(
        createErrorResponse(
          error instanceof Error ? error.message : "获取缓存统计信息失败",
          "INTERNAL_ERROR",
          process.env.NODE_ENV === "development" && error instanceof Error
            ? error.stack
            : undefined
        ),
        500
      );
    }
  }
}

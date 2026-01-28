/**
 * 扣子 API HTTP 路由处理器
 * 提供扣子工作空间和工作流相关的 RESTful API 接口
 */

import { CozeApiService } from "@/lib/coze";
import type { AppContext } from "@/types/hono.context.js";
import type { CozeWorkflowsParams } from "@root/types/coze";
import { configManager } from "@xiaozhi-client/config";
import type { Context } from "hono";
import { BaseHandler } from "./base.handler.js";

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
export class CozeHandler extends BaseHandler {
  constructor() {
    super();
  }
  /**
   * 获取工作空间列表
   * GET /api/coze/workspaces
   */
  async getWorkspaces(c: Context<AppContext>): Promise<Response> {
    try {
      c.get("logger").info("处理获取工作空间列表请求");

      // 检查扣子配置
      if (!configManager.isCozeConfigValid()) {
        c.get("logger").debug("扣子配置无效");
        return c.fail(
          "CONFIG_INVALID",
          "扣子配置无效，请检查 platforms.coze.token 配置",
          undefined,
          400
        );
      }

      const cozeApiService = getCozeApiService();

      c.get("logger").info("调用 Coze API 获取工作空间列表");
      const workspaces = await cozeApiService.getWorkspaces();
      c.get("logger").info(`成功获取 ${workspaces.length} 个工作空间`);

      return c.success({ workspaces });
    } catch (error) {
      c.get("logger").error("获取工作空间列表失败:", error);

      // 根据错误类型返回不同的响应
      if (isErrorWithCode(error) && error.code === "AUTH_FAILED") {
        return c.fail(
          "AUTH_FAILED",
          "扣子 API 认证失败，请检查 Token 配置",
          undefined,
          401
        );
      }

      if (isErrorWithCode(error) && error.code === "RATE_LIMITED") {
        return c.fail(
          "RATE_LIMITED",
          "请求过于频繁，请稍后重试",
          undefined,
          429
        );
      }

      if (isErrorWithCode(error) && error.code === "TIMEOUT") {
        return c.fail("TIMEOUT", "请求超时，请稍后重试", undefined, 408);
      }

      const details =
        process.env.NODE_ENV === "development" && error instanceof Error
          ? error.stack
          : undefined;

      return c.fail(
        "INTERNAL_ERROR",
        error instanceof Error ? error.message : "获取工作空间列表失败",
        details,
        500
      );
    }
  }

  /**
   * 获取工作流列表
   * GET /api/coze/workflows?workspace_id=xxx&page_num=1&page_size=20
   */
  async getWorkflows(c: Context<AppContext>): Promise<Response> {
    try {
      c.get("logger").info("处理获取工作流列表请求");

      // 检查扣子配置
      if (!configManager.isCozeConfigValid()) {
        c.get("logger").debug("扣子配置无效");
        return c.fail(
          "CONFIG_INVALID",
          "扣子配置无效，请检查 platforms.coze.token 配置",
          undefined,
          400
        );
      }

      // 解析查询参数
      const workspace_id = c.req.query("workspace_id");
      const page_num = Number.parseInt(c.req.query("page_num") || "1", 10);
      const page_size = Number.parseInt(c.req.query("page_size") || "20", 10);

      // 验证必需参数
      if (!workspace_id) {
        c.get("logger").warn("缺少 workspace_id 参数");
        return c.fail(
          "MISSING_PARAMETER",
          "缺少必需参数: workspace_id",
          undefined,
          400
        );
      }

      // 验证分页参数
      if (page_num < 1 || page_num > 1000) {
        return c.fail(
          "INVALID_PARAMETER",
          "page_num 必须在 1-1000 之间",
          undefined,
          400
        );
      }

      if (page_size < 1 || page_size > 100) {
        return c.fail(
          "INVALID_PARAMETER",
          "page_size 必须在 1-100 之间",
          undefined,
          400
        );
      }

      const params: CozeWorkflowsParams = {
        workspace_id,
        page_num,
        page_size,
      };

      const cozeApiService = getCozeApiService();

      c.get("logger").info(
        `开始获取工作空间 ${workspace_id} 的工作流列表，页码: ${page_num}，每页: ${page_size}`
      );
      const result = await cozeApiService.getWorkflows(params);
      c.get("logger").info(
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

      c.get("logger").info(
        `工作流工具状态检查完成，共 ${enhancedItems.filter((item) => item.isAddedAsTool).length} 个工作流已添加为工具`
      );

      return c.success(
        {
          items: enhancedItems,
          has_more: result.has_more,
          page_num,
          page_size,
          total_count: result.items.length, // 当前页的数量
        },
        `成功获取 ${enhancedItems.length} 个工作流`
      );
    } catch (error) {
      c.get("logger").error("获取工作流列表失败:", error);

      // 根据错误类型返回不同的响应
      if (isErrorWithCode(error) && error.code === "AUTH_FAILED") {
        return c.fail(
          "AUTH_FAILED",
          "扣子 API 认证失败，请检查 Token 配置",
          undefined,
          401
        );
      }

      if (isErrorWithCode(error) && error.code === "RATE_LIMITED") {
        return c.fail(
          "RATE_LIMITED",
          "请求过于频繁，请稍后重试",
          undefined,
          429
        );
      }

      if (isErrorWithCode(error) && error.code === "TIMEOUT") {
        return c.fail("TIMEOUT", "请求超时，请稍后重试", undefined, 408);
      }

      const details =
        process.env.NODE_ENV === "development" && error instanceof Error
          ? error.stack
          : undefined;

      return c.fail(
        "INTERNAL_ERROR",
        error instanceof Error ? error.message : "获取工作流列表失败",
        details,
        500
      );
    }
  }

  /**
   * 清除扣子 API 缓存
   * POST /api/coze/cache/clear
   */
  async clearCache(c: Context<AppContext>): Promise<Response> {
    try {
      c.get("logger").info("处理清除扣子 API 缓存请求");

      // 检查扣子配置
      if (!configManager.isCozeConfigValid()) {
        c.get("logger").debug("扣子配置无效");
        return c.fail(
          "CONFIG_INVALID",
          "扣子配置无效，请检查 platforms.coze.token 配置",
          undefined,
          400
        );
      }

      const pattern = c.req.query("pattern"); // 可选的缓存模式参数

      const cozeApiService = getCozeApiService();

      const statsBefore = cozeApiService.getCacheStats();
      c.get("logger").info(
        `开始清除缓存${pattern ? ` (模式: ${pattern})` : ""}`
      );

      cozeApiService.clearCache(pattern);

      const statsAfter = cozeApiService.getCacheStats();

      c.get("logger").info(
        `缓存清除完成，清除前: ${statsBefore.size} 项，清除后: ${statsAfter.size} 项`
      );

      return c.success(
        {
          cleared: statsBefore.size - statsAfter.size,
          remaining: statsAfter.size,
          pattern: pattern || "all",
        },
        "缓存清除成功"
      );
    } catch (error) {
      c.get("logger").error("清除缓存失败:", error);

      const details =
        process.env.NODE_ENV === "development" && error instanceof Error
          ? error.stack
          : undefined;

      return c.fail(
        "INTERNAL_ERROR",
        error instanceof Error ? error.message : "清除缓存失败",
        details,
        500
      );
    }
  }

  /**
   * 获取缓存统计信息
   * GET /api/coze/cache/stats
   */
  async getCacheStats(c: Context<AppContext>): Promise<Response> {
    try {
      c.get("logger").info("处理获取缓存统计信息请求");

      // 检查扣子配置
      if (!configManager.isCozeConfigValid()) {
        c.get("logger").debug("扣子配置无效");
        return c.fail(
          "CONFIG_INVALID",
          "扣子配置无效，请检查 platforms.coze.token 配置",
          undefined,
          400
        );
      }

      const cozeApiService = getCozeApiService();
      const stats = cozeApiService.getCacheStats();

      return c.success(stats);
    } catch (error) {
      c.get("logger").error("获取缓存统计信息失败:", error);

      const details =
        process.env.NODE_ENV === "development" && error instanceof Error
          ? error.stack
          : undefined;

      return c.fail(
        "INTERNAL_ERROR",
        error instanceof Error ? error.message : "获取缓存统计信息失败",
        details,
        500
      );
    }
  }
}

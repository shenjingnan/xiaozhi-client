/**
 * 工具调用日志 API 处理器
 * 负责处理工具调用日志相关的 HTTP API 请求
 */

import type { Context } from "hono";
import { logger } from "../Logger.js";
import {
  ToolCallLogService,
  type ToolCallQuery,
} from "../services/ToolCallLogService.js";

/**
 * 统一响应接口
 */
interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
}

/**
 * 工具调用日志 API 处理器
 */
export class ToolCallLogApiHandler {
  private toolCallLogService: ToolCallLogService;

  constructor() {
    this.toolCallLogService = new ToolCallLogService();
  }

  /**
   * 创建成功响应
   */
  private createSuccessResponse<T>(data?: T): Response {
    const response: ApiResponse<T> = {
      success: true,
      data,
    };
    return Response.json(response);
  }

  /**
   * 创建错误响应
   */
  private createErrorResponse(
    code: string,
    message: string,
    details?: any
  ): Response {
    const response: ApiResponse = {
      success: false,
      error: {
        code,
        message,
        details,
      },
    };
    return Response.json(response, { status: this.getHttpStatusCode(code) });
  }

  /**
   * 根据错误代码获取 HTTP 状态码
   */
  private getHttpStatusCode(code: string): number {
    switch (code) {
      case "INVALID_QUERY_PARAMETERS":
        return 400;
      case "LOG_FILE_NOT_FOUND":
        return 404;
      case "LOG_FILE_READ_ERROR":
        return 500;
      default:
        return 500;
    }
  }

  /**
   * 验证查询参数
   */
  private validateQueryParams(query: any): {
    isValid: boolean;
    error?: string;
  } {
    if (
      query.limit &&
      (Number.isNaN(query.limit) || query.limit < 1 || query.limit > 200)
    ) {
      return { isValid: false, error: "limit 参数必须是 1-200 之间的数字" };
    }

    if (query.offset && (Number.isNaN(query.offset) || query.offset < 0)) {
      return { isValid: false, error: "offset 参数必须是非负数" };
    }

    if (query.startDate && Number.isNaN(Date.parse(query.startDate))) {
      return { isValid: false, error: "startDate 参数格式无效" };
    }

    if (query.endDate && Number.isNaN(Date.parse(query.endDate))) {
      return { isValid: false, error: "endDate 参数格式无效" };
    }

    if (
      query.startDate &&
      query.endDate &&
      new Date(query.startDate) > new Date(query.endDate)
    ) {
      return { isValid: false, error: "startDate 不能晚于 endDate" };
    }

    return { isValid: true };
  }

  /**
   * 从查询字符串中解析查询参数
   */
  private parseQueryParams(c: Context): ToolCallQuery {
    const query = c.req.query();
    const params: ToolCallQuery = {};

    if (query.limit) {
      params.limit = Number.parseInt(query.limit, 10);
    }
    if (query.offset) {
      params.offset = Number.parseInt(query.offset, 10);
    }
    if (query.toolName) {
      params.toolName = query.toolName;
    }
    if (query.serverName) {
      params.serverName = query.serverName;
    }
    if (query.success) {
      params.success = query.success.toLowerCase() === "true";
    }
    if (query.startDate) {
      params.startDate = query.startDate;
    }
    if (query.endDate) {
      params.endDate = query.endDate;
    }

    return params;
  }

  /**
   * 获取工具调用日志
   */
  async getToolCallLogs(c: Context): Promise<Response> {
    try {
      const queryParams = this.parseQueryParams(c);
      const validation = this.validateQueryParams(queryParams);

      if (!validation.isValid) {
        return this.createErrorResponse(
          "INVALID_QUERY_PARAMETERS",
          validation.error!
        );
      }

      const result = await this.toolCallLogService.getToolCallLogs(queryParams);

      logger.debug(`API: 返回 ${result.records.length} 条工具调用日志记录`);
      return this.createSuccessResponse(result);
    } catch (error) {
      logger.error("获取工具调用日志失败:", error);

      const message = error instanceof Error ? error.message : "未知错误";
      if (message.includes("不存在")) {
        return this.createErrorResponse("LOG_FILE_NOT_FOUND", message);
      }
      if (message.includes("无法读取")) {
        return this.createErrorResponse("LOG_FILE_READ_ERROR", message);
      }

      return this.createErrorResponse(
        "INTERNAL_ERROR",
        "获取工具调用日志失败",
        {
          details: message,
        }
      );
    }
  }
}

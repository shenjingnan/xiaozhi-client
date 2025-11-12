/**
 * 工具调用日志 API 处理器
 * 负责处理工具调用日志相关的 HTTP API 请求
 */

import type { Context } from "hono";
import { z } from "zod";
import { logger } from "../Logger.js";
import { PAGINATION_CONSTANTS } from "../cli/Constants.js";
import type { ToolCallQuery } from "../services/ToolCallLogService.js";
import { ToolCallLogService } from "../services/ToolCallLogService.js";

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
 * 工具调用查询参数 Zod Schema
 */
const ToolCallQuerySchema = z
  .object({
    limit: z
      .string()
      .optional()
      .transform((val) => (val ? Number.parseInt(val, 10) : undefined))
      .refine(
        (val) =>
          val === undefined ||
          (val >= 1 && val <= PAGINATION_CONSTANTS.MAX_LIMIT),
        {
          message: `limit 参数必须是 1-${PAGINATION_CONSTANTS.MAX_LIMIT} 之间的数字`,
        }
      ),
    offset: z
      .string()
      .optional()
      .transform((val) => (val ? Number.parseInt(val, 10) : undefined))
      .refine((val) => val === undefined || val >= 0, {
        message: "offset 参数必须是非负数",
      }),
    toolName: z.string().optional(),
    serverName: z.string().optional(),
    success: z
      .string()
      .optional()
      .transform((val) => (val ? val.toLowerCase() === "true" : undefined)),
    startDate: z
      .string()
      .optional()
      .refine(
        (val) => {
          if (!val) return true;
          const date = Date.parse(val);
          return !Number.isNaN(date);
        },
        {
          message: "startDate 参数格式无效",
        }
      ),
    endDate: z
      .string()
      .optional()
      .refine(
        (val) => {
          if (!val) return true;
          const date = Date.parse(val);
          return !Number.isNaN(date);
        },
        {
          message: "endDate 参数格式无效",
        }
      ),
  })
  .refine(
    (data) => {
      if (!data.startDate || !data.endDate) return true;
      return new Date(data.startDate) <= new Date(data.endDate);
    },
    {
      message: "startDate 不能晚于 endDate",
      path: ["startDate"],
    }
  );

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
   * 解析和验证查询参数
   */
  private parseAndValidateQueryParams(c: Context): {
    success: boolean;
    data?: ToolCallQuery;
    error?: any;
  } {
    const query = c.req.query();
    const result = ToolCallQuerySchema.safeParse(query);

    if (!result.success) {
      return {
        success: false,
        error: result.error.errors.map((err) => ({
          field: err.path.join("."),
          message: err.message,
        })),
      };
    }

    return {
      success: true,
      data: result.data as ToolCallQuery,
    };
  }

  /**
   * 获取工具调用日志
   */
  async getToolCallLogs(c: Context): Promise<Response> {
    try {
      const validation = this.parseAndValidateQueryParams(c);

      if (!validation.success) {
        return this.createErrorResponse(
          "INVALID_QUERY_PARAMETERS",
          "查询参数格式错误",
          validation.error
        );
      }

      const result = await this.toolCallLogService.getToolCallLogs(
        validation.data!
      );

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

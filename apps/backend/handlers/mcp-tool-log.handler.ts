/**
 * 工具调用日志 API 处理器
 * 负责处理工具调用日志相关的 HTTP API 请求
 */

import { PAGINATION_CONSTANTS } from "@/constants/api.constants.js";
import type { ToolCallQuery } from "@/lib/mcp/log.js";
import { ToolCallLogService } from "@/lib/mcp/log.js";
import type { AppContext } from "@/types/hono.context.js";
import { createDateSchema } from "@/utils/index.js";
import type { Context } from "hono";
import { z } from "zod";
import { BaseHandler } from "./base.handler.js";

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
    startDate: createDateSchema("startDate"),
    endDate: createDateSchema("endDate"),
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
export class MCPToolLogHandler extends BaseHandler {
  private toolCallLogService: ToolCallLogService;

  constructor() {
    super();
    this.toolCallLogService = new ToolCallLogService();
  }

  /**
   * 解析和验证查询参数
   */
  private parseAndValidateQueryParams(c: Context<AppContext>): {
    success: boolean;
    data?: ToolCallQuery;
    error?: Array<{ field: string; message: string }>;
  } {
    const query = c.req.query();
    const result = ToolCallQuerySchema.safeParse(query);

    if (!result.success) {
      return {
        success: false,
        error: result.error.issues.map((err) => ({
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
  async getToolCallLogs(c: Context<AppContext>): Promise<Response> {
    try {
      const validation = this.parseAndValidateQueryParams(c);

      if (!validation.success) {
        return c.fail(
          "INVALID_QUERY_PARAMETERS",
          "查询参数格式错误",
          validation.error,
          400
        );
      }

      const result = await this.toolCallLogService.getToolCallLogs(
        validation.data!
      );

      c.get("logger").debug(
        `API: 返回 ${result.records.length} 条工具调用日志记录`
      );
      return c.success(result);
    } catch (error) {
      c.get("logger").error("获取工具调用日志失败:", error);

      const message = error instanceof Error ? error.message : "未知错误";
      if (message.includes("不存在")) {
        return c.fail("LOG_FILE_NOT_FOUND", message, undefined, 404);
      }
      if (message.includes("无法读取")) {
        return c.fail("LOG_FILE_READ_ERROR", message, undefined, 500);
      }

      return c.fail(
        "INTERNAL_ERROR",
        "获取工具调用日志失败",
        { details: message },
        500
      );
    }
  }
}

/**
 * 工具调用日志 API 处理器
 * 负责处理工具调用日志相关的 HTTP API 请求
 */

import type { Context } from "hono";
import { logger } from "../Logger.js";
import {
  ExportFormat,
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
      case "INVALID_EXPORT_FORMAT":
        return 400;
      case "LOG_FILE_NOT_FOUND":
        return 404;
      case "LOG_FILE_READ_ERROR":
      case "EXPORT_ERROR":
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

  /**
   * 获取工具调用统计数据
   */
  async getToolCallStats(c: Context): Promise<Response> {
    try {
      const stats = await this.toolCallLogService.getToolCallStats();

      logger.debug("API: 返回工具调用统计数据");
      return this.createSuccessResponse(stats);
    } catch (error) {
      logger.error("获取工具调用统计失败:", error);

      const message = error instanceof Error ? error.message : "未知错误";
      if (message.includes("不存在")) {
        return this.createErrorResponse("LOG_FILE_NOT_FOUND", message);
      }
      if (message.includes("无法读取")) {
        return this.createErrorResponse("LOG_FILE_READ_ERROR", message);
      }

      return this.createErrorResponse(
        "INTERNAL_ERROR",
        "获取工具调用统计失败",
        {
          details: message,
        }
      );
    }
  }

  /**
   * 导出工具调用日志
   */
  async exportToolCallLogs(c: Context): Promise<Response> {
    try {
      const queryParams = this.parseQueryParams(c);
      const format =
        (c.req.query("format") as ExportFormat) || ExportFormat.JSON;

      if (!Object.values(ExportFormat).includes(format)) {
        return this.createErrorResponse(
          "INVALID_EXPORT_FORMAT",
          `不支持的导出格式: ${format}。支持的格式: ${Object.values(ExportFormat).join(", ")}`
        );
      }

      const validation = this.validateQueryParams(queryParams);
      if (!validation.isValid) {
        return this.createErrorResponse(
          "INVALID_QUERY_PARAMETERS",
          validation.error!
        );
      }

      const exportData = await this.toolCallLogService.exportToolCallLogs(
        queryParams,
        format
      );

      // 设置响应头
      const headers = new Headers();
      const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
      const filename = `tool-calls-${timestamp}.${format}`;

      headers.set(
        "Content-Type",
        format === ExportFormat.CSV ? "text/csv" : "application/json"
      );
      headers.set("Content-Disposition", `attachment; filename="${filename}"`);

      logger.debug(`API: 导出工具调用日志 (${format} 格式)`);
      return new Response(exportData, {
        status: 200,
        headers,
      });
    } catch (error) {
      logger.error("导出工具调用日志失败:", error);

      const message = error instanceof Error ? error.message : "未知错误";
      if (message.includes("不存在")) {
        return this.createErrorResponse("LOG_FILE_NOT_FOUND", message);
      }
      if (message.includes("无法读取") || message.includes("无法导出")) {
        return this.createErrorResponse("EXPORT_ERROR", message);
      }

      return this.createErrorResponse(
        "INTERNAL_ERROR",
        "导出工具调用日志失败",
        {
          details: message,
        }
      );
    }
  }

  /**
   * 清空工具调用日志
   */
  async clearToolCallLogs(c: Context): Promise<Response> {
    try {
      await this.toolCallLogService.clearToolCallLogs();

      logger.info("API: 工具调用日志已清空");
      return this.createSuccessResponse({ message: "工具调用日志已清空" });
    } catch (error) {
      logger.error("清空工具调用日志失败:", error);

      const message = error instanceof Error ? error.message : "未知错误";
      if (message.includes("不存在")) {
        return this.createErrorResponse("LOG_FILE_NOT_FOUND", message);
      }
      if (message.includes("无法清空")) {
        return this.createErrorResponse("CLEAR_ERROR", message);
      }

      return this.createErrorResponse(
        "INTERNAL_ERROR",
        "清空工具调用日志失败",
        {
          details: message,
        }
      );
    }
  }

  /**
   * 获取日志文件信息
   */
  async getLogFileInfo(c: Context): Promise<Response> {
    try {
      const fileInfo = await this.toolCallLogService.getLogFileInfo();

      logger.debug("API: 返回日志文件信息");
      return this.createSuccessResponse(fileInfo);
    } catch (error) {
      logger.error("获取日志文件信息失败:", error);

      const message = error instanceof Error ? error.message : "未知错误";
      if (message.includes("无法获取")) {
        return this.createErrorResponse("FILE_INFO_ERROR", message);
      }

      return this.createErrorResponse(
        "INTERNAL_ERROR",
        "获取日志文件信息失败",
        {
          details: message,
        }
      );
    }
  }
}

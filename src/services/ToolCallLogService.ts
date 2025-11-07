/**
 * 工具调用日志服务
 * 负责读取和解析 tool-calls.jsonl 文件数据
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { type Logger, logger } from "../Logger.js";
import { PathUtils } from "../cli/utils/PathUtils.js";
import {
  ToolCallLogger,
  type ToolCallRecord,
} from "../utils/ToolCallLogger.js";

// 查询参数接口
export interface ToolCallQuery {
  limit?: number;
  offset?: number;
  toolName?: string;
  serverName?: string;
  success?: boolean;
  startDate?: string;
  endDate?: string;
}

// 工具调用统计接口
export interface ToolCallStats {
  totalCalls: number;
  successfulCalls: number;
  failedCalls: number;
  averageDuration: number;
  mostUsedTools: Array<{
    toolName: string;
    count: number;
  }>;
  callsByServer: Array<{
    serverName: string;
    count: number;
  }>;
  recentCalls: ToolCallRecord[];
}

// 导出格式枚举
export enum ExportFormat {
  JSON = "json",
  CSV = "csv",
}

/**
 * 工具调用日志服务类
 */
export class ToolCallLogService {
  private logger: Logger;
  private configDir: string;

  constructor(configDir?: string) {
    this.logger = logger.withTag("ToolCallLogService");
    this.configDir = configDir || PathUtils.getConfigDir();
  }

  /**
   * 获取工具调用日志文件路径
   */
  private getLogFilePath(): string {
    const toolCallLogger = new ToolCallLogger({}, this.configDir);
    return toolCallLogger.getLogFilePath();
  }

  /**
   * 检查日志文件是否存在
   */
  private checkLogFile(): void {
    const logFilePath = this.getLogFilePath();
    if (!fs.existsSync(logFilePath)) {
      throw new Error("工具调用日志文件不存在");
    }
  }

  /**
   * 读取并解析工具调用日志
   */
  private parseLogFile(): ToolCallRecord[] {
    const logFilePath = this.getLogFilePath();

    try {
      const content = fs.readFileSync(logFilePath, "utf8");
      const lines = content
        .trim()
        .split("\n")
        .filter((line) => line.trim() !== "");

      const records: ToolCallRecord[] = [];

      for (const line of lines) {
        try {
          const record = JSON.parse(line);
          // 添加时间戳字段（如果 pino 添加了时间信息）
          if (record.time) {
            record.timestamp = new Date(record.time).getTime();
          }
          // 如果没有时间戳，使用当前时间
          if (!record.timestamp) {
            record.timestamp = Date.now();
          }
          records.push(record);
        } catch (error) {
          this.logger.warn("跳过无效的日志行:", line);
        }
      }

      // 按时间戳倒序排列（最新的在前）
      records.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));

      return records;
    } catch (error) {
      this.logger.error("读取日志文件失败:", error);
      throw new Error("无法读取工具调用日志文件");
    }
  }

  /**
   * 过滤工具调用记录
   */
  private filterRecords(
    records: ToolCallRecord[],
    query: ToolCallQuery
  ): ToolCallRecord[] {
    let filtered = [...records];

    // 按工具名称过滤
    if (query.toolName) {
      filtered = filtered.filter((record) =>
        record.toolName.toLowerCase().includes(query.toolName!.toLowerCase())
      );
    }

    // 按服务器名称过滤
    if (query.serverName) {
      filtered = filtered.filter((record) =>
        record.serverName
          ?.toLowerCase()
          .includes(query.serverName!.toLowerCase())
      );
    }

    // 按成功状态过滤
    if (query.success !== undefined) {
      filtered = filtered.filter((record) => record.success === query.success);
    }

    // 按时间范围过滤
    if (query.startDate || query.endDate) {
      const startTime = query.startDate
        ? new Date(query.startDate).getTime()
        : 0;
      const endTime = query.endDate
        ? new Date(query.endDate).getTime()
        : Date.now();

      filtered = filtered.filter((record) => {
        const recordTime = record.timestamp || 0;
        return recordTime >= startTime && recordTime <= endTime;
      });
    }

    return filtered;
  }

  /**
   * 获取工具调用日志
   */
  async getToolCallLogs(query: ToolCallQuery = {}): Promise<{
    records: ToolCallRecord[];
    total: number;
    hasMore: boolean;
  }> {
    this.checkLogFile();

    const records = this.parseLogFile();
    const filtered = this.filterRecords(records, query);
    const total = filtered.length;

    // 分页处理
    const limit = Math.min(query.limit || 50, 200); // 限制最大返回数量
    const offset = query.offset || 0;
    const paginated = filtered.slice(offset, offset + limit);
    const hasMore = offset + limit < total;

    this.logger.debug(`返回工具调用日志: ${paginated.length}/${total} 条记录`);

    return {
      records: paginated,
      total,
      hasMore,
    };
  }

  /**
   * 获取工具调用统计数据
   */
  async getToolCallStats(): Promise<ToolCallStats> {
    this.checkLogFile();

    const records = this.parseLogFile();
    const totalCalls = records.length;
    const successfulCalls = records.filter((r) => r.success).length;
    const failedCalls = totalCalls - successfulCalls;

    // 计算平均耗时
    const durationRecords = records.filter((r) => r.duration !== undefined);
    const averageDuration =
      durationRecords.length > 0
        ? durationRecords.reduce((sum, r) => sum + (r.duration || 0), 0) /
          durationRecords.length
        : 0;

    // 统计最常用工具
    const toolCounts = new Map<string, number>();
    for (const record of records) {
      const count = toolCounts.get(record.toolName) || 0;
      toolCounts.set(record.toolName, count + 1);
    }

    const mostUsedTools = Array.from(toolCounts.entries())
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([toolName, count]) => ({ toolName, count }));

    // 按服务器统计
    const serverCounts = new Map<string, number>();
    for (const record of records) {
      if (record.serverName) {
        const count = serverCounts.get(record.serverName) || 0;
        serverCounts.set(record.serverName, count + 1);
      }
    }

    const callsByServer = Array.from(serverCounts.entries())
      .sort(([, a], [, b]) => b - a)
      .map(([serverName, count]) => ({ serverName, count }));

    // 最近的调用记录
    const recentCalls = records.slice(0, 20);

    return {
      totalCalls,
      successfulCalls,
      failedCalls,
      averageDuration: Math.round(averageDuration * 100) / 100,
      mostUsedTools,
      callsByServer,
      recentCalls,
    };
  }

  /**
   * 导出工具调用日志
   */
  async exportToolCallLogs(
    query: ToolCallQuery = {},
    format: ExportFormat = ExportFormat.JSON
  ): Promise<string> {
    this.checkLogFile();

    const records = this.parseLogFile();
    const filtered = this.filterRecords(records, query);

    // 限制导出数量
    const limitedRecords = filtered.slice(0, 10000);

    if (format === ExportFormat.CSV) {
      return this.exportToCSV(limitedRecords);
    }
    return this.exportToJSON(limitedRecords);
  }

  /**
   * 导出为 JSON 格式
   */
  private exportToJSON(records: ToolCallRecord[]): string {
    return JSON.stringify(
      {
        exportedAt: new Date().toISOString(),
        totalRecords: records.length,
        records,
      },
      null,
      2
    );
  }

  /**
   * 导出为 CSV 格式
   */
  private exportToCSV(records: ToolCallRecord[]): string {
    const headers = [
      "Timestamp",
      "Tool Name",
      "Original Tool Name",
      "Server Name",
      "Success",
      "Duration (ms)",
      "Arguments",
      "Result",
      "Error",
    ];

    const rows = records.map((record) => [
      record.timestamp ? new Date(record.timestamp).toISOString() : "",
      record.toolName || "",
      record.originalToolName || "",
      record.serverName || "",
      record.success ? "true" : "false",
      record.duration?.toString() || "",
      JSON.stringify(record.arguments || {}),
      JSON.stringify(record.result || {}),
      record.error || "",
    ]);

    const csvContent = [headers, ...rows]
      .map((row) =>
        row.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(",")
      )
      .join("\n");

    return csvContent;
  }

  /**
   * 清空工具调用日志
   */
  async clearToolCallLogs(): Promise<void> {
    const logFilePath = this.getLogFilePath();

    try {
      if (fs.existsSync(logFilePath)) {
        fs.writeFileSync(logFilePath, "", "utf8");
        this.logger.info("工具调用日志已清空");
      } else {
        throw new Error("工具调用日志文件不存在");
      }
    } catch (error) {
      this.logger.error("清空工具调用日志失败:", error);
      throw new Error("无法清空工具调用日志");
    }
  }

  /**
   * 获取日志文件信息
   */
  async getLogFileInfo(): Promise<{
    exists: boolean;
    path: string;
    size: number;
    recordCount: number;
    lastModified: string | null;
  }> {
    const logFilePath = this.getLogFilePath();
    const exists = fs.existsSync(logFilePath);

    if (!exists) {
      return {
        exists: false,
        path: logFilePath,
        size: 0,
        recordCount: 0,
        lastModified: null,
      };
    }

    try {
      const stats = fs.statSync(logFilePath);
      const records = this.parseLogFile();

      return {
        exists: true,
        path: logFilePath,
        size: stats.size,
        recordCount: records.length,
        lastModified: stats.mtime.toISOString(),
      };
    } catch (error) {
      this.logger.error("获取日志文件信息失败:", error);
      throw new Error("无法获取日志文件信息");
    }
  }
}

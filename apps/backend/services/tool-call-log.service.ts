/**
 * 工具调用日志服务模块
 * 提供工具调用的写入和查询功能
 */

import * as fs from "node:fs";
import { ToolCallLogger } from "@/lib/mcp/log.js";
import type { ToolCallQuery, ToolCallRecord } from "@/lib/mcp/log.js";
import { PathUtils } from "@/utils/path-utils.js";

/**
 * 工具调用日志服务类
 * 负责读取和查询工具调用日志
 */
export class ToolCallLogService {
  private configDir: string;

  constructor(configDir?: string) {
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
          // 如果没有时间戳，记录警告信息提示数据质量问题
          if (!record.timestamp) {
            console.warn("日志记录缺少时间戳", { line });
          }
          records.push(record);
        } catch {
          console.warn("跳过无效的日志行", { line });
        }
      }

      // 按时间戳倒序排列（最新的在前）
      records.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));

      return records;
    } catch (error) {
      console.error("读取日志文件失败", { error });
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
        record.toolName
          .toLowerCase()
          .includes(query.toolName?.toLowerCase() ?? "")
      );
    }

    // 按服务器名称过滤
    if (query.serverName) {
      filtered = filtered.filter((record) =>
        record.serverName
          ?.toLowerCase()
          .includes(query.serverName?.toLowerCase() ?? "")
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
    const limit = Math.min(
      query.limit || 50,
      1000 // 最大限制 1000
    );
    const offset = query.offset || 0;
    const paginated = filtered.slice(offset, offset + limit);
    const hasMore = offset + limit < total;

    console.log("返回工具调用日志", {
      count: paginated.length,
      total,
    });

    return {
      records: paginated,
      total,
      hasMore,
    };
  }
}

// 重新导出类型定义
export type {
  ToolCallRecord,
  ToolCallQuery,
  ToolCallLogConfig,
} from "@/lib/mcp/log.js";

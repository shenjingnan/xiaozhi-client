/**
 * MCP 工具调用日志模块
 * 提供工具调用的写入和查询功能
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { logger } from "@/Logger.js";
import { PathUtils } from "@/utils/path-utils.js";
import pino from "pino";
import type { Logger as PinoLogger } from "pino";

// ==================== 类型定义 ====================

/**
 * Pino 日志对象类型（内部使用）
 * 用于 formatConsoleMessage 方法的参数类型
 */
interface PinoLogObject {
  toolName?: string;
  success?: boolean;
  duration?: number;
  [key: string]: unknown;
}

/**
 * 工具调用记录接口
 */
export interface ToolCallRecord {
  toolName: string; // 工具名称
  originalToolName?: string; // 原始工具名称（未格式化的）
  serverName?: string; // 服务器名称（coze、dify、n8n、custom等）
  arguments?: Record<string, unknown>; // 调用参数
  result?: unknown; // 响应结果
  success: boolean; // 是否成功
  duration?: number; // 调用耗时（毫秒）
  error?: string; // 错误信息（如果有）
  timestamp?: number; // 时间戳（毫秒）
}

/**
 * 工具调用日志配置接口
 */
export interface ToolCallLogConfig {
  maxRecords?: number; // 最大记录条数，默认 100
  logFilePath?: string; // 自定义日志文件路径（可选）
}

/**
 * 查询参数接口
 */
export interface ToolCallQuery {
  limit?: number;
  offset?: number;
  toolName?: string;
  serverName?: string;
  success?: boolean;
  startDate?: string;
  endDate?: string;
}

// ==================== ToolCallLogger 类（写入功能）====================

/**
 * MCP 工具调用记录器
 * 提供工具调用的 JSONL 格式记录功能
 */
export class ToolCallLogger {
  private pinoLogger: PinoLogger;
  private maxRecords: number;
  private logFilePath: string;

  constructor(config: ToolCallLogConfig, configDir: string) {
    this.maxRecords = config?.maxRecords ?? 100;

    // 确定日志文件路径 - 使用更健壮的路径处理
    if (config?.logFilePath) {
      this.logFilePath = path.resolve(path.normalize(config.logFilePath));
    } else {
      // 使用 PathUtils 的跨平台临时目录处理
      const baseDir = configDir || PathUtils.getTempDir();
      this.logFilePath = path.join(path.normalize(baseDir), "tool-calls.jsonl");
    }

    // 创建 Pino 实例
    this.pinoLogger = this.createPinoLogger(this.logFilePath);

    logger.info("ToolCallLogger 初始化", {
      maxRecords: this.maxRecords,
      path: this.logFilePath,
    });
  }

  /**
   * 创建 Pino Logger 实例
   */
  private createPinoLogger(logFilePath: string): PinoLogger {
    const streams: pino.StreamEntry[] = [];

    // 控制台流 - 使用彩色输出
    streams.push({
      level: "info",
      stream: {
        write: (chunk: string) => {
          try {
            const logObj = JSON.parse(chunk);
            const message = this.formatConsoleMessage(logObj);
            logger.info("[工具调用]", { message });
          } catch {
            logger.info("[工具调用]", { chunk: chunk.trim() });
          }
        },
      },
    });

    // 文件流 - JSONL 格式，带错误处理
    try {
      streams.push({
        level: "info",
        stream: pino.destination({
          dest: logFilePath,
          sync: true, // 同步写入确保测试可靠性
          append: true,
          mkdir: true,
        }),
      });
    } catch (error) {
      // 如果文件路径无效，记录错误但不抛出异常
      logger.error("无法创建工具调用日志文件", { error });
    }

    return pino(
      {
        level: "info",
        timestamp:
          pino.stdTimeFunctions?.isoTime || (() => `,"time":${Date.now()}`),
        formatters: {
          level: (_label: string, number: number) => ({ level: number }),
        },
        base: null, // 不包含 pid 和 hostname
      },
      pino.multistream(streams, { dedupe: true })
    );
  }

  /**
   * 格式化控制台消息
   */
  private formatConsoleMessage(logObj: PinoLogObject): string {
    const toolName = logObj.toolName || "未知工具";
    const success = logObj.success !== false;
    const duration = logObj.duration ? ` (${logObj.duration}ms)` : "";
    const status = success ? "✅" : "❌";

    return `${status} ${toolName}${duration}`;
  }

  /**
   * 清理旧的日志记录，确保不超过最大记录数量
   */
  private async cleanupOldRecords(): Promise<void> {
    try {
      // 检查日志文件是否存在
      if (!fs.existsSync(this.logFilePath)) {
        return;
      }

      // 读取文件内容
      const content = fs.readFileSync(this.logFilePath, "utf8");
      const lines = content
        .trim()
        .split("\n")
        .filter((line) => line.trim() !== "");

      // 如果记录数量未超过限制，直接返回
      if (lines.length <= this.maxRecords) {
        return;
      }

      // 计算需要删除的记录数量
      const recordsToRemove = lines.length - this.maxRecords + 1; // +1 为即将写入的新记录预留空间

      // 删除最旧的记录（从文件开头删除）
      const linesToKeep = lines.slice(recordsToRemove);

      // 重新写入文件
      const newContent =
        linesToKeep.join("\n") + (linesToKeep.length > 0 ? "\n" : "");
      fs.writeFileSync(this.logFilePath, newContent, "utf8");

      logger.info("已清理旧的工具调用记录", {
        recordsToRemove,
        maxRecords: this.maxRecords,
      });
    } catch (error) {
      logger.error("清理旧工具调用记录失败", { error });
    }
  }

  /**
   * 记录工具调用
   */
  async recordToolCall(record: ToolCallRecord): Promise<void> {
    try {
      // 在写入新记录前，先清理旧记录以确保不超过最大记录数量
      await this.cleanupOldRecords();

      // 使用 Pino 记录日志，自动处理并发和文件写入
      this.pinoLogger.info(record, record.toolName);
    } catch (error) {
      // 记录失败不应该影响主流程，只记录错误日志
      logger.error("记录工具调用失败", { error });
    }
  }

  /**
   * 获取日志文件路径
   */
  getLogFilePath(): string {
    return this.logFilePath;
  }

  /**
   * 获取最大记录数量
   */
  getMaxRecords(): number {
    return this.maxRecords;
  }
}

// ==================== ToolCallLogService 类（查询功能）====================

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
            logger.warn("日志记录缺少时间戳", { line });
          }
          records.push(record);
        } catch {
          logger.warn("跳过无效的日志行", { line });
        }
      }

      // 按时间戳倒序排列（最新的在前）
      records.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));

      return records;
    } catch (error) {
      logger.error("读取日志文件失败", { error });
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

    logger.info("返回工具调用日志", {
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

/**
 * MCP 工具调用记录模块
 * 负责将 MCP 工具调用记录单独保存为 JSON 文件
 */

import * as fs from "node:fs";
import * as path from "node:path";
import pino from "pino";
import type { Logger as PinoLogger } from "pino";
import { logger } from "../Logger.js";

// 工具调用记录接口
export interface ToolCallRecord {
  toolName: string; // 工具名称
  originalToolName?: string; // 原始工具名称（未格式化的）
  serverName?: string; // 服务器名称（coze、dify、n8n、custom等）
  arguments?: any; // 调用参数
  result?: any; // 响应结果
  success: boolean; // 是否成功
  duration?: number; // 调用耗时（毫秒）
  error?: string; // 错误信息（如果有）
}

// 工具调用日志配置接口
export interface ToolCallLogConfig {
  enabled?: boolean; // 是否启用工具调用记录，默认 false
  maxRecords?: number; // 最大记录条数，默认 100
  logFilePath?: string; // 自定义日志文件路径（可选）
}

/**
 * MCP 工具调用记录器
 * 提供工具调用的 JSON 格式记录功能
 */
export class ToolCallLogger {
  private pinoLogger: PinoLogger;
  private enabled: boolean;
  private maxRecords: number;
  private logFilePath: string;

  constructor(config: ToolCallLogConfig, configDir: string) {
    this.enabled = config.enabled ?? false;
    this.maxRecords = config.maxRecords ?? 100;

    // 确定日志文件路径
    this.logFilePath =
      config.logFilePath || path.join(configDir, "tool-calls.log.json");

    // 创建 Pino 实例
    this.pinoLogger = this.createPinoLogger(this.logFilePath);

    logger.debug(
      `ToolCallLogger 初始化: enabled=${this.enabled}, maxRecords=${this.maxRecords}, path=${this.logFilePath}`
    );
  }

  /**
   * 创建 Pino Logger 实例
   */
  private createPinoLogger(logFilePath: string): PinoLogger {
    const streams: pino.StreamEntry[] = [];

    if (this.enabled) {
      // 控制台流 - 使用彩色输出
      streams.push({
        level: "info",
        stream: {
          write: (chunk: string) => {
            try {
              const logObj = JSON.parse(chunk);
              const message = this.formatConsoleMessage(logObj);
              logger.info(`[工具调用] ${message}`);
            } catch (error) {
              logger.info(`[工具调用] ${chunk.trim()}`);
            }
          },
        },
      });

      // 文件流 - JSON 格式，带错误处理
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
        logger.error("无法创建工具调用日志文件:", error);
      }
    }

    // 如果没有可用的流，创建一个空的流
    if (streams.length === 0) {
      streams.push({
        level: "info",
        stream: pino.destination({ dest: "/dev/null" }),
      });
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
  private formatConsoleMessage(logObj: any): string {
    const toolName = logObj.toolName || "未知工具";
    const success = logObj.success !== false;
    const duration = logObj.duration ? ` (${logObj.duration}ms)` : "";
    const status = success ? "✅" : "❌";

    return `${status} ${toolName}${duration}`;
  }

  /**
   * 记录工具调用
   * @param record 工具调用记录
   */
  async recordToolCall(record: ToolCallRecord): Promise<void> {
    // 如果未启用，直接返回
    if (!this.enabled) {
      return;
    }

    try {
      // 直接使用 Pino 记录日志，自动处理并发和文件写入
      this.pinoLogger.info(record, record.toolName);
    } catch (error) {
      logger.warn("记录工具调用失败:", error);
    }
  }

  /**
   * 检查是否启用
   */
  isEnabled(): boolean {
    return this.enabled;
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

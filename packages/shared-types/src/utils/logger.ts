/**
 * 日志相关类型定义
 */

/**
 * 工具调用记录接口
 */
export interface ToolCallRecord {
  toolName: string; // 工具名称
  originalToolName?: string; // 原始工具名称（未格式化的）
  serverName?: string; // 服务器名称（coze、dify、n8n、custom等）
  arguments?: unknown; // 调用参数
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
 * 日志级别枚举
 */
export enum LogLevel {
  TRACE = "trace",
  DEBUG = "debug",
  INFO = "info",
  WARN = "warn",
  ERROR = "error",
  FATAL = "fatal",
}

/**
 * 日志配置接口
 */
export interface LogConfig {
  /** 日志级别 */
  level?: LogLevel;
  /** 是否启用彩色输出 */
  colorize?: boolean;
  /** 是否启用时间戳 */
  timestamp?: boolean;
  /** 日志格式 */
  format?: "json" | "pretty";
  /** 日志输出路径 */
  outputPath?: string;
  /** 是否同时输出到文件和控制台 */
  both?: boolean;
}

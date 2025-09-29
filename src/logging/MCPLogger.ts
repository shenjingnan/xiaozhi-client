#!/usr/bin/env node

/**
 * MCP服务日志记录工具
 * 提供统一的日志格式和结构化日志记录
 */

import { type Logger, logger } from "../Logger.js";
import { ErrorSeverity, MCPError } from "../errors/MCPErrors.js";

/**
 * 日志级别枚举
 */
export enum LogLevel {
  DEBUG = "debug",
  INFO = "info",
  WARN = "warn",
  ERROR = "error",
}

/**
 * 日志上下文接口
 */
export interface LogContext {
  operation?: string;
  serverName?: string;
  serviceName?: string;
  userId?: string;
  requestId?: string;
  duration?: number;
  [key: string]: any;
}

/**
 * 结构化日志条目接口
 */
export interface StructuredLogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  context: LogContext;
  error?: {
    code: string;
    message: string;
    stack?: string;
    severity: string;
  };
  metadata?: {
    [key: string]: any;
  };
}

/**
 * 日志格式化器接口
 */
export interface LogFormatter {
  format(entry: StructuredLogEntry): string;
}

/**
 * JSON格式化器
 */
export class JSONFormatter implements LogFormatter {
  format(entry: StructuredLogEntry): string {
    return JSON.stringify(entry);
  }
}

/**
 * 可读文本格式化器
 */
export class TextFormatter implements LogFormatter {
  format(entry: StructuredLogEntry): string {
    const { timestamp, level, message, context, error, metadata } = entry;

    let formatted = `[${timestamp}] [${level.toUpperCase()}] ${message}`;

    // 添加上下文信息
    if (Object.keys(context).length > 0) {
      const contextStr = Object.entries(context)
        .map(([key, value]) => `${key}=${JSON.stringify(value)}`)
        .join(" ");
      formatted += ` ${contextStr}`;
    }

    // 添加错误信息
    if (error) {
      formatted += ` Error: ${error.code} - ${error.message}`;
      if (error.stack) {
        formatted += `\nStack: ${error.stack}`;
      }
    }

    // 添加元数据
    if (metadata && Object.keys(metadata).length > 0) {
      formatted += ` Metadata: ${JSON.stringify(metadata)}`;
    }

    return formatted;
  }
}

/**
 * MCP服务日志记录器
 */
export class MCPLogger {
  private logger: Logger;
  private formatter: LogFormatter;
  private context: LogContext = {};

  constructor(
    baseLogger: Logger = logger,
    formatter: LogFormatter = new TextFormatter()
  ) {
    this.logger = baseLogger;
    this.formatter = formatter;
  }

  /**
   * 创建带上下文的子日志记录器
   */
  withContext(context: LogContext): MCPLogger {
    const child = new MCPLogger(this.logger, this.formatter);
    child.context = { ...this.context, ...context };
    return child;
  }

  /**
   * 创建带标签的日志记录器
   */
  withTag(tag: string): MCPLogger {
    return this.withContext({ tag });
  }

  /**
   * 记录调试日志
   */
  debug(message: string, context: LogContext = {}, metadata?: any): void {
    this.log(LogLevel.DEBUG, message, context, metadata);
  }

  /**
   * 记录信息日志
   */
  info(message: string, context: LogContext = {}, metadata?: any): void {
    this.log(LogLevel.INFO, message, context, metadata);
  }

  /**
   * 记录警告日志
   */
  warn(message: string, context: LogContext = {}, metadata?: any): void {
    this.log(LogLevel.WARN, message, context, metadata);
  }

  /**
   * 记录错误日志
   */
  error(message: string, context: LogContext = {}, metadata?: any): void {
    this.log(LogLevel.ERROR, message, context, metadata);
  }

  /**
   * 记录MCP错误
   */
  logMCPError(error: MCPError, context: LogContext = {}): void {
    this.log(
      LogLevel.ERROR,
      error.message,
      {
        ...context,
        errorCode: error.code,
        errorSeverity: error.severity,
        errorCategory: error.category,
      },
      {
        errorDetails: error.details,
        stack: error.stack,
      }
    );
  }

  /**
   * 记录操作开始
   */
  logOperationStart(operation: string, context: LogContext = {}): void {
    this.info(
      `操作开始: ${operation}`,
      {
        ...context,
        operation,
        operationPhase: "start",
      },
      {
        startTime: Date.now(),
      }
    );
  }

  /**
   * 记录操作成功
   */
  logOperationSuccess(
    operation: string,
    context: LogContext = {},
    metadata?: any
  ): void {
    this.info(
      `操作成功: ${operation}`,
      {
        ...context,
        operation,
        operationPhase: "success",
      },
      {
        ...metadata,
        endTime: Date.now(),
      }
    );
  }

  /**
   * 记录操作失败
   */
  logOperationFailure(
    operation: string,
    error: Error | MCPError,
    context: LogContext = {},
    metadata?: any
  ): void {
    const logError =
      error instanceof MCPError ? error : MCPError.fromError(error);

    this.error(
      `操作失败: ${operation}`,
      {
        ...context,
        operation,
        operationPhase: "failure",
        errorCode: logError.code,
        errorSeverity: logError.severity,
      },
      {
        ...metadata,
        endTime: Date.now(),
        error: logError.toJSON(),
      }
    );
  }

  /**
   * 记录API请求
   */
  logAPIRequest(
    method: string,
    path: string,
    context: LogContext = {},
    metadata?: any
  ): void {
    this.info(
      `API请求: ${method} ${path}`,
      {
        ...context,
        method,
        path,
        type: "api_request",
      },
      metadata
    );
  }

  /**
   * 记录API响应
   */
  logAPIResponse(
    method: string,
    path: string,
    statusCode: number,
    duration: number,
    context: LogContext = {},
    metadata?: any
  ): void {
    this.info(
      `API响应: ${method} ${path} - ${statusCode} (${duration}ms)`,
      {
        ...context,
        method,
        path,
        statusCode,
        duration,
        type: "api_response",
      },
      metadata
    );
  }

  /**
   * 记录服务状态变化
   */
  logServiceStatusChange(
    serviceName: string,
    oldStatus: string,
    newStatus: string,
    context: LogContext = {},
    metadata?: any
  ): void {
    this.info(
      `服务状态变化: ${serviceName} ${oldStatus} -> ${newStatus}`,
      {
        ...context,
        serviceName,
        oldStatus,
        newStatus,
        type: "service_status_change",
      },
      metadata
    );
  }

  /**
   * 记录工具同步事件
   */
  logToolSync(
    action: string,
    serviceName: string,
    toolCount: number,
    context: LogContext = {},
    metadata?: any
  ): void {
    this.info(
      `工具同步: ${action} - ${serviceName} (${toolCount} 工具)`,
      {
        ...context,
        action,
        serviceName,
        toolCount,
        type: "tool_sync",
      },
      metadata
    );
  }

  /**
   * 内部日志记录方法
   */
  private log(
    level: LogLevel,
    message: string,
    additionalContext: LogContext = {},
    metadata?: any
  ): void {
    const entry: StructuredLogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      context: {
        ...this.context,
        ...additionalContext,
      },
      metadata,
    };

    const formattedMessage = this.formatter.format(entry);

    // 根据级别调用底层日志记录器
    switch (level) {
      case LogLevel.DEBUG:
        this.logger.debug(formattedMessage);
        break;
      case LogLevel.INFO:
        this.logger.info(formattedMessage);
        break;
      case LogLevel.WARN:
        this.logger.warn(formattedMessage);
        break;
      case LogLevel.ERROR:
        this.logger.error(formattedMessage);
        break;
    }
  }
}

/**
 * 创建默认的MCP日志记录器
 */
export function createMCPLogger(tag?: string): MCPLogger {
  const baseLogger = tag ? logger.withTag(tag) : logger;
  return new MCPLogger(baseLogger);
}

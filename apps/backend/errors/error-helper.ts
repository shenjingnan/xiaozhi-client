/**
 * MCP 错误处理辅助工具模块
 *
 * 本模块提供 MCP 服务错误处理的核心类型定义和工具函数，包括：
 *
 * - **错误分类**：通过 ErrorCategory 枚举对错误进行分类
 * - **恢复策略**：定义错误的恢复策略（重试、重连等）
 * - **错误创建**：统一的错误创建工厂函数
 * - **错误判断**：判断错误是否可恢复的工具函数
 * - **错误格式化**：将错误格式化为用户友好的消息
 * - **错误统计**：跟踪和统计错误历史记录
 *
 * @example
 * ```typescript
 * // 推荐：通过错误模块入口以命名空间方式导入，避免与 mcp-errors 命名冲突
 * import * as ErrorHelper from "@/errors/index.js";
 *
 * const error = ErrorHelper.categorizeError(
 *   new Error("Connection failed"),
 *   "my-service"
 * );
 * // error.category === ErrorHelper.ErrorCategory.CONNECTION
 * // error.recoverable === true
 * // error.recoveryStrategy === ErrorHelper.RecoveryStrategy.RECONNECT
 * ```
 */

import type { Logger } from "@/Logger.js";
import { logger } from "@/Logger.js";

/**
 * 错误分类枚举
 */
export enum ErrorCategory {
  CONNECTION = "connection",
  TRANSPORT = "transport",
  TOOL_CALL = "tool_call",
  CONFIGURATION = "configuration",
  TIMEOUT = "timeout",
  AUTHENTICATION = "authentication",
  NETWORK = "network",
  UNKNOWN = "unknown",
  // 以下值用于向后兼容 mcp-errors.ts 中的原有枚举值
  VALIDATION = "validation",
  OPERATION = "operation",
  SYSTEM = "system",
  EXTERNAL = "external",
}

/**
 * 恢复策略枚举
 */
export enum RecoveryStrategy {
  RETRY = "retry",
  RECONNECT = "reconnect",
  RESTART_SERVICE = "restart_service",
  IGNORE = "ignore",
  MANUAL_INTERVENTION = "manual_intervention",
}

/**
 * 错误上下文基础类型
 * 所有错误上下文都应使用此类型，而非 any
 */
export type ErrorContext = Record<string, unknown>;

/**
 * MCP 错误接口
 */
export interface MCPError {
  category: ErrorCategory;
  code: string;
  message: string;
  serviceName: string;
  timestamp: Date;
  recoverable: boolean;
  recoveryStrategy: RecoveryStrategy;
  originalError?: Error;
  context?: ErrorContext;
}

/**
 * 错误统计接口
 */
export interface ErrorStatistics {
  serviceName: string;
  totalErrors: number;
  errorsByCategory: Map<ErrorCategory, number>;
  errorsByCode: Map<string, number>;
  lastError?: MCPError;
  errorRate: number; // 错误率（过去1小时）
}

// 错误历史存储
const errorHistory: Map<string, MCPError[]> = new Map();
const MAX_ERROR_HISTORY = 100;

function getLogger(): Logger {
  return logger;
}

/**
 * 分类错误
 */
export function categorizeError(
  error: Error,
  serviceName: string,
  context?: ErrorContext
): MCPError {
  const timestamp = new Date();
  const message = error.message.toLowerCase();

  let category = ErrorCategory.UNKNOWN;
  let code = "UNKNOWN_ERROR";
  let recoverable = false;
  let recoveryStrategy = RecoveryStrategy.MANUAL_INTERVENTION;

  // 连接相关错误
  if (
    message.includes("connection") ||
    message.includes("connect") ||
    message.includes("econnrefused") ||
    message.includes("enotfound")
  ) {
    category = ErrorCategory.CONNECTION;
    code = "CONNECTION_FAILED";
    recoverable = true;
    recoveryStrategy = RecoveryStrategy.RECONNECT;
  }
  // 传输层错误
  else if (
    message.includes("transport") ||
    message.includes("stdio") ||
    message.includes("sse") ||
    message.includes("http")
  ) {
    category = ErrorCategory.TRANSPORT;
    code = "TRANSPORT_ERROR";
    recoverable = true;
    recoveryStrategy = RecoveryStrategy.RESTART_SERVICE;
  }
  // 工具调用错误
  else if (
    message.includes("tool") ||
    message.includes("method not found") ||
    message.includes("invalid params")
  ) {
    category = ErrorCategory.TOOL_CALL;
    code = "TOOL_CALL_ERROR";
    recoverable = true;
    recoveryStrategy = RecoveryStrategy.RETRY;
  }
  // 配置错误
  else if (
    message.includes("config") ||
    message.includes("invalid") ||
    message.includes("missing")
  ) {
    category = ErrorCategory.CONFIGURATION;
    code = "CONFIG_ERROR";
    recoverable = false;
    recoveryStrategy = RecoveryStrategy.MANUAL_INTERVENTION;
  }
  // 超时错误
  else if (message.includes("timeout") || message.includes("timed out")) {
    category = ErrorCategory.TIMEOUT;
    code = "TIMEOUT_ERROR";
    recoverable = true;
    recoveryStrategy = RecoveryStrategy.RETRY;
  }
  // 认证错误
  else if (
    message.includes("auth") ||
    message.includes("unauthorized") ||
    message.includes("forbidden")
  ) {
    category = ErrorCategory.AUTHENTICATION;
    code = "AUTH_ERROR";
    recoverable = false;
    recoveryStrategy = RecoveryStrategy.MANUAL_INTERVENTION;
  }
  // 网络错误
  else if (
    message.includes("network") ||
    message.includes("fetch") ||
    message.includes("request failed")
  ) {
    category = ErrorCategory.NETWORK;
    code = "NETWORK_ERROR";
    recoverable = true;
    recoveryStrategy = RecoveryStrategy.RETRY;
  }

  const mcpError: MCPError = {
    category,
    code,
    message: error.message,
    serviceName,
    timestamp,
    recoverable,
    recoveryStrategy,
    originalError: error,
    context,
  };

  // 记录错误历史
  recordError(serviceName, mcpError);

  return mcpError;
}

/**
 * 获取恢复策略
 */
export function getRecoveryStrategy(error: MCPError): RecoveryStrategy {
  return error.recoveryStrategy;
}

/**
 * 格式化用户友好的错误消息
 */
export function formatUserFriendlyMessage(error: MCPError): string {
  const baseMessage = `服务 ${error.serviceName} 发生错误`;

  switch (error.category) {
    case ErrorCategory.CONNECTION:
      return `${baseMessage}：连接失败，正在尝试重新连接...`;
    case ErrorCategory.TRANSPORT:
      return `${baseMessage}：通信异常，正在重启服务...`;
    case ErrorCategory.TOOL_CALL:
      return `${baseMessage}：工具调用失败，请检查参数后重试`;
    case ErrorCategory.CONFIGURATION:
      return `${baseMessage}：配置错误，请检查服务配置`;
    case ErrorCategory.TIMEOUT:
      return `${baseMessage}：请求超时，正在重试...`;
    case ErrorCategory.AUTHENTICATION:
      return `${baseMessage}：认证失败，请检查 API 密钥`;
    case ErrorCategory.NETWORK:
      return `${baseMessage}：网络异常，正在重试...`;
    default:
      return `${baseMessage}：${error.message}`;
  }
}

/**
 * 记录错误历史
 */
function recordError(serviceName: string, error: MCPError): void {
  if (!errorHistory.has(serviceName)) {
    errorHistory.set(serviceName, []);
  }

  const errors = errorHistory.get(serviceName)!;
  errors.push(error);

  // 限制历史记录数量
  if (errors.length > MAX_ERROR_HISTORY) {
    errors.shift();
  }

  getLogger().debug(
    `[ErrorHandler] 记录错误历史: ${serviceName} - ${error.code}`
  );
}

/**
 * 获取错误统计
 */
export function getErrorStatistics(serviceName: string): ErrorStatistics {
  const errors = errorHistory.get(serviceName) || [];
  const now = Date.now();
  const oneHourAgo = now - 60 * 60 * 1000;

  // 计算过去1小时的错误
  const recentErrors = errors.filter(
    (error) => error.timestamp.getTime() > oneHourAgo
  );

  const errorsByCategory = new Map<ErrorCategory, number>();
  const errorsByCode = new Map<string, number>();

  for (const error of errors) {
    errorsByCategory.set(
      error.category,
      (errorsByCategory.get(error.category) || 0) + 1
    );
    errorsByCode.set(error.code, (errorsByCode.get(error.code) || 0) + 1);
  }

  return {
    serviceName,
    totalErrors: errors.length,
    errorsByCategory,
    errorsByCode,
    lastError: errors[errors.length - 1],
    errorRate: recentErrors.length, // 过去1小时的错误数量
  };
}

/**
 * 获取所有服务的错误统计
 */
export function getAllErrorStatistics(): Map<string, ErrorStatistics> {
  const statistics = new Map<string, ErrorStatistics>();

  for (const serviceName of errorHistory.keys()) {
    statistics.set(serviceName, getErrorStatistics(serviceName));
  }

  return statistics;
}

/**
 * 清理错误历史
 */
export function clearErrorHistory(serviceName?: string): void {
  if (serviceName) {
    errorHistory.delete(serviceName);
    getLogger().info(`[ErrorHandler] 已清理服务 ${serviceName} 的错误历史`);
  } else {
    errorHistory.clear();
    getLogger().info("[ErrorHandler] 已清理所有错误历史");
  }
}

/**
 * 判断错误是否可恢复
 */
export function isRecoverable(error: MCPError): boolean {
  return error.recoverable;
}

/**
 * 判断错误是否应该触发告警
 */
export function shouldAlert(error: MCPError): boolean {
  const statistics = getErrorStatistics(error.serviceName);

  // 如果错误率过高，触发告警
  if (statistics.errorRate > 10) {
    return true;
  }

  // 如果是不可恢复的错误，触发告警
  if (!error.recoverable) {
    return true;
  }

  // 如果是认证或配置错误，触发告警
  if (
    error.category === ErrorCategory.AUTHENTICATION ||
    error.category === ErrorCategory.CONFIGURATION
  ) {
    return true;
  }

  return false;
}

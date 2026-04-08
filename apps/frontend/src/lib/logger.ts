/**
 * 前端统一日志工具
 * 提供结构化的日志记录功能，支持不同日志级别
 */

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
 * 日志配置接口
 */
export interface LoggerConfig {
  /** 日志级别 */
  level?: LogLevel;
  /** 是否启用日志 */
  enabled?: boolean;
  /** 日志前缀 */
  prefix?: string;
}

/**
 * Logger 类
 */
class Logger {
  private config: Required<LoggerConfig>;

  constructor(config: LoggerConfig = {}) {
    this.config = {
      level: config.level ?? LogLevel.INFO,
      enabled: config.enabled ?? true,
      prefix: config.prefix ?? "",
    };
  }

  /**
   * 设置日志级别
   */
  setLevel(level: LogLevel): void {
    this.config.level = level;
  }

  /**
   * 启用/禁用日志
   */
  setEnabled(enabled: boolean): void {
    this.config.enabled = enabled;
  }

  /**
   * 检查是否应该记录该级别的日志
   */
  private shouldLog(level: LogLevel): boolean {
    if (!this.config.enabled) {
      return false;
    }

    const levels = [
      LogLevel.DEBUG,
      LogLevel.INFO,
      LogLevel.WARN,
      LogLevel.ERROR,
    ];
    const currentLevelIndex = levels.indexOf(this.config.level);
    const logLevelIndex = levels.indexOf(level);

    return logLevelIndex >= currentLevelIndex;
  }

  /**
   * 格式化日志消息
   */
  private formatMessage(level: LogLevel, message: string): string {
    const timestamp = new Date().toISOString();
    const prefix = this.config.prefix ? `[${this.config.prefix}] ` : "";
    return `${timestamp} ${prefix}${level.toUpperCase()}: ${message}`;
  }

  /**
   * 记录 DEBUG 级别日志
   */
  debug(message: string, ...args: unknown[]): void {
    if (this.shouldLog(LogLevel.DEBUG)) {
      console.debug(this.formatMessage(LogLevel.DEBUG, message), ...args);
    }
  }

  /**
   * 记录 INFO 级别日志
   */
  info(message: string, ...args: unknown[]): void {
    if (this.shouldLog(LogLevel.INFO)) {
      console.info(this.formatMessage(LogLevel.INFO, message), ...args);
    }
  }

  /**
   * 记录 WARN 级别日志
   */
  warn(message: string, ...args: unknown[]): void {
    if (this.shouldLog(LogLevel.WARN)) {
      console.warn(this.formatMessage(LogLevel.WARN, message), ...args);
    }
  }

  /**
   * 记录 ERROR 级别日志
   */
  error(message: string, error?: Error | unknown, ...args: unknown[]): void {
    if (this.shouldLog(LogLevel.ERROR)) {
      console.error(
        this.formatMessage(LogLevel.ERROR, message),
        error,
        ...args
      );
    }
  }
}

/**
 * 创建带有指定前缀的 Logger 实例
 */
export function createLogger(prefix: string): Logger {
  return new Logger({ prefix });
}

/**
 * 默认的全局 Logger 实例
 */
export const logger = new Logger();

/**
 * 设置全局日志级别
 */
export function setGlobalLogLevel(level: LogLevel): void {
  logger.setLevel(level);
}

/**
 * 启用/禁用全局日志
 */
export function setGlobalLoggerEnabled(enabled: boolean): void {
  logger.setEnabled(enabled);
}

/**
 * 轻量级日志工具
 *
 * 为 mcp-core 包提供简单统一的日志输出接口
 * 保持轻量级，不引入外部依赖
 *
 * @module utils/logger
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
 * 轻量级日志类
 */
class Logger {
  private context: string;

  constructor(context: string) {
    this.context = context;
  }

  /**
   * 格式化日志消息
   */
  private formatMessage(level: LogLevel, message: string): string {
    const timestamp = new Date().toISOString();
    return `[${timestamp}] [${level.toUpperCase()}] [${this.context}] ${message}`;
  }

  /**
   * 输出调试日志
   */
  debug(message: string, ...args: unknown[]): void {
    if (this.shouldLog(LogLevel.DEBUG)) {
      const formatted = this.formatMessage(LogLevel.DEBUG, message);
      // eslint-disable-next-line no-console
      console.debug(formatted, ...args);
    }
  }

  /**
   * 输出信息日志
   */
  info(message: string, ...args: unknown[]): void {
    if (this.shouldLog(LogLevel.INFO)) {
      const formatted = this.formatMessage(LogLevel.INFO, message);
      // eslint-disable-next-line no-console
      console.info(formatted, ...args);
    }
  }

  /**
   * 输出警告日志
   */
  warn(message: string, ...args: unknown[]): void {
    if (this.shouldLog(LogLevel.WARN)) {
      const formatted = this.formatMessage(LogLevel.WARN, message);
      // eslint-disable-next-line no-console
      console.warn(formatted, ...args);
    }
  }

  /**
   * 输出错误日志
   */
  error(message: string, ...args: unknown[]): void {
    if (this.shouldLog(LogLevel.ERROR)) {
      const formatted = this.formatMessage(LogLevel.ERROR, message);
      // eslint-disable-next-line no-console
      console.error(formatted, ...args);
    }
  }

  /**
   * 判断是否应该输出日志
   * 通过环境变量 XIAOZHI_LOG_LEVEL 控制日志级别
   */
  private shouldLog(level: LogLevel): boolean {
    const envLevel = (process.env.XIAOZHI_LOG_LEVEL || "info").toLowerCase();
    const levels = [
      LogLevel.DEBUG,
      LogLevel.INFO,
      LogLevel.WARN,
      LogLevel.ERROR,
    ];
    return levels.indexOf(level) >= levels.indexOf(envLevel as LogLevel);
  }
}

/**
 * 创建带上下文的日志实例
 * @param context 上下文标识
 * @returns Logger 实例
 */
export function createLogger(context: string): Logger {
  return new Logger(context);
}

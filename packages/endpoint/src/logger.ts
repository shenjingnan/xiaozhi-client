/**
 * Logger 类
 * 简单的日志记录器，支持不同日志级别
 *
 * 设计原则：
 * - 简单实用，不过度设计
 * - 支持不同日志级别（debug, info, warn, error）
 * - 可配置日志级别
 * - 保持包的独立性
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
 * 日志级别权重，用于比较
 */
const LOG_LEVEL_WEIGHTS: Record<LogLevel, number> = {
  [LogLevel.DEBUG]: 0,
  [LogLevel.INFO]: 1,
  [LogLevel.WARN]: 2,
  [LogLevel.ERROR]: 3,
};

/**
 * Logger 类
 * 提供统一的日志记录接口
 */
export class Logger {
  private context: string;
  private level: LogLevel;

  /**
   * 构造函数
   * @param context 日志上下文（通常是类名或模块名）
   * @param level 日志级别，默认为 INFO
   */
  constructor(context: string, level: LogLevel = LogLevel.INFO) {
    this.context = context;
    this.level = level;
  }

  /**
   * 设置日志级别
   * @param level 新的日志级别
   */
  setLevel(level: LogLevel): void {
    this.level = level;
  }

  /**
   * 获取当前日志级别
   * @returns 当前日志级别
   */
  getLevel(): LogLevel {
    return this.level;
  }

  /**
   * 检查是否应该记录该级别的日志
   * @param level 日志级别
   * @returns 是否应该记录
   */
  private shouldLog(level: LogLevel): boolean {
    return LOG_LEVEL_WEIGHTS[level] >= LOG_LEVEL_WEIGHTS[this.level];
  }

  /**
   * 格式化日志消息
   * @param level 日志级别
   * @param message 消息内容
   * @param args 额外参数
   * @returns 格式化后的消息
   */
  private formatMessage(level: LogLevel, message: string, ...args: unknown[]): string {
    const timestamp = new Date().toISOString();
    const prefix = `[${timestamp}] [${level.toUpperCase()}] [${this.context}]`;
    return `${prefix} ${message}`;
  }

  /**
   * 记录 DEBUG 级别日志
   * @param message 消息内容
   * @param args 额外参数
   */
  debug(message: string, ...args: unknown[]): void {
    if (this.shouldLog(LogLevel.DEBUG)) {
      const formatted = this.formatMessage(LogLevel.DEBUG, message);
      console.debug(formatted, ...args);
    }
  }

  /**
   * 记录 INFO 级别日志
   * @param message 消息内容
   * @param args 额外参数
   */
  info(message: string, ...args: unknown[]): void {
    if (this.shouldLog(LogLevel.INFO)) {
      const formatted = this.formatMessage(LogLevel.INFO, message);
      console.info(formatted, ...args);
    }
  }

  /**
   * 记录 WARN 级别日志
   * @param message 消息内容
   * @param args 额外参数
   */
  warn(message: string, ...args: unknown[]): void {
    if (this.shouldLog(LogLevel.WARN)) {
      const formatted = this.formatMessage(LogLevel.WARN, message);
      console.warn(formatted, ...args);
    }
  }

  /**
   * 记录 ERROR 级别日志
   * @param message 消息内容
   * @param args 额外参数
   */
  error(message: string, ...args: unknown[]): void {
    if (this.shouldLog(LogLevel.ERROR)) {
      const formatted = this.formatMessage(LogLevel.ERROR, message);
      console.error(formatted, ...args);
    }
  }
}

/**
 * 创建 Logger 实例的工厂函数
 * @param context 日志上下文
 * @param level 日志级别
 * @returns Logger 实例
 */
export function createLogger(context: string, level?: LogLevel): Logger {
  return new Logger(context, level);
}

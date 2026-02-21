/**
 * Logger 工具模块
 * 提供统一的日志输出接口，支持日志级别控制
 */

/**
 * 日志级别枚举
 */
export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
}

/**
 * Logger 类
 */
export class Logger {
  private level: LogLevel;
  private prefix: string;

  /**
   * 构造函数
   * @param prefix - 日志前缀
   * @param level - 日志级别，默认 INFO
   */
  constructor(prefix = "", level: LogLevel = LogLevel.INFO) {
    this.prefix = prefix;
    this.level = level;
  }

  /**
   * 设置日志级别
   */
  setLevel(level: LogLevel): void {
    this.level = level;
  }

  /**
   * 输出调试级别日志
   */
  debug(...args: unknown[]): void {
    if (this.level <= LogLevel.DEBUG) {
      console.debug(`[${this.prefix}]`, ...args);
    }
  }

  /**
   * 输出信息级别日志
   */
  info(...args: unknown[]): void {
    if (this.level <= LogLevel.INFO) {
      console.info(`[${this.prefix}]`, ...args);
    }
  }

  /**
   * 输出警告级别日志
   */
  warn(...args: unknown[]): void {
    if (this.level <= LogLevel.WARN) {
      console.warn(`[${this.prefix}]`, ...args);
    }
  }

  /**
   * 输出错误级别日志
   */
  error(...args: unknown[]): void {
    if (this.level <= LogLevel.ERROR) {
      console.error(`[${this.prefix}]`, ...args);
    }
  }
}

/**
 * 默认 logger 实例
 */
export const logger = new Logger("Endpoint");

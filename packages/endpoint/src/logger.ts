/**
 * Endpoint Logger 工具
 *
 * 提供统一的日志记录功能，支持日志级别过滤和前缀标识。
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
 *
 * 提供带日志级别过滤的日志记录功能。
 */
export class Logger {
  private level: LogLevel;
  private prefix: string;

  /**
   * 构造函数
   *
   * @param prefix - 日志前缀
   * @param level - 日志级别，默认为 INFO
   */
  constructor(prefix = "", level: LogLevel = LogLevel.INFO) {
    this.prefix = prefix;
    this.level = level;
  }

  /**
   * 设置日志级别
   *
   * @param level - 新的日志级别
   */
  setLevel(level: LogLevel): void {
    this.level = level;
  }

  /**
   * 获取当前日志级别
   *
   * @returns 当前日志级别
   */
  getLevel(): LogLevel {
    return this.level;
  }

  /**
   * 记录调试级别日志
   *
   * @param args - 日志参数
   */
  debug(...args: unknown[]): void {
    if (this.level <= LogLevel.DEBUG) {
      console.debug(`[${this.prefix}]`, ...args);
    }
  }

  /**
   * 记录信息级别日志
   *
   * @param args - 日志参数
   */
  info(...args: unknown[]): void {
    if (this.level <= LogLevel.INFO) {
      console.info(`[${this.prefix}]`, ...args);
    }
  }

  /**
   * 记录警告级别日志
   *
   * @param args - 日志参数
   */
  warn(...args: unknown[]): void {
    if (this.level <= LogLevel.WARN) {
      console.warn(`[${this.prefix}]`, ...args);
    }
  }

  /**
   * 记录错误级别日志
   *
   * @param args - 日志参数
   */
  error(...args: unknown[]): void {
    if (this.level <= LogLevel.ERROR) {
      console.error(`[${this.prefix}]`, ...args);
    }
  }
}

/**
 * EndpointManager 默认 Logger 实例
 */
export const logger = new Logger("EndpointManager", LogLevel.INFO);

/**
 * 创建自定义 Logger 实例
 *
 * @param prefix - 日志前缀
 * @param level - 日志级别，默认为 INFO
 * @returns Logger 实例
 */
export function createLogger(prefix = "", level?: LogLevel): Logger {
  return new Logger(prefix, level);
}

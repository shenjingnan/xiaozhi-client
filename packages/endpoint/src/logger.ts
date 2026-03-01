/**
 * Logger 工具
 * 提供统一的日志接口
 */

/**
 * 日志级别
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
class Logger {
  constructor(private readonly context: string) {}

  /**
   * 输出调试信息
   */
  debug(message: string, ...args: unknown[]): void {
    if (LogLevel.DEBUG >= Logger.getGlobalLevel()) {
      console.debug(`[${this.context}] ${message}`, ...args);
    }
  }

  /**
   * 输出一般信息
   */
  info(message: string, ...args: unknown[]): void {
    if (LogLevel.INFO >= Logger.getGlobalLevel()) {
      console.info(`[${this.context}] ${message}`, ...args);
    }
  }

  /**
   * 输出警告信息
   */
  warn(message: string, ...args: unknown[]): void {
    if (LogLevel.WARN >= Logger.getGlobalLevel()) {
      console.warn(`[${this.context}] ${message}`, ...args);
    }
  }

  /**
   * 输出错误信息
   */
  error(message: string, ...args: unknown[]): void {
    if (LogLevel.ERROR >= Logger.getGlobalLevel()) {
      console.error(`[${this.context}] ${message}`, ...args);
    }
  }

  private static globalLevel = LogLevel.DEBUG;

  static setGlobalLevel(level: LogLevel): void {
    Logger.globalLevel = level;
  }

  static getGlobalLevel(): LogLevel {
    return Logger.globalLevel;
  }
}

/**
 * 创建 Logger 实例
 *
 * @param context - 上下文名称
 * @returns Logger 实例
 */
export function createLogger(context: string): Logger {
  return new Logger(context);
}

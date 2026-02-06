/**
 * 轻量级日志记录器
 *
 * 这是 packages/config 包内部的简单日志实现
 * 避免与 apps/backend/Logger 产生循环依赖
 * 提供与主 Logger 系统兼容的 API
 */

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
 * 轻量级日志记录器类
 */
class LoggerImpl {
  private level: LogLevel;

  constructor(level: LogLevel = LogLevel.INFO) {
    this.level = level;
  }

  /**
   * 设置日志级别
   */
  setLevel(level: LogLevel): void {
    this.level = level;
  }

  /**
   * 获取日志级别优先级（数字越大优先级越高）
   */
  private getLevelPriority(level: LogLevel): number {
    const priorities: Record<LogLevel, number> = {
      [LogLevel.TRACE]: 10,
      [LogLevel.DEBUG]: 20,
      [LogLevel.INFO]: 30,
      [LogLevel.WARN]: 40,
      [LogLevel.ERROR]: 50,
      [LogLevel.FATAL]: 60,
    };
    return priorities[level];
  }

  /**
   * 检查是否应该输出该级别的日志
   */
  private shouldLog(level: LogLevel): boolean {
    return this.getLevelPriority(level) >= this.getLevelPriority(this.level);
  }

  /**
   * 记录 trace 级别日志
   */
  trace(message: string, ...args: unknown[]): void {
    if (this.shouldLog(LogLevel.TRACE)) {
      console.trace(message, ...args);
    }
  }

  /**
   * 记录 debug 级别日志
   */
  debug(message: string, ...args: unknown[]): void {
    if (this.shouldLog(LogLevel.DEBUG)) {
      console.debug(message, ...args);
    }
  }

  /**
   * 记录 info 级别日志
   */
  info(message: string, ...args: unknown[]): void {
    if (this.shouldLog(LogLevel.INFO)) {
      console.info(message, ...args);
    }
  }

  /**
   * 记录 warn 级别日志
   */
  warn(message: string, ...args: unknown[]): void {
    if (this.shouldLog(LogLevel.WARN)) {
      console.warn(message, ...args);
    }
  }

  /**
   * 记录 error 级别日志
   */
  error(message: string, ...args: unknown[]): void {
    if (this.shouldLog(LogLevel.ERROR)) {
      console.error(message, ...args);
    }
  }

  /**
   * 记录 fatal 级别日志
   */
  fatal(message: string, ...args: unknown[]): void {
    if (this.shouldLog(LogLevel.FATAL)) {
      console.error(message, ...args);
    }
  }

  /**
   * 记录 log 级别日志（等同于 info）
   */
  log(message: string, ...args: unknown[]): void {
    this.info(message, ...args);
  }

  /**
   * 记录成功日志（等同于 info）
   */
  success(message: string, ...args: unknown[]): void {
    this.info(message, ...args);
  }
}

// 创建并导出单例实例
const logger = new LoggerImpl();

// 导出类和实例
export { LoggerImpl as Logger };
export default logger;

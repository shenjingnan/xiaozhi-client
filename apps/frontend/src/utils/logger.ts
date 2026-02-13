/**
 * 前端日志工具
 *
 * 提供统一的日志记录功能，支持不同级别的日志输出。
 * 仅在开发环境输出 debug 级别日志。
 */

type LogLevel = "debug" | "info" | "warn" | "error";

/**
 * 检查是否为开发环境
 */
function isDevMode(): boolean {
  // 类型断言以支持 Vite 的 import.meta.env
  return (import.meta as any).env?.DEV ?? true;
}

class Logger {
  private prefix: string;

  constructor(prefix: string) {
    this.prefix = prefix;
  }

  /**
   * 格式化日志消息
   */
  private formatMessage(level: LogLevel, message: string): string {
    const timestamp = new Date().toISOString();
    return `[${timestamp}] [${level.toUpperCase()}] [${this.prefix}] ${message}`;
  }

  /**
   * 输出 debug 级别日志（仅开发环境）
   */
  debug(message: string, ...args: unknown[]): void {
    if (isDevMode()) {
      console.debug(this.formatMessage("debug", message), ...args);
    }
  }

  /**
   * 输出 info 级别日志
   */
  info(message: string, ...args: unknown[]): void {
    console.log(this.formatMessage("info", message), ...args);
  }

  /**
   * 输出 warn 级别日志
   */
  warn(message: string, ...args: unknown[]): void {
    console.warn(this.formatMessage("warn", message), ...args);
  }

  /**
   * 输出 error 级别日志
   */
  error(message: string, ...args: unknown[]): void {
    console.error(this.formatMessage("error", message), ...args);
  }
}

/**
 * 创建指定前缀的 Logger 实例
 */
export function createLogger(prefix: string): Logger {
  return new Logger(prefix);
}

/**
 * 默认 Logger 实例
 */
export const logger = new Logger("App");

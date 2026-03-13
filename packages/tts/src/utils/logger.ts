/**
 * TTS 包专用日志工具
 *
 * 提供统一的日志记录功能，支持不同日志级别。
 */

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
}

/**
 * TTS 日志记录器类
 */
export class Logger {
  private level: LogLevel;
  private prefix: string;

  constructor(prefix = "", level: LogLevel = LogLevel.INFO) {
    this.prefix = prefix;
    this.level = level;
  }

  setLevel(level: LogLevel): void {
    this.level = level;
  }

  debug(...args: unknown[]): void {
    if (this.level <= LogLevel.DEBUG) {
      console.debug(`[${this.prefix}]`, ...args);
    }
  }

  info(...args: unknown[]): void {
    if (this.level <= LogLevel.INFO) {
      console.info(`[${this.prefix}]`, ...args);
    }
  }

  warn(...args: unknown[]): void {
    if (this.level <= LogLevel.WARN) {
      console.warn(`[${this.prefix}]`, ...args);
    }
  }

  error(...args: unknown[]): void {
    if (this.level <= LogLevel.ERROR) {
      console.error(`[${this.prefix}]`, ...args);
    }
  }
}

// 默认 TTS Logger 实例
export const logger = new Logger("TTS");

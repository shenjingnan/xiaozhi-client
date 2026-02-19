/**
 * Logger utility
 */

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
}

export class Logger {
  private level: LogLevel;
  private prefix: string;

  constructor(prefix: string = "", level: LogLevel = LogLevel.INFO) {
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

// Default logger
export const logger = new Logger("ASR");

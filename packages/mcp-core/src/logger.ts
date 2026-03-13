/**
 * MCP 核心包日志系统
 *
 * 提供轻量级的日志记录功能，支持日志级别过滤和统一格式
 *
 * @module logger
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
 * 日志级别类型
 */
export type LogLevelType = keyof typeof LogLevel;

/**
 * LoggerLike 接口 - 用于依赖注入
 */
export interface LoggerLike {
  debug(message: string, ...args: unknown[]): void;
  info(message: string, ...args: unknown[]): void;
  warn(message: string, ...args: unknown[]): void;
  error(message: string, ...args: unknown[]): void;
}

/**
 * MCP 核心包 Logger 类
 *
 * 提供轻量级的日志记录功能，支持：
 * - 日志级别过滤
 * - 统一的前缀格式
 * - 可变参数支持
 */
export class MCPLogger implements LoggerLike {
  private level: LogLevel;
  private prefix: string;

  /**
   * 创建 Logger 实例
   * @param prefix 日志前缀
   * @param level 日志级别，默认为 INFO
   */
  constructor(prefix = "", level: LogLevel = LogLevel.INFO) {
    this.prefix = prefix;
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
   * 记录调试级别日志
   * @param message 日志消息
   * @param args 额外参数
   */
  debug(message: string, ...args: unknown[]): void {
    if (this.level <= LogLevel.DEBUG) {
      this.log("debug", message, ...args);
    }
  }

  /**
   * 记录信息级别日志
   * @param message 日志消息
   * @param args 额外参数
   */
  info(message: string, ...args: unknown[]): void {
    if (this.level <= LogLevel.INFO) {
      this.log("info", message, ...args);
    }
  }

  /**
   * 记录警告级别日志
   * @param message 日志消息
   * @param args 额外参数
   */
  warn(message: string, ...args: unknown[]): void {
    if (this.level <= LogLevel.WARN) {
      this.log("warn", message, ...args);
    }
  }

  /**
   * 记录错误级别日志
   * @param message 日志消息
   * @param args 额外参数
   */
  error(message: string, ...args: unknown[]): void {
    if (this.level <= LogLevel.ERROR) {
      this.log("error", message, ...args);
    }
  }

  /**
   * 内部日志方法
   * @param level 日志级别名称
   * @param message 日志消息
   * @param args 额外参数
   */
  private log(level: string, message: string, ...args: unknown[]): void {
    const prefix = this.prefix ? `[${this.prefix}] ` : "";
    const fullMessage = `${prefix}${message}`;

    switch (level) {
      case "debug":
        console.debug(fullMessage, ...args);
        break;
      case "info":
        console.info(fullMessage, ...args);
        break;
      case "warn":
        console.warn(fullMessage, ...args);
        break;
      case "error":
        console.error(fullMessage, ...args);
        break;
    }
  }

  /**
   * 创建带有新前缀的子 Logger
   * @param newPrefix 新的前缀
   * @returns 新的 Logger 实例
   */
  withPrefix(newPrefix: string): MCPLogger {
    const combinedPrefix = this.prefix
      ? `${this.prefix}:${newPrefix}`
      : newPrefix;
    return new MCPLogger(combinedPrefix, this.level);
  }
}

/**
 * 创建默认 Logger 实例
 * @param prefix 日志前缀
 * @param level 日志级别
 * @returns Logger 实例
 */
export function createLogger(
  prefix: string,
  level: LogLevel = LogLevel.INFO
): MCPLogger {
  return new MCPLogger(prefix, level);
}

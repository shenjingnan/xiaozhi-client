/**
 * 前端日志服务
 * 提供统一的日志接口，支持日志级别控制和模块标识
 */

/**
 * 日志级别枚举
 */
export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
  NONE = 4, // 禁用所有日志
}

/**
 * 日志配置接口
 */
interface LoggerConfig {
  /** 日志级别 */
  level: LogLevel;
  /** 是否启用时间戳 */
  enableTimestamp: boolean;
  /** 是否为生产模式（生产模式下默认禁用 DEBUG 日志） */
  isProduction: boolean;
}

/**
 * 默认日志配置
 */
const defaultConfig: LoggerConfig = {
  level: LogLevel.DEBUG,
  enableTimestamp: true,
  isProduction: false,
};

/**
 * 日志服务类
 */
class LoggerService {
  private config: LoggerConfig;
  private globalLevel: LogLevel;

  constructor(config: Partial<LoggerConfig> = {}) {
    // 检测是否为生产环境
    const isProduction =
      config.isProduction ?? process.env.NODE_ENV === "production";

    this.config = {
      ...defaultConfig,
      ...config,
      isProduction,
    };

    // 生产环境下默认使用 INFO 级别
    this.globalLevel = isProduction ? LogLevel.INFO : this.config.level;
  }

  /**
   * 创建带模块标识的日志器
   * @param prefix 模块标识前缀
   * @returns Logger 实例
   */
  createLogger(prefix: string): Logger {
    return new Logger(prefix, this.globalLevel, this.config.enableTimestamp);
  }

  /**
   * 设置全局日志级别
   * @param level 新的日志级别
   */
  setLevel(level: LogLevel): void {
    this.globalLevel = level;
  }

  /**
   * 获取当前日志级别
   * @returns 当前日志级别
   */
  getLevel(): LogLevel {
    return this.globalLevel;
  }

  /**
   * 是否为生产模式
   * @returns 是否为生产模式
   */
  isProduction(): boolean {
    return this.config.isProduction;
  }
}

/**
 * 日志器类
 */
class Logger {
  private prefix: string;
  private level: LogLevel;
  private enableTimestamp: boolean;

  constructor(prefix: string, level: LogLevel, enableTimestamp: boolean) {
    this.prefix = prefix;
    this.level = level;
    this.enableTimestamp = enableTimestamp;
  }

  /**
   * 格式化日志前缀
   * @returns 格式化后的前缀字符串
   */
  private formatPrefix(): string {
    if (this.enableTimestamp) {
      const timestamp = new Date().toISOString().split("T")[1].slice(0, 8);
      return `[${timestamp}] [${this.prefix}]`;
    }
    return `[${this.prefix}]`;
  }

  /**
   * 检查是否应该输出该级别的日志
   * @param level 要检查的日志级别
   * @returns 是否应该输出
   */
  private shouldLog(level: LogLevel): boolean {
    return level >= this.level;
  }

  /**
   * 记录调试级别日志
   * @param message 日志消息
   * @param args 额外参数
   */
  debug(message: string, ...args: unknown[]): void {
    if (this.shouldLog(LogLevel.DEBUG)) {
      console.debug(this.formatPrefix(), message, ...args);
    }
  }

  /**
   * 记录信息级别日志
   * @param message 日志消息
   * @param args 额外参数
   */
  info(message: string, ...args: unknown[]): void {
    if (this.shouldLog(LogLevel.INFO)) {
      console.info(this.formatPrefix(), message, ...args);
    }
  }

  /**
   * 记录警告级别日志
   * @param message 日志消息
   * @param args 额外参数
   */
  warn(message: string, ...args: unknown[]): void {
    if (this.shouldLog(LogLevel.WARN)) {
      console.warn(this.formatPrefix(), message, ...args);
    }
  }

  /**
   * 记录错误级别日志
   * @param message 日志消息
   * @param args 额外参数
   */
  error(message: string, ...args: unknown[]): void {
    if (this.shouldLog(LogLevel.ERROR)) {
      console.error(this.formatPrefix(), message, ...args);
    }
  }

  /**
   * 设置日志级别
   * @param level 新的日志级别
   */
  setLevel(level: LogLevel): void {
    this.level = level;
  }
}

// 创建默认的日志服务实例
export const loggerService = new LoggerService();

// 导出常用日志器
export const wsLogger = loggerService.createLogger("WebSocket");
export const networkLogger = loggerService.createLogger("NetworkService");
export const cozeLogger = loggerService.createLogger("CozeApi");

// 导出类型
export type { LoggerConfig };

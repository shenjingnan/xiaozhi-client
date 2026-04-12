/**
 * 前端统一日志服务
 *
 * 提供统一的日志接口，替代 console.log/error/warn
 * 支持日志级别控制和环境区分
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
 * 日志配置
 */
interface LoggerConfig {
  /** 当前日志级别，低于此级别的日志不会输出 */
  level: LogLevel;
  /** 是否在生产环境输出日志 */
  enableInProduction: boolean;
  /** 日志前缀 */
  prefix?: string;
}

/**
 * 判断是否为开发环境
 * 在 Vite 项目中，import.meta.env.DEV 在开发模式下为 true
 */
const isDev = typeof import.meta !== "undefined" && (import.meta as { env?: { DEV?: boolean } }).env?.DEV;

/**
 * 默认配置
 * 开发环境: DEBUG 级别，允许输出
 * 生产环境: WARN 级别，默认禁止输出（可通过配置开启）
 */
const defaultConfig: LoggerConfig = {
  level: isDev ? LogLevel.DEBUG : LogLevel.WARN,
  enableInProduction: false,
};

/**
 * 日志级别优先级映射
 */
const levelPriority: Record<LogLevel, number> = {
  [LogLevel.TRACE]: 0,
  [LogLevel.DEBUG]: 1,
  [LogLevel.INFO]: 2,
  [LogLevel.WARN]: 3,
  [LogLevel.ERROR]: 4,
  [LogLevel.FATAL]: 5,
};

/**
 * 日志级别对应的 console 方法
 */
const levelToConsole: Record<LogLevel, "log" | "info" | "warn" | "error"> = {
  [LogLevel.TRACE]: "log",
  [LogLevel.DEBUG]: "log",
  [LogLevel.INFO]: "info",
  [LogLevel.WARN]: "warn",
  [LogLevel.ERROR]: "error",
  [LogLevel.FATAL]: "error",
};

/**
 * 日志级别对应的样式
 */
const levelStyles: Record<LogLevel, string> = {
  [LogLevel.TRACE]: "color: gray",
  [LogLevel.DEBUG]: "color: cyan",
  [LogLevel.INFO]: "color: blue",
  [LogLevel.WARN]: "color: orange",
  [LogLevel.ERROR]: "color: red",
  [LogLevel.FATAL]: "color: red; font-weight: bold",
};

/**
 * 判断是否为生产环境
 */
const isProduction = !isDev;

/**
 * 创建 Logger 实例
 */
class Logger {
  private config: LoggerConfig;

  constructor(config: Partial<LoggerConfig> = {}) {
    this.config = { ...defaultConfig, ...config };
  }

  /**
   * 更新配置
   */
  updateConfig(config: Partial<LoggerConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * 检查是否应该输出日志
   */
  private shouldLog(level: LogLevel): boolean {
    // 生产环境检查
    if (!this.config.enableInProduction && isProduction) {
      return false;
    }

    // 级别检查
    return levelPriority[level] >= levelPriority[this.config.level];
  }

  /**
   * 格式化日志消息
   */
  private formatMessage(level: LogLevel, message: string): string {
    const timestamp = new Date().toISOString();
    const levelStr = level.toUpperCase();
    const prefix = this.config.prefix ? `[${this.config.prefix}] ` : "";

    return `${prefix}${timestamp} [${levelStr}] ${message}`;
  }

  /**
   * 输出日志
   */
  private log(
    level: LogLevel,
    message: string,
    ...args: unknown[]
  ): void {
    if (!this.shouldLog(level)) {
      return;
    }

    const consoleMethod = levelToConsole[level];
    const formattedMessage = this.formatMessage(level, message);

    // 开发环境使用彩色输出
    if (isDev) {
      console[consoleMethod](
        `%c${formattedMessage}`,
        levelStyles[level],
        ...args
      );
    } else {
      console[consoleMethod](formattedMessage, ...args);
    }
  }

  /**
   * 输出 TRACE 级别日志
   */
  trace(message: string, ...args: unknown[]): void {
    this.log(LogLevel.TRACE, message, ...args);
  }

  /**
   * 输出 DEBUG 级别日志
   */
  debug(message: string, ...args: unknown[]): void {
    this.log(LogLevel.DEBUG, message, ...args);
  }

  /**
   * 输出 INFO 级别日志
   */
  info(message: string, ...args: unknown[]): void {
    this.log(LogLevel.INFO, message, ...args);
  }

  /**
   * 输出 WARN 级别日志
   */
  warn(message: string, ...args: unknown[]): void {
    this.log(LogLevel.WARN, message, ...args);
  }

  /**
   * 输出 ERROR 级别日志
   */
  error(message: string, ...args: unknown[]): void {
    this.log(LogLevel.ERROR, message, ...args);
  }

  /**
   * 输出 FATAL 级别日志
   */
  fatal(message: string, ...args: unknown[]): void {
    this.log(LogLevel.FATAL, message, ...args);
  }
}

/**
 * 默认 Logger 实例
 */
export const logger = new Logger();

/**
 * 创建带前缀的 Logger 实例
 * @param prefix 日志前缀，用于区分不同模块
 * @returns Logger 实例
 */
export function createLogger(prefix: string): Logger {
  return new Logger({ prefix });
}

/**
 * 配置全局 Logger
 */
export function configureLogger(config: Partial<LoggerConfig>): void {
  logger.updateConfig(config);
}

// 导出 Logger 类以供高级使用
export { Logger };
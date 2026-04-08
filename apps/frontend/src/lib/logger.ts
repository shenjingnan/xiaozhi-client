/**
 * 前端日志系统模块
 *
 * 提供统一的日志记录功能，用于前端项目。
 *
 * ## 主要特性
 *
 * - **多种日志级别**：支持 debug、info、warn、error
 * - **统一接口**：提供一致的日志记录 API
 * - **环境感知**：在开发环境提供更详细的日志输出
 * - **类型安全**：完整的 TypeScript 类型支持
 *
 * ## 使用示例
 *
 * ```typescript
 * import { logger } from '@/lib/logger';
 *
 * // 记录信息
 * logger.info('操作成功');
 * logger.error('发生错误', error);
 * logger.debug('调试信息', { data: 'value' });
 * ```
 */

/**
 * 日志级别枚举
 */
export enum LogLevel {
  DEBUG = "debug",
  INFO = "info",
  WARN = "warn",
  ERROR = "error",
}

/**
 * 日志记录器类
 */
class Logger {
  private readonly isDevelopment: boolean;

  constructor() {
    this.isDevelopment =
      typeof process !== "undefined" && process.env?.NODE_ENV !== "production";
  }

  /**
   * 记录调试级别日志
   * @param message 日志消息
   * @param args 额外参数
   */
  debug(message: string, ...args: unknown[]): void {
    if (this.isDevelopment) {
      console.debug(`[DEBUG] ${message}`, ...args);
    }
  }

  /**
   * 记录信息级别日志
   * @param message 日志消息
   * @param args 额外参数
   */
  info(message: string, ...args: unknown[]): void {
    console.info(`[INFO] ${message}`, ...args);
  }

  /**
   * 记录警告级别日志
   * @param message 日志消息
   * @param args 额外参数
   */
  warn(message: string, ...args: unknown[]): void {
    console.warn(`[WARN] ${message}`, ...args);
  }

  /**
   * 记录错误级别日志
   * @param message 日志消息
   * @param args 额外参数
   */
  error(message: string, ...args: unknown[]): void {
    console.error(`[ERROR] ${message}`, ...args);
  }
}

/**
 * 全局 Logger 实例
 */
export const logger = new Logger();

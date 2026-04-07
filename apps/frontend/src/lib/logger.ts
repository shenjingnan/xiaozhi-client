/**
 * 前端日志系统
 *
 * 提供统一的日志记录功能，确保与后端 Logger API 保持一致。
 *
 * ## 主要特性
 *
 * - **多种日志级别**：支持 debug、info、warn、error
 * - **统一接口**：与后端 Logger API 保持一致
 * - **前缀标记**：自动添加时间戳和日志级别前缀
 *
 * ## 使用示例
 *
 * ```typescript
 * import { logger } from '@/lib/logger';
 *
 * // 记录信息
 * logger.info('操作成功');
 * logger.error('发生错误', error);
 * logger.debug('调试信息');
 * ```
 *
 * @module apps/frontend/src/lib/logger
 */

/**
 * 日志级别枚举
 */
enum LogLevel {
  DEBUG = "DEBUG",
  INFO = "INFO",
  WARN = "WARN",
  ERROR = "ERROR",
}

/**
 * 格式化日期时间为 HH:mm:ss 格式
 * @param date 要格式化的日期对象
 * @returns 格式化后的日期时间字符串
 */
function formatTime(date: Date): string {
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  const seconds = String(date.getSeconds()).padStart(2, "0");
  return `${hours}:${minutes}:${seconds}`;
}

/**
 * 格式化日志消息
 * @param level 日志级别
 * @param message 日志消息
 * @param args 额外参数
 * @returns 格式化后的日志消息
 */
function formatMessage(
  level: LogLevel,
  message: string,
  args?: unknown[]
): string {
  const timestamp = formatTime(new Date());
  let formattedMessage = `[${timestamp}] [${level}] ${message}`;

  if (args && args.length > 0) {
    const argsStr = args
      .map((arg) => {
        if (arg instanceof Error) {
          return arg.message;
        }
        if (typeof arg === "object") {
          try {
            return JSON.stringify(arg);
          } catch {
            return String(arg);
          }
        }
        return String(arg);
      })
      .join(" ");
    formattedMessage += ` ${argsStr}`;
  }

  return formattedMessage;
}

/**
 * 前端日志记录器类
 */
class FrontendLogger {
  /**
   * 记录调试级别日志
   * @param message 日志消息
   * @param args 额外参数
   */
  debug(message: string, ...args: unknown[]): void {
    // @ts-expect-error - import.meta.env 是 Vite 特有属性
    if (import.meta.env?.DEV) {
      console.log(formatMessage(LogLevel.DEBUG, message, args));
    }
  }

  /**
   * 记录信息级别日志
   * @param message 日志消息
   * @param args 额外参数
   */
  info(message: string, ...args: unknown[]): void {
    console.log(formatMessage(LogLevel.INFO, message, args));
  }

  /**
   * 记录成功级别日志（映射到 info）
   * @param message 日志消息
   * @param args 额外参数
   */
  success(message: string, ...args: unknown[]): void {
    console.log(formatMessage(LogLevel.INFO, message, args));
  }

  /**
   * 记录警告级别日志
   * @param message 日志消息
   * @param args 额外参数
   */
  warn(message: string, ...args: unknown[]): void {
    console.warn(formatMessage(LogLevel.WARN, message, args));
  }

  /**
   * 记录错误级别日志
   * @param message 日志消息
   * @param args 额外参数
   */
  error(message: string, ...args: unknown[]): void {
    console.error(formatMessage(LogLevel.ERROR, message, args));
  }

  /**
   * 记录日志（使用 info 级别）
   * @param message 日志消息
   * @param args 额外参数
   */
  log(message: string, ...args: unknown[]): void {
    console.log(formatMessage(LogLevel.INFO, message, args));
  }
}

// 导出单例实例
export const logger = new FrontendLogger();

/**
 * MCP 核心包日志工具
 *
 * 提供轻量级的日志接口，支持依赖注入
 * 可以与主项目的 Logger 系统集成，也可以独立使用 console
 *
 * @module logger
 */

/**
 * 日志级别
 */
export type LogLevel = "debug" | "info" | "warn" | "error";

/**
 * Logger 接口
 */
export interface ILogger {
  debug(message: string, ...args: unknown[]): void;
  info(message: string, ...args: unknown[]): void;
  warn(message: string, ...args: unknown[]): void;
  error(message: string, ...args: unknown[]): void;
}

/**
 * 默认 Logger 实现（使用 console）
 */
class ConsoleLogger implements ILogger {
  debug(message: string, ...args: unknown[]): void {
    console.debug(message, ...args);
  }

  info(message: string, ...args: unknown[]): void {
    console.info(message, ...args);
  }

  warn(message: string, ...args: unknown[]): void {
    console.warn(message, ...args);
  }

  error(message: string, ...args: unknown[]): void {
    console.error(message, ...args);
  }
}

/**
 * 全局 Logger 实例
 */
let globalLogger: ILogger = new ConsoleLogger();

/**
 * 获取 Logger 实例
 * @returns Logger 实例
 */
export function getLogger(): ILogger {
  return globalLogger;
}

/**
 * 设置 Logger 实例
 * @param logger Logger 实例
 *
 * @example
 * ```typescript
 * import { setLogger } from '@mcp-core/logger';
 * import { logger } from './Logger';
 *
 * // 使用主项目的 Logger
 * setLogger(logger);
 * ```
 */
export function setLogger(logger: ILogger): void {
  globalLogger = logger;
}

/**
 * 导出默认 Logger 实例
 */
export const logger = getLogger();

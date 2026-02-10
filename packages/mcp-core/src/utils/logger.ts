/**
 * MCP 核心库内部日志工具
 *
 * 提供简单、零依赖的日志功能，支持依赖注入
 * 避免引入外部 Logger 依赖，保持 mcp-core 包的轻量级特性
 *
 * ## 设计原则
 *
 * - **零依赖**：不依赖任何外部日志库
 * - **依赖注入**：支持自定义日志函数注入
 * - **向后兼容**：默认使用 console，但可以通过 setLogger 替换
 * - **简单实用**：只提供必要的日志级别（info, warn, error, debug）
 *
 * ## 使用示例
 *
 * ### 默认使用（console）
 * ```typescript
 * import { logger } from './utils/logger.js';
 * logger.info('服务启动成功');
 * logger.warn('配置警告', { config: 'value' });
 * ```
 *
 * ### 自定义 Logger（依赖注入）
 * ```typescript
 * import { setLogger } from './utils/logger.js';
 *
 * // 使用自定义 Logger（如 apps/backend/Logger.ts）
 * setLogger({
 *   info: (msg, ...args) => myLogger.info(msg, ...args),
 *   warn: (msg, ...args) => myLogger.warn(msg, ...args),
 *   error: (msg, ...args) => myLogger.error(msg, ...args),
 *   debug: (msg, ...args) => myLogger.debug(msg, ...args),
 * });
 * ```
 */

/**
 * 日志函数接口
 */
export interface LoggerFunctions {
  info: (message: string, ...args: unknown[]) => void;
  warn: (message: string, ...args: unknown[]) => void;
  error: (message: string, ...args: unknown[]) => void;
  debug: (message: string, ...args: unknown[]) => void;
}

/**
 * 默认日志实现（使用 console）
 */
const defaultLogger: LoggerFunctions = {
  info: (message: string, ...args: unknown[]) => {
    console.info(message, ...args);
  },
  warn: (message: string, ...args: unknown[]) => {
    console.warn(message, ...args);
  },
  error: (message: string, ...args: unknown[]) => {
    console.error(message, ...args);
  },
  debug: (message: string, ...args: unknown[]) => {
    console.debug(message, ...args);
  },
};

/**
 * 当前日志实现（默认为 console）
 */
let currentLogger: LoggerFunctions = defaultLogger;

/**
 * 设置自定义日志实现
 * 用于依赖注入，允许上层模块替换默认的 console 日志
 *
 * @param customLogger 自定义日志函数对象
 */
export function setLogger(customLogger: LoggerFunctions): void {
  currentLogger = customLogger;
}

/**
 * 获取当前日志实现
 */
export function getLogger(): LoggerFunctions {
  return currentLogger;
}

/**
 * 重置为默认日志实现（console）
 * 用于测试或重置日志状态
 */
export function resetLogger(): void {
  currentLogger = defaultLogger;
}

/**
 * 导出日志实例
 */
export const logger: LoggerFunctions = new Proxy(defaultLogger, {
  get(_target, prop: string) {
    return currentLogger[prop as keyof LoggerFunctions];
  },
});

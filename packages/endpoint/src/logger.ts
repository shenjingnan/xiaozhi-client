/**
 * Endpoint 包日志模块
 * 提供统一的日志记录接口，与项目主 logger 保持一致的 API
 *
 * 使用方式：
 * ```typescript
 * import { logger } from "./logger.js";
 *
 * logger.info("[EndpointManager] 实例已创建");
 * logger.error(`[EndpointManager] 连接失败: ${url}`, error);
 * logger.debug("[Endpoint] MCP 服务器初始化完成");
 * ```
 */

/**
 * 日志级别类型
 */
type LogLevel = "debug" | "info" | "warn" | "error";

/**
 * Logger 接口，与项目主 logger 保持一致
 */
export interface Logger {
  info(message: string, ...args: unknown[]): void;
  info(obj: object, message?: string): void;
  debug(message: string, ...args: unknown[]): void;
  debug(obj: object, message?: string): void;
  warn(message: string, ...args: unknown[]): void;
  warn(obj: object, message?: string): void;
  error(message: string, ...args: unknown[]): void;
  error(obj: object, message?: string): void;
}

/**
 * 简单 Logger 实现
 * 使用 console 作为底层输出，但提供统一的 API
 * 未来可轻松替换为更完善的日志系统
 */
class SimpleLogger implements Logger {
  private formatMessage(level: LogLevel, message: string): string {
    const timestamp = new Date().toISOString();
    return `[${timestamp}] [${level.toUpperCase()}] ${message}`;
  }

  info(messageOrObj: string | object, ...args: unknown[]): void {
    if (typeof messageOrObj === "string") {
      if (args.length === 0) {
        console.info(this.formatMessage("info", messageOrObj));
      } else {
        console.info(this.formatMessage("info", messageOrObj), ...args);
      }
    } else {
      console.info(this.formatMessage("info", args[0] as string || ""), messageOrObj);
    }
  }

  debug(messageOrObj: string | object, ...args: unknown[]): void {
    if (typeof messageOrObj === "string") {
      if (args.length === 0) {
        console.debug(this.formatMessage("debug", messageOrObj));
      } else {
        console.debug(this.formatMessage("debug", messageOrObj), ...args);
      }
    } else {
      console.debug(this.formatMessage("debug", args[0] as string || ""), messageOrObj);
    }
  }

  warn(messageOrObj: string | object, ...args: unknown[]): void {
    if (typeof messageOrObj === "string") {
      if (args.length === 0) {
        console.warn(this.formatMessage("warn", messageOrObj));
      } else {
        console.warn(this.formatMessage("warn", messageOrObj), ...args);
      }
    } else {
      console.warn(this.formatMessage("warn", args[0] as string || ""), messageOrObj);
    }
  }

  error(messageOrObj: string | object, ...args: unknown[]): void {
    if (typeof messageOrObj === "string") {
      if (args.length === 0) {
        console.error(this.formatMessage("error", messageOrObj));
      } else {
        console.error(this.formatMessage("error", messageOrObj), ...args);
      }
    } else {
      console.error(this.formatMessage("error", args[0] as string || ""), messageOrObj);
    }
  }
}

/**
 * 导出默认 logger 实例
 */
export const logger: Logger = new SimpleLogger();
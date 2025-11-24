import type { Logger } from "@root/Logger.js";
import type { Context } from "hono";

/**
 * 抽象 API Handler 基类
 * 提供统一的 Logger 获取方法
 */
export abstract class AbstractApiHandler {
  /**
   * 从 context 获取 logger 实例
   * @param c - Hono context
   * @returns Logger 实例
   * @throws Error 如果 logger 未在 context 中设置
   */
  protected getLogger(c: Context): Logger {
    const logger = c.get("logger");
    if (!logger) {
      throw new Error(
        "Logger not found in context. Ensure loggerMiddleware is registered."
      );
    }
    return logger as Logger;
  }
}

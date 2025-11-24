import type { Context } from "hono";
import type { Logger } from "@root/Logger.js";

/**
 * 抽象 API Handler 基类
 * 提供统一的 Logger 获取方法
 */
export abstract class AbstractApiHandler {
  /**
   * 从 context 获取 logger 实例
   * @param c - Hono context
   * @returns Logger 实例
   */
  protected getLogger(c: Context): Logger {
    return c.get("logger") as Logger;
  }
}

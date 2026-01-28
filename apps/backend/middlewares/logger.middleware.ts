import { logger } from "@root/Logger.js";
import type { Logger } from "@root/Logger.js";
import type { Context, Next } from "hono";

/**
 * 扩展 Hono Context 接口
 * 添加 logger 属性，允许直接通过 c.logger 访问
 * 保留此扩展以提供向后兼容性
 */
declare module "hono" {
  interface Context {
    logger: Logger;
  }
}

/**
 * Logger 中间件 - 将 logger 实例挂载到 Hono context
 * 支持两种访问方式：
 * 1. c.get("logger") - Hono 推荐做法
 * 2. c.logger - 向后兼容
 */
export const loggerMiddleware = async (c: Context, next: Next) => {
  // Hono 推荐做法
  c.set("logger", logger);

  // 保留模块扩展以提供向后兼容
  c.logger = logger;

  await next();
};

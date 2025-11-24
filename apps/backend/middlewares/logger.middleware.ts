import { logger } from "@root/Logger.js";
import type { Context, Next } from "hono";

/**
 * Logger 中间件 - 将 logger 实例挂载到 Hono context
 * 为每个请求提供独立的 logger 实例
 */
export const loggerMiddleware = async (c: Context, next: Next) => {
  c.set("logger", logger);
  await next();
};

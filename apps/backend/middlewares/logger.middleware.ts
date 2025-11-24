import { logger } from "@root/Logger.js";
import type { Context, Next } from "hono";

/**
 * Logger 中间件 - 将 logger 实例挂载到 Hono context
 * 使所有请求处理器可以通过 context 访问 logger
 */
export const loggerMiddleware = async (c: Context, next: Next) => {
  c.set("logger", logger);
  await next();
};

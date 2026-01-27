import { logger } from "@root/Logger.js";
import type { Logger } from "@root/Logger.js";
import type { Context, Next } from "hono";

/**
 * 扩展 Hono Context 接口
 * 添加 logger 属性，允许直接通过 c.logger 访问
 */
declare module "hono" {
  interface Context {
    logger: Logger;
  }
}

/**
 * Logger 中间件 - 将 logger 实例挂载到 Hono context
 * 使所有请求处理器可以通过 c.logger 直接访问 logger
 */
export const loggerMiddleware = async (c: Context, next: Next) => {
  c.logger = logger;
  await next();
};

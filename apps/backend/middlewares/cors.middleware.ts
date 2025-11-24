import { cors } from "hono/cors";

/**
 * CORS 中间件配置
 */
export const corsMiddleware = cors({
  origin: "*",
  allowMethods: ["GET", "POST", "PUT", "OPTIONS"],
  allowHeaders: ["Content-Type"],
});

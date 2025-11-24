import { cors } from "hono/cors";

/**
 * CORS 中间件配置
 * 支持通过环境变量 ALLOWED_ORIGINS 配置允许的来源列表
 * 多个来源用逗号分隔，例如：https://example.com,https://app.example.com
 * 未配置时默认允许所有来源（开发环境）
 */
export const corsMiddleware = cors({
  origin: process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(",").map((origin) => origin.trim())
    : "*",
  allowMethods: ["GET", "POST", "PUT", "OPTIONS"],
  allowHeaders: ["Content-Type"],
});

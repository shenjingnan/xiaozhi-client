/**
 * HTTP 中间件模块
 *
 * 提供用于 Hono 应用的各类中间件：
 * - {@link loggerMiddleware} - 日志中间件，将 logger 实例注入到上下文
 * - {@link corsMiddleware} - CORS 中间件，处理跨域请求
 * - {@link errorHandlerMiddleware} - 错误处理中间件（通过 app.onError 注册）
 * - {@link notFoundHandlerMiddleware} - 404 处理中间件（通过 app.notFound 注册）
 * - {@link responseEnhancerMiddleware} - 响应增强中间件，添加便捷方法
 * - {@link mcpServiceManagerMiddleware} - MCP 服务管理器中间件
 * - {@link endpointManagerMiddleware} - 端点管理器中间件
 * - {@link endpointsMiddleware} - 小智端点处理器中间件
 *
 * 此外还导出辅助函数和类型：
 * - {@link hasMCPServiceManager} - 检查是否存在 MCP 服务管理器
 * - {@link getMCPServiceManager} - 获取 MCP 服务管理器
 * - {@link requireMCPServiceManager} - 获取 MCP 服务管理器（不存在则抛错）
 * - {@link ApiErrorResponse} / {@link ApiSuccessResponse} - API 响应类型
 *
 * @module middlewares
 *
 * @example
 * ```typescript
 * import { Hono } from 'hono';
 * import {
 *   loggerMiddleware,
 *   corsMiddleware,
 *   errorHandlerMiddleware,
 *   notFoundHandlerMiddleware,
 *   responseEnhancerMiddleware,
 * } from '@/middlewares';
 *
 * const app = new Hono();
 *
 * // 通用中间件
 * app.use(loggerMiddleware);
 * app.use(corsMiddleware);
 * app.use(responseEnhancerMiddleware);
 *
 * // 404 处理
 * app.notFound(notFoundHandlerMiddleware);
 *
 * // 全局错误处理
 * app.onError(errorHandlerMiddleware);
 * ```
 */

// 重新导出 context 相关函数
export {
  getMCPServiceManager,
  requireMCPServiceManager,
} from "@/types/hono.context.js";
export { corsMiddleware } from "./cors.middleware.js";
export { endpointManagerMiddleware } from "./endpointManager.middleware.js";
export { endpointsMiddleware } from "./endpoints.middleware.js";
export {
  ApiErrorResponse,
  ApiSuccessResponse,
  createErrorResponse,
  createSuccessResponse,
  errorHandlerMiddleware,
  notFoundHandlerMiddleware,
} from "./error.middleware.js";
export { loggerMiddleware } from "./logger.middleware.js";
export {
  hasMCPServiceManager,
  mcpServiceManagerMiddleware,
} from "./mcpServiceManager.middleware.js";
export { responseEnhancerMiddleware } from "./response-enhancer.middleware.js";

/**
 * HTTP 中间件模块
 *
 * 提供用于 Hono 应用的各类中间件：
 * - {@link loggerMiddleware} - 日志中间件，将 logger 实例注入到上下文
 * - {@link corsMiddleware} - CORS 中间件，处理跨域请求
 * - {@link errorHandlerMiddleware} - 错误处理中间件
 * - {@link notFoundHandlerMiddleware} - 404 处理中间件
 * - {@link responseEnhancerMiddleware} - 响应增强中间件，添加便捷方法
 * - {@link mcpServiceManagerMiddleware} - MCP 服务管理器中间件
 * - {@link endpointManagerMiddleware} - 端点管理器中间件
 * - {@link endpointsMiddleware} - 小智端点处理器中间件
 *
 * @module middlewares
 *
 * @example
 * ```typescript
 * import {
 *   loggerMiddleware,
 *   corsMiddleware,
 *   errorHandlerMiddleware,
 *   responseEnhancerMiddleware
 * } from '@/middlewares';
 *
 * app.use(loggerMiddleware);
 * app.use(corsMiddleware);
 * app.use(responseEnhancerMiddleware);
 * ```
 */

export { loggerMiddleware } from "./logger.middleware.js";
export { corsMiddleware } from "./cors.middleware.js";
export {
  errorHandlerMiddleware,
  notFoundHandlerMiddleware,
  createErrorResponse,
  createSuccessResponse,
  ApiErrorResponse,
  ApiSuccessResponse,
} from "./error.middleware.js";
export { responseEnhancerMiddleware } from "./response-enhancer.middleware.js";
export {
  mcpServiceManagerMiddleware,
  hasMCPServiceManager,
} from "./mcpServiceManager.middleware.js";
export { endpointManagerMiddleware } from "./endpointManager.middleware.js";
export { endpointsMiddleware } from "./endpoints.middleware.js";

// 重新导出 context 相关函数
export {
  getMCPServiceManager,
  requireMCPServiceManager,
} from "@/types/hono.context.js";

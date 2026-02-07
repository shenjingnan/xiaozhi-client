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
export { endpointMiddleware } from "./endpoint.middleware.js";

// 重新导出 context 相关函数
export {
  getMCPServiceManager,
  requireMCPServiceManager,
} from "../types/hono.context.js";

/**
 * 端点管理路由配置
 * 处理所有端点管理相关的 API 路由
 * 使用中间件动态注入的 endpointHandler
 */

import type { RouteDefinition } from "../types.js";
import { createHandler } from "../types.js";

/**
 * 端点处理器包装器
 * 使用 createHandler 工厂函数统一处理依赖注入
 * 当 endpointHandler 未初始化时返回中文错误信息
 */
const h = createHandler("endpointHandler", {
  errorCode: "ENDPOINT_HANDLER_NOT_AVAILABLE",
  errorMessage: "端点处理器尚未初始化，请稍后再试",
});

/**
 * 端点管理路由定义（扁平化版本）
 */
export const endpointRoutes: RouteDefinition[] = [
  {
    method: "POST",
    path: "/api/endpoint/status",
    handler: h((handler, c) => handler.getEndpointStatus(c)),
  },
  {
    method: "POST",
    path: "/api/endpoint/connect",
    handler: h((handler, c) => handler.connectEndpoint(c)),
  },
  {
    method: "POST",
    path: "/api/endpoint/disconnect",
    handler: h((handler, c) => handler.disconnectEndpoint(c)),
  },
  {
    method: "POST",
    path: "/api/endpoint/add",
    handler: h((handler, c) => handler.addEndpoint(c)),
  },
  {
    method: "POST",
    path: "/api/endpoint/remove",
    handler: h((handler, c) => handler.removeEndpoint(c)),
  },
];

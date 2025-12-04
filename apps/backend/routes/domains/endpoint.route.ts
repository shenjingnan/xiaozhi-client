/**
 * 端点管理路由配置
 * 处理所有端点管理相关的 API 路由
 * 注意：此模块需要延迟初始化处理
 */

import type { Context } from "hono";
import { createErrorResponse } from "../../middlewares/error.middleware.js";
import type { SimpleRouteConfig } from "../types.js";

/**
 * 端点管理路由配置
 * 包含延迟初始化逻辑来处理需要连接管理器的端点处理器
 */
export const endpointRoutes: SimpleRouteConfig = {
  name: "endpoint",
  path: "/api/endpoint",
  description: "端点管理相关 API",
  routes: [
    {
      method: "POST",
      path: "/status",
      handler: (c: Context) => {
        const endpointHandler = c.get("endpointHandler");
        if (!endpointHandler) {
          const errorResponse = createErrorResponse(
            "CONNECTION_MANAGER_NOT_AVAILABLE",
            "连接管理器未初始化"
          );
          return c.json(errorResponse, 503);
        }
        return endpointHandler.getEndpointStatus(c);
      },
    },
    {
      method: "POST",
      path: "/connect",
      handler: (c: Context) => {
        const endpointHandler = c.get("endpointHandler");
        if (!endpointHandler) {
          const errorResponse = createErrorResponse(
            "CONNECTION_MANAGER_NOT_AVAILABLE",
            "连接管理器未初始化"
          );
          return c.json(errorResponse, 503);
        }
        return endpointHandler.connectEndpoint(c);
      },
    },
    {
      method: "POST",
      path: "/disconnect",
      handler: (c: Context) => {
        const endpointHandler = c.get("endpointHandler");
        if (!endpointHandler) {
          const errorResponse = createErrorResponse(
            "CONNECTION_MANAGER_NOT_AVAILABLE",
            "连接管理器未初始化"
          );
          return c.json(errorResponse, 503);
        }
        return endpointHandler.disconnectEndpoint(c);
      },
    },
    {
      method: "POST",
      path: "/reconnect",
      handler: (c: Context) => {
        const endpointHandler = c.get("endpointHandler");
        if (!endpointHandler) {
          const errorResponse = createErrorResponse(
            "CONNECTION_MANAGER_NOT_AVAILABLE",
            "连接管理器未初始化"
          );
          return c.json(errorResponse, 503);
        }
        return endpointHandler.reconnectEndpoint(c);
      },
    },
    {
      method: "POST",
      path: "/add",
      handler: (c: Context) => {
        const endpointHandler = c.get("endpointHandler");
        if (!endpointHandler) {
          const errorResponse = createErrorResponse(
            "CONNECTION_MANAGER_NOT_AVAILABLE",
            "连接管理器未初始化"
          );
          return c.json(errorResponse, 503);
        }
        return endpointHandler.addEndpoint(c);
      },
    },
    {
      method: "POST",
      path: "/remove",
      handler: (c: Context) => {
        const endpointHandler = c.get("endpointHandler");
        if (!endpointHandler) {
          const errorResponse = createErrorResponse(
            "CONNECTION_MANAGER_NOT_AVAILABLE",
            "连接管理器未初始化"
          );
          return c.json(errorResponse, 503);
        }
        return endpointHandler.removeEndpoint(c);
      },
    },
  ],
};

/**
 * 端点管理路由配置
 * 处理所有端点管理相关的 API 路由
 * 注意：此模块需要延迟初始化处理
 */

import type { Context } from "hono";
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
          throw new Error("端点处理器未初始化，请先设置连接管理器");
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
          throw new Error("端点处理器未初始化，请先设置连接管理器");
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
          throw new Error("端点处理器未初始化，请先设置连接管理器");
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
          throw new Error("端点处理器未初始化，请先设置连接管理器");
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
          throw new Error("端点处理器未初始化，请先设置连接管理器");
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
          throw new Error("端点处理器未初始化，请先设置连接管理器");
        }
        return endpointHandler.removeEndpoint(c);
      },
    },
  ],
};

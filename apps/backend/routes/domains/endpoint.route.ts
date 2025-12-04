/**
 * 端点管理路由配置
 * 处理所有端点管理相关的 API 路由
 * 注意：此模块需要延迟初始化处理
 */

import type { Context } from "hono";
import { getEndpointHandlerOrError } from "../helpers/index.js";
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
      handler: async (c: Context) => {
        const handlerOrError = getEndpointHandlerOrError(c);
        if (handlerOrError instanceof Response) {
          return handlerOrError;
        }
        return await handlerOrError.getEndpointStatus(c);
      },
    },
    {
      method: "POST",
      path: "/connect",
      handler: async (c: Context) => {
        const handlerOrError = getEndpointHandlerOrError(c);
        if (handlerOrError instanceof Response) {
          return handlerOrError;
        }
        return await handlerOrError.connectEndpoint(c);
      },
    },
    {
      method: "POST",
      path: "/disconnect",
      handler: async (c: Context) => {
        const handlerOrError = getEndpointHandlerOrError(c);
        if (handlerOrError instanceof Response) {
          return handlerOrError;
        }
        return await handlerOrError.disconnectEndpoint(c);
      },
    },
    {
      method: "POST",
      path: "/reconnect",
      handler: async (c: Context) => {
        const handlerOrError = getEndpointHandlerOrError(c);
        if (handlerOrError instanceof Response) {
          return handlerOrError;
        }
        return await handlerOrError.reconnectEndpoint(c);
      },
    },
    {
      method: "POST",
      path: "/add",
      handler: async (c: Context) => {
        const handlerOrError = getEndpointHandlerOrError(c);
        if (handlerOrError instanceof Response) {
          return handlerOrError;
        }
        return await handlerOrError.addEndpoint(c);
      },
    },
    {
      method: "POST",
      path: "/remove",
      handler: async (c: Context) => {
        const handlerOrError = getEndpointHandlerOrError(c);
        if (handlerOrError instanceof Response) {
          return handlerOrError;
        }
        return await handlerOrError.removeEndpoint(c);
      },
    },
  ],
};

/**
 * 端点管理路由配置
 * 处理所有端点管理相关的 API 路由
 * 使用中间件动态注入的 endpointHandler
 */

import type { Context } from "hono";
import type { AppContext } from "../../types/hono.context.js";
import type { RouteConfig } from "../types.js";

/**
 * 统一的错误响应函数
 */
const createErrorResponse = (code: string, message: string) => {
  return {
    error: {
      code,
      message,
    },
  };
};

/**
 * 端点处理器包装函数
 * 从中间件获取 endpointHandler 并调用相应方法
 */
const withEndpointHandler = async (
  c: Context<AppContext>,
  handlerName: string
): Promise<Response> => {
  // 从中间件获取 endpointHandler
  const endpointHandler = c.get("endpointHandler");

  if (!endpointHandler) {
    const errorResponse = createErrorResponse(
      "ENDPOINT_HANDLER_NOT_AVAILABLE",
      "端点处理器尚未初始化，请稍后再试"
    );
    return c.json(errorResponse, 503);
  }

  // 调用对应的处理方法
  try {
    return await (
      endpointHandler as unknown as Record<
        string,
        (c: Context<AppContext>) => Promise<Response>
      >
    )[handlerName](c);
  } catch (error) {
    console.error(`端点处理器错误 [${handlerName}]:`, error);
    const errorResponse = createErrorResponse(
      "ENDPOINT_HANDLER_ERROR",
      error instanceof Error ? error.message : "端点处理失败"
    );
    return c.json(errorResponse, 500);
  }
};

/**
 * 端点管理路由配置
 * 所有端点管理相关 API 的路由定义
 */
export const endpointRoutes: RouteConfig = {
  name: "endpoint",
  path: "/api/endpoint",
  description: "端点管理相关 API",
  routes: [
    {
      method: "POST",
      path: "/status",
      handler: (c: Context<AppContext>) =>
        withEndpointHandler(c, "getEndpointStatus"),
    },
    {
      method: "POST",
      path: "/connect",
      handler: (c: Context<AppContext>) =>
        withEndpointHandler(c, "connectEndpoint"),
    },
    {
      method: "POST",
      path: "/disconnect",
      handler: (c: Context<AppContext>) =>
        withEndpointHandler(c, "disconnectEndpoint"),
    },
    {
      method: "POST",
      path: "/reconnect",
      handler: (c: Context<AppContext>) =>
        withEndpointHandler(c, "reconnectEndpoint"),
    },
    {
      method: "POST",
      path: "/add",
      handler: (c: Context<AppContext>) =>
        withEndpointHandler(c, "addEndpoint"),
    },
    {
      method: "POST",
      path: "/remove",
      handler: (c: Context<AppContext>) =>
        withEndpointHandler(c, "removeEndpoint"),
    },
  ],
};

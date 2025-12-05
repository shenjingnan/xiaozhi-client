/**
 * 状态查询路由模块
 * 处理所有状态相关的 API 路由
 * 简化版本：移除继承，直接导出路由配置
 */

import type { Context } from "hono";
import type { HandlerDependencies, RouteConfig } from "../types.js";

/**
 * 状态查询路由配置
 * 从原有的 StatusRoutes 类迁移而来，保持功能完全一致
 */
export const statusRoutes: RouteConfig = {
  name: "status",
  path: "/api/status",
  description: "状态查询相关 API",
  routes: [
    {
      method: "GET",
      path: "",
      handler: (c: Context) => {
        const { statusApiHandler } = c.get(
          "dependencies"
        ) as HandlerDependencies;
        return statusApiHandler.getStatus(c);
      },
    },
    {
      method: "GET",
      path: "/client",
      handler: (c: Context) => {
        const { statusApiHandler } = c.get(
          "dependencies"
        ) as HandlerDependencies;
        return statusApiHandler.getClientStatus(c);
      },
    },
    {
      method: "PUT",
      path: "/client",
      handler: (c: Context) => {
        const { statusApiHandler } = c.get(
          "dependencies"
        ) as HandlerDependencies;
        return statusApiHandler.updateClientStatus(c);
      },
    },
    {
      method: "POST",
      path: "/reset",
      handler: (c: Context) => {
        const { statusApiHandler } = c.get(
          "dependencies"
        ) as HandlerDependencies;
        return statusApiHandler.resetStatus(c);
      },
    },
    {
      method: "GET",
      path: "/mcp-servers",
      handler: (c: Context) => {
        const { statusApiHandler } = c.get(
          "dependencies"
        ) as HandlerDependencies;
        return statusApiHandler.getActiveMCPServers(c);
      },
    },
    {
      method: "PUT",
      path: "/mcp-servers",
      handler: (c: Context) => {
        const { statusApiHandler } = c.get(
          "dependencies"
        ) as HandlerDependencies;
        return statusApiHandler.setActiveMCPServers(c);
      },
    },
  ],
};

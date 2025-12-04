/**
 * 状态查询路由模块
 * 处理所有状态相关的 API 路由
 * 简化版本：移除继承，直接导出路由配置
 */

import type { Context } from "hono";
import type { SimpleRouteConfig } from "../types.js";

/**
 * 状态查询路由配置
 * 从原有的 StatusRoutes 类迁移而来，保持功能完全一致
 */
export const statusRoutes: SimpleRouteConfig = {
  name: "status",
  path: "/api/status",
  description: "状态查询相关 API",
  routes: [
    {
      method: "GET",
      path: "",
      handler: (c: Context) => {
        const { statusApiHandler } = c.get("dependencies") as any;
        return statusApiHandler.getStatus(c);
      },
    },
    {
      method: "GET",
      path: "/client",
      handler: (c: Context) => {
        const { statusApiHandler } = c.get("dependencies") as any;
        return statusApiHandler.getClientStatus(c);
      },
    },
    {
      method: "POST",
      path: "/reset",
      handler: (c: Context) => {
        const { statusApiHandler } = c.get("dependencies") as any;
        return statusApiHandler.resetStatus(c);
      },
    },
  ],
};
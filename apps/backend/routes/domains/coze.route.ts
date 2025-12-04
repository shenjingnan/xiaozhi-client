/**
 * 扣子 API 路由配置
 * 处理所有扣子相关的 API 路由
 */

import type { Context } from "hono";
import type { SimpleRouteConfig } from "../types.js";

export const cozeRoutes: SimpleRouteConfig = {
  name: "coze",
  path: "/api/coze",
  description: "扣子 API 相关路由",
  routes: [
    {
      method: "GET",
      path: "/workspaces",
      handler: (c: Context) => {
        const handler = c.get("cozeApiHandler");
        return handler.getWorkspaces(c);
      },
    },
    {
      method: "GET",
      path: "/workflows",
      handler: (c: Context) => {
        const handler = c.get("cozeApiHandler");
        return handler.getWorkflows(c);
      },
    },
    {
      method: "POST",
      path: "/cache/clear",
      handler: (c: Context) => {
        const handler = c.get("cozeApiHandler");
        return handler.clearCache(c);
      },
    },
    {
      method: "GET",
      path: "/cache/stats",
      handler: (c: Context) => {
        const handler = c.get("cozeApiHandler");
        return handler.getCacheStats(c);
      },
    },
  ],
};

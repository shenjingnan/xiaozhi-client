/**
 * 扣子 API 路由配置
 * 处理所有扣子相关的 API 路由
 */

import type { Context } from "hono";
import type { HandlerDependencies, RouteDefinition } from "../types.js";

export const cozeRoutes: RouteDefinition[] = [
  {
    method: "GET",
    path: "/api/coze/workspaces",
    name: "coze-workspaces",
    handler: (c: Context) => {
      const { cozeApiHandler } = c.get("dependencies") as HandlerDependencies;
      return cozeApiHandler.getWorkspaces(c);
    },
  },
  {
    method: "GET",
    path: "/api/coze/workflows",
    name: "coze-workflows",
    handler: (c: Context) => {
      const { cozeApiHandler } = c.get("dependencies") as HandlerDependencies;
      return cozeApiHandler.getWorkflows(c);
    },
  },
  {
    method: "POST",
    path: "/api/coze/cache/clear",
    name: "coze-cache-clear",
    handler: (c: Context) => {
      const { cozeApiHandler } = c.get("dependencies") as HandlerDependencies;
      return cozeApiHandler.clearCache(c);
    },
  },
  {
    method: "GET",
    path: "/api/coze/cache/stats",
    name: "coze-cache-stats",
    handler: (c: Context) => {
      const { cozeApiHandler } = c.get("dependencies") as HandlerDependencies;
      return cozeApiHandler.getCacheStats(c);
    },
  },
];

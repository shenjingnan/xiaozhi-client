/**
 * 更新管理路由配置
 * 处理更新相关的 API 路由
 */

import type { Context } from "hono";
import type { HandlerDependencies, RouteDefinition } from "../types.js";

export const updateRoutes: RouteDefinition[] = [
  {
    method: "POST",
    path: "/api/update",
    name: "update-perform",
    handler: (c: Context) => {
      const { updateApiHandler } = c.get("dependencies") as HandlerDependencies;
      return updateApiHandler.performUpdate(c);
    },
  },
];

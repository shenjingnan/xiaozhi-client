/**
 * 更新管理路由配置
 * 处理更新相关的 API 路由
 */

import type { Context } from "hono";
import type { HandlerDependencies, SimpleRouteConfig } from "../types.js";

export const updateRoutes: SimpleRouteConfig = {
  name: "update",
  path: "/api",
  description: "更新管理相关 API",
  routes: [
    {
      method: "POST",
      path: "/update",
      handler: (c: Context) => {
        const { updateApiHandler } = c.get(
          "dependencies"
        ) as HandlerDependencies;
        return updateApiHandler.performUpdate(c);
      },
    },
  ],
};

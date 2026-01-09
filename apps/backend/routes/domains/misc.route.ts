/**
 * 通用API路由配置
 * 处理不特定于某个模块的通用 API 路由
 */

import type { Context } from "hono";
import type { HandlerDependencies, RouteDefinition } from "../types.js";

export const miscRoutes: RouteDefinition[] = [
  {
    method: "POST",
    path: "/api/restart",
    name: "misc-restart",
    handler: (c: Context) => {
      const { serviceApiHandler } = c.get(
        "dependencies"
      ) as HandlerDependencies;
      return serviceApiHandler.restartService(c);
    },
  },
];

/**
 * 通用API路由配置
 * 处理不特定于某个模块的通用 API 路由
 */

import type { Context } from "hono";
import type { HandlerDependencies, SimpleRouteConfig } from "../types.js";

export const miscRoutes: SimpleRouteConfig = {
  name: "misc",
  path: "/api",
  description: "通用 API 路由",
  routes: [
    {
      method: "POST",
      path: "/restart",
      handler: (c: Context) => {
        const { serviceApiHandler } = c.get(
          "dependencies"
        ) as HandlerDependencies;
        return serviceApiHandler.restartService(c);
      },
      // 注意：此路由是为了向后兼容保留，与 /api/services/restart 功能重复
    },
  ],
};

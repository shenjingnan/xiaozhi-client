/**
 * 静态文件路由配置
 * 处理静态文件服务相关的路由
 */

import type { Context } from "hono";
import type { SimpleRouteConfig } from "../types.js";

export const staticRoutes: SimpleRouteConfig = {
  name: "static",
  path: "/", // 静态文件服务使用根路径
  description: "静态文件服务路由",
  routes: [
    {
      method: "GET",
      path: "*",
      handler: (c: Context) => {
        const handler = c.get("staticFileHandler");
        return handler.handleStaticFile(c);
      },
    },
  ],
};

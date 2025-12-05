/**
 * 静态文件路由配置
 * 处理静态文件服务相关的路由
 */

import type { Context } from "hono";
import type { HandlerDependencies, RouteConfig } from "../types.js";

export const staticRoutes: RouteConfig = {
  name: "static",
  path: "/", // 静态文件服务使用根路径
  description: "静态文件服务路由",
  routes: [
    {
      method: "GET",
      path: "*",
      handler: async (c: Context) => {
        // 如果路径以 /api/ 开头，不处理静态文件，直接返回 404
        if (c.req.path.startsWith("/api/")) {
          return c.notFound();
        }
        const dependencies = c.get("dependencies") as HandlerDependencies;
        return await dependencies.staticFileHandler.handleStaticFile(c);
      },
    },
  ],
};

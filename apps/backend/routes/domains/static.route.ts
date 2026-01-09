/**
 * 静态文件路由配置
 * 处理静态文件服务相关的路由
 */

import type { Context } from "hono";
import type { HandlerDependencies, RouteDefinition } from "../types.js";

export const staticRoutes: RouteDefinition[] = [
  {
    method: "GET",
    path: "/*",
    name: "static-files",
    handler: async (c: Context) => {
      // 如果路径以 /api/ 开头，不处理静态文件，直接返回 404
      if (c.req.path.startsWith("/api/")) {
        return c.notFound();
      }
      const dependencies = c.get("dependencies") as HandlerDependencies;
      return await dependencies.staticFileHandler.handleStaticFile(c);
    },
  },
];

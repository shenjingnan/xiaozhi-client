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
        // 如果路径以 /api/ 开头，不处理
        if (c.req.path.startsWith("/api/")) {
          // 返回 404 让全局 404 处理器处理
          // 但是我们需要显式调用 next() 来让下一个处理器处理
          // 在 Hono 中，我们可以返回一个特殊的响应来触发 404
          return c.notFound();
        }
        const { staticFileHandler } = c.get("dependencies") as any;
        return staticFileHandler.handleStaticFile(c);
      },
    },
  ],
};

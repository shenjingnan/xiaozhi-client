/**
 * 静态文件路由配置
 * 处理静态文件服务相关的路由
 */

import type { Context } from "hono";
import type { HandlerDependencies, RouteConfig } from "../types.js";

/**
 * 从 Hono context 中获取 HandlerDependencies
 * @param c - Hono context 对象
 * @returns HandlerDependencies 实例
 */
function getHandlerDependencies(c: Context): HandlerDependencies {
  const dependencies = c.get("dependencies");

  if (!dependencies) {
    throw new Error("Handler dependencies not configured");
  }

  return dependencies as HandlerDependencies;
}

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
        const { staticFileHandler } = getHandlerDependencies(c);
        return await staticFileHandler.handleStaticFile(c);
      },
    },
  ],
};

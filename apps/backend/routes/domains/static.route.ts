/**
 * 静态文件路由配置
 * 处理静态文件服务相关的路由
 */

import type { Context } from "hono";
import type { HandlerDependencies, SimpleRouteConfig } from "../types.js";

/**
 * 安全地从 Hono context 中获取 HandlerDependencies
 * @param c - Hono context 对象
 * @returns HandlerDependencies 实例
 */
function getHandlerDependencies(c: Context): HandlerDependencies {
  const dependencies = c.get("dependencies");

  // 类型守卫：检查 dependencies 是否符合 HandlerDependencies 接口
  if (
    dependencies &&
    typeof dependencies === "object" &&
    "staticFileHandler" in dependencies
  ) {
    return dependencies as HandlerDependencies;
  }

  throw new Error(
    "Handler dependencies not properly configured in Hono context"
  );
}

export const staticRoutes: SimpleRouteConfig = {
  name: "static",
  path: "/", // 静态文件服务使用根路径
  description: "静态文件服务路由",
  routes: [
    {
      method: "GET",
      path: "*",
      handler: async (c: Context) => {
        // 如果路径以 /api/ 开头，不处理
        if (c.req.path.startsWith("/api/")) {
          // 返回 404 让全局 404 处理器处理
          // 但是我们需要显式调用 next() 来让下一个处理器处理
          // 在 Hono 中，我们可以返回一个特殊的响应来触发 404
          return c.notFound();
        }
        const { staticFileHandler } = getHandlerDependencies(c);
        return await staticFileHandler.handleStaticFile(c);
      },
    },
  ],
};

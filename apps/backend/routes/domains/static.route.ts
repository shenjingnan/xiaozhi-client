/**
 * 静态文件路由配置
 * 处理静态文件服务相关的路由
 */

import type { RouteDefinition } from "../types.js";
import { createHandler } from "../types.js";

const h = createHandler("staticFileHandler");

export const staticRoutes: RouteDefinition[] = [
  {
    method: "GET",
    path: "/*",
    handler: h(async (handler, c) => {
      // 如果路径以 /api/ 开头，不处理静态文件，直接返回 404
      if (c.req.path.startsWith("/api/")) {
        return c.notFound();
      }
      return await handler.handleStaticFile(c);
    }),
  },
];

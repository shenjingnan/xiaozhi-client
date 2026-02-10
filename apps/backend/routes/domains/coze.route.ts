/**
 * 扣子 API 路由配置
 * 处理所有扣子相关的 API 路由
 */

import type { RouteDefinition } from "@/routes/types.js";
import { createHandler } from "@/routes/types.js";

const h = createHandler("cozeHandler");

export const cozeRoutes: RouteDefinition[] = [
  {
    method: "GET",
    path: "/api/coze/workspaces",
    handler: h((handler, c) => handler.getWorkspaces(c)),
  },
  {
    method: "GET",
    path: "/api/coze/workflows",
    handler: h((handler, c) => handler.getWorkflows(c)),
  },
  {
    method: "POST",
    path: "/api/coze/cache/clear",
    handler: h((handler, c) => handler.clearCache(c)),
  },
  {
    method: "GET",
    path: "/api/coze/cache/stats",
    handler: h((handler, c) => handler.getCacheStats(c)),
  },
];

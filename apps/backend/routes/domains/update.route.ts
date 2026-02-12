/**
 * 更新管理路由配置
 * 处理更新相关的 API 路由
 */

import type { RouteDefinition } from "@/routes/types.js";
import { createHandler } from "@/routes/types.js";

const h = createHandler("updateApiHandler");

export const updateRoutes: RouteDefinition[] = [
  {
    method: "POST",
    path: "/api/update",
    handler: h((handler, c) => handler.performUpdate(c)),
  },
];

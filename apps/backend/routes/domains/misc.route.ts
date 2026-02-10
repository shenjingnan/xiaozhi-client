/**
 * 通用API路由配置
 * 处理不特定于某个模块的通用 API 路由
 */

import type { RouteDefinition } from "@/routes/types.js";
import { createHandler } from "@/routes/types.js";

const h = createHandler("serviceApiHandler");

export const miscRoutes: RouteDefinition[] = [
  {
    method: "POST",
    path: "/api/restart",
    handler: h((handler, c) => handler.restartService(c)),
  },
];

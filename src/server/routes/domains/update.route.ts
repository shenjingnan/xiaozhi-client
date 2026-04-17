/**
 * 更新管理路由配置
 * 处理更新相关的 API 路由
 *
 * 路由：
 * - POST /api/update：触发版本安装
 * - GET /api/install/logs?installId=xxx：SSE 安装日志流
 */

import type { RouteDefinition } from "../../routes/types.js";
import { createHandler } from "../../routes/types.js";

const h = createHandler("updateApiHandler");

export const updateRoutes: RouteDefinition[] = [
  {
    method: "POST",
    path: "/api/update",
    handler: h((handler, c) => handler.performUpdate(c)),
  },
  {
    method: "GET",
    path: "/api/install/logs",
    handler: h((handler, c) => handler.getInstallLogs(c)),
  },
];

/**
 * 工具调用日志路由配置
 * 处理工具调用日志相关的 API 路由
 */

import type { RouteDefinition } from "../types.js";
import { createHandler } from "../types.js";

const h = createHandler("toolCallLogApiHandler");

export const toolLogsRoutes: RouteDefinition[] = [
  {
    method: "GET",
    path: "/api/tool-calls/logs",
    name: "tool-logs-get",
    handler: h((handler, c) => handler.getToolCallLogs(c)),
  },
];

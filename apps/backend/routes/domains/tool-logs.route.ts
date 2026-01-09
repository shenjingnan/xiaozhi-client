/**
 * 工具调用日志路由配置
 * 处理工具调用日志相关的 API 路由
 */

import type { Context } from "hono";
import type { HandlerDependencies, RouteDefinition } from "../types.js";

export const toolLogsRoutes: RouteDefinition[] = [
  {
    method: "GET",
    path: "/api/tool-calls/logs",
    name: "tool-logs-get",
    handler: (c: Context) => {
      const { toolCallLogApiHandler } = c.get(
        "dependencies"
      ) as HandlerDependencies;
      return toolCallLogApiHandler.getToolCallLogs(c);
    },
  },
];

/**
 * 工具调用日志路由配置
 * 处理工具调用日志相关的 API 路由
 */

import type { Context } from "hono";
import type { HandlerDependencies, RouteConfig } from "../types.js";

export const toolLogsRoutes: RouteConfig = {
  name: "tool-logs",
  path: "/api/tool-calls",
  description: "工具调用日志相关 API",
  routes: [
    {
      method: "GET",
      path: "/logs",
      handler: (c: Context) => {
        const { toolCallLogApiHandler } = c.get(
          "dependencies"
        ) as HandlerDependencies;
        return toolCallLogApiHandler.getToolCallLogs(c);
      },
    },
  ],
};

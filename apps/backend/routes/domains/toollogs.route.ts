/**
 * 工具调用日志路由配置
 * 处理工具调用日志相关的 API 路由
 */

import type { Context } from "hono";
import type { SimpleRouteConfig } from "../types.js";

export const toollogsRoutes: SimpleRouteConfig = {
  name: "toollogs",
  path: "/api/tool-calls",
  description: "工具调用日志相关 API",
  routes: [
    {
      method: "GET",
      path: "/logs",
      handler: (c: Context) => {
        const handler = c.get("toolCallLogApiHandler");
        return handler.getToolCallLogs(c);
      },
    },
  ],
};

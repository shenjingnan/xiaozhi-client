/**
 * 工具调用日志路由模块
 * 处理工具调用日志相关的 API 路由
 */

import { BaseRoute } from "../../BaseRoute.js";
import type { RouteDomainConfig } from "../../types.js";

/**
 * 工具调用日志路由类
 * 负责注册工具调用日志相关的所有 API 路由
 */
export class ToolLogsRoutes extends BaseRoute {
  /**
   * 获取工具调用日志路由域配置
   * @returns 路由域配置
   */
  getRouteConfig(): RouteDomainConfig {
    const handler = this.getRequiredDependency("toolCallLogApiHandler");

    return {
      name: "toollogs",
      description: "工具调用日志相关 API",
      path: "/api/tool-calls",
      routes: [
        {
          method: "GET",
          path: "/logs",
          handler: (c) => handler.getToolCallLogs(c),
        },
      ],
    };
  }
}

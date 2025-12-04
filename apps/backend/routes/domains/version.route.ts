/**
 * 版本信息路由模块
 * 处理所有版本相关的 API 路由
 * 简化版本：移除继承，直接导出路由配置
 */

import type { Context } from "hono";
import type { SimpleRouteConfig } from "../types.js";

/**
 * 版本信息路由配置
 * 从原有的 VersionRoutes 类迁移而来，保持功能完全一致
 */
export const versionRoutes: SimpleRouteConfig = {
  name: "version",
  path: "/api/version",
  description: "版本信息相关 API",
  routes: [
    {
      method: "GET",
      path: "",
      handler: (c: Context) => {
        const { versionApiHandler } = c.get("dependencies") as any;
        return versionApiHandler.getVersion(c);
      },
    },
    {
      method: "GET",
      path: "/simple",
      handler: (c: Context) => {
        const { versionApiHandler } = c.get("dependencies") as any;
        return versionApiHandler.getVersionSimple(c);
      },
    },
  ],
};
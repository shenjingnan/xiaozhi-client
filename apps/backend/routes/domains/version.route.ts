/**
 * 版本信息路由模块
 * 处理所有版本相关的 API 路由
 */

import type { Context } from "hono";
import type { HandlerDependencies, RouteDefinition } from "../types.js";

/**
 * 版本信息路由定义（扁平化版本）
 */
export const versionRoutes: RouteDefinition[] = [
  {
    method: "GET",
    path: "/api/version",
    name: "version-get",
    handler: (c: Context) => {
      const { versionApiHandler } = c.get(
        "dependencies"
      ) as HandlerDependencies;
      return versionApiHandler.getVersion(c);
    },
  },
  {
    method: "GET",
    path: "/api/version/simple",
    name: "version-get-simple",
    handler: (c: Context) => {
      const { versionApiHandler } = c.get(
        "dependencies"
      ) as HandlerDependencies;
      return versionApiHandler.getVersionSimple(c);
    },
  },
  {
    method: "DELETE",
    path: "/api/version/cache",
    name: "version-clear-cache",
    handler: (c: Context) => {
      const { versionApiHandler } = c.get(
        "dependencies"
      ) as HandlerDependencies;
      return versionApiHandler.clearVersionCache(c);
    },
  },
  {
    method: "GET",
    path: "/api/version/latest",
    name: "version-check-latest",
    handler: (c: Context) => {
      const { versionApiHandler } = c.get(
        "dependencies"
      ) as HandlerDependencies;
      return versionApiHandler.checkLatestVersion(c);
    },
  },
];

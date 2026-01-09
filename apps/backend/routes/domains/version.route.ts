/**
 * 版本信息路由模块
 * 处理所有版本相关的 API 路由
 */

import type { RouteDefinition } from "../types.js";
import { createHandler } from "../types.js";

const h = createHandler("versionApiHandler");

/**
 * 版本信息路由定义
 */
export const versionRoutes: RouteDefinition[] = [
  {
    method: "GET",
    path: "/api/version",
    name: "version-get",
    handler: h((handler, c) => handler.getVersion(c)),
  },
  {
    method: "GET",
    path: "/api/version/simple",
    name: "version-get-simple",
    handler: h((handler, c) => handler.getVersionSimple(c)),
  },
  {
    method: "DELETE",
    path: "/api/version/cache",
    name: "version-clear-cache",
    handler: h((handler, c) => handler.clearVersionCache(c)),
  },
  {
    method: "GET",
    path: "/api/version/latest",
    name: "version-check-latest",
    handler: h((handler, c) => handler.checkLatestVersion(c)),
  },
];

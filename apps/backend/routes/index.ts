/**
 * 路由系统入口
 * 统一导出路由系统相关的所有类型、类和工具
 */

// 类型定义
export type {
  RouteConfig,
  RouteDomainConfig,
  HandlerDependencies,
  RouteRegistryOptions,
  RouteStatistics,
} from "./types.js";

// 核心类
export { BaseRoute } from "./BaseRoute.js";
export { RouteRegistry } from "./RouteRegistry.js";
export { RouteAggregator } from "./RouteAggregator.js";

// 重新导出 Hono 相关类型以方便使用
export type { Context } from "hono";
export type { AppContext } from "../types/hono.context.js";

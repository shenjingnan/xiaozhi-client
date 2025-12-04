/**
 * 路由系统入口
 * 统一导出路由系统相关的所有类型、类和工具
 * 重构版本：使用简化的路由架构
 */

// 类型定义
export type {
  RouteConfig,
  RouteDomainConfig,
  HandlerDependencies,
  RouteRegistryOptions,
  RouteStatistics,
  HTTPMethod,
  RouteDefinition,
  SimpleRouteConfig,
  RouteStats,
} from "./types.js";

// 简化的核心类
export { SimpleRouteManager } from "./SimpleRouteManager.js";

// 路由域导出
export * from "./domains/index.js";

// 重新导出 Hono 相关类型以方便使用
export type { Context } from "hono";
export type { AppContext } from "../types/hono.context.js";

// 重新导出处理器类型
export type { MCPEndpointApiHandler } from "../handlers/index.js";

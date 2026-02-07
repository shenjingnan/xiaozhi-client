// 类型定义

// 重新导出 Hono 相关类型以方便使用
export type { Context } from "hono";
// 重新导出处理器类型
export type { EndpointHandler } from "../handlers/index.js";
export type { AppContext } from "../types/hono.context.js";
// 路由域导出
export * from "./domains/index.js";
// 核心类
export { RouteManager } from "./RouteManager.js";
export type {
  HandlerDependencies,
  HTTPMethod,
  RouteDefinition,
  RouteRegistryOptions,
  RouteStatistics,
} from "./types.js";

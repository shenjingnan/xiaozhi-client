// 类型定义
export type {
  HandlerDependencies,
  RouteRegistryOptions,
  RouteStatistics,
  HTTPMethod,
  RouteDefinition,
} from "./types.js";

// 核心类
export { RouteManager } from "./RouteManager.js";

// 路由域导出
export * from "./domains/index.js";

// 重新导出 Hono 相关类型以方便使用
export type { Context } from "hono";
export type { AppContext } from "../types/hono.context.js";

// 重新导出处理器类型
export type { MCPEndpointApiHandler } from "../handlers/index.js";

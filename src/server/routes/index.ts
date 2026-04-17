/**
 * 路由系统统一导出模块
 *
 * 提供 API 路由的完整类型定义、路由管理器和路由域配置的统一导出接口。
 * 本模块是路由系统的核心入口点，整合了所有路由相关的功能和类型。
 *
 * @packageDocumentation
 */

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
export type { EndpointHandler, TTSApiHandler } from "../handlers/index.js";

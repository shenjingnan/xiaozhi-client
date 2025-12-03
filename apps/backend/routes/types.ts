/**
 * 路由系统相关类型定义
 * 提供类型安全的路由配置和依赖注入
 */

import type { Context } from "hono";
import type { ConfigApiHandler } from "../handlers/ConfigApiHandler.js";
import type { CozeApiHandler } from "../handlers/CozeApiHandler.js";
import type { MCPEndpointApiHandler } from "../handlers/MCPEndpointApiHandler.js";
import type { MCPRouteHandler } from "../handlers/MCPRouteHandler.js";
import type { MCPServerApiHandler } from "../handlers/MCPServerApiHandler.js";
import type { ServiceApiHandler } from "../handlers/ServiceApiHandler.js";
import type { StaticFileHandler } from "../handlers/StaticFileHandler.js";
import type { StatusApiHandler } from "../handlers/StatusApiHandler.js";
import type { ToolApiHandler } from "../handlers/ToolApiHandler.js";
import type { ToolCallLogApiHandler } from "../handlers/ToolCallLogApiHandler.js";
import type { UpdateApiHandler } from "../handlers/UpdateApiHandler.js";
import type { VersionApiHandler } from "../handlers/VersionApiHandler.js";
import type { IndependentXiaozhiConnectionManager } from "../services/XiaozhiConnectionManagerSingleton.js";
import type { AppContext } from "../types/hono.context.js";

/**
 * 路由配置接口
 * 定义单个路由的完整配置信息
 */
export interface RouteConfig {
  /** 路由路径（相对于域路径） */
  path: string;
  /** HTTP 方法 */
  method: "GET" | "POST" | "PUT" | "DELETE" | "PATCH";
  /** 路由处理函数 */
  handler: (c: Context<AppContext>) => Promise<Response> | Response;
  /** 路由级别的中间件（可选） */
  middleware?: Array<(c: Context, next: () => Promise<void>) => Promise<void>>;
}

/**
 * 路由域配置接口
 * 定义一个功能域的所有路由配置
 */
export interface RouteDomainConfig {
  /** 域名称（英文，用于标识） */
  name: string;
  /** 域描述（中文，用于文档和日志） */
  description: string;
  /** 域的基础路径 */
  path: string;
  /** 域内的所有路由配置 */
  routes: RouteConfig[];
  /** 域级别的中间件（可选，应用于域内所有路由） */
  middleware?: Array<(c: Context, next: () => Promise<void>) => Promise<void>>;
}

/**
 * 处理器依赖接口
 * 定义路由系统需要的所有处理器依赖
 */
export interface HandlerDependencies {
  /** 配置管理处理器 */
  configApiHandler: ConfigApiHandler;
  /** 状态查询处理器 */
  statusApiHandler: StatusApiHandler;
  /** 服务管理处理器 */
  serviceApiHandler: ServiceApiHandler;
  /** 工具调用处理器 */
  toolApiHandler: ToolApiHandler;
  /** 工具调用日志处理器 */
  toolCallLogApiHandler: ToolCallLogApiHandler;
  /** 版本信息处理器 */
  versionApiHandler: VersionApiHandler;
  /** 静态文件处理器 */
  staticFileHandler: StaticFileHandler;
  /** MCP 路由处理器 */
  mcpRouteHandler: MCPRouteHandler;
  /** MCP 服务器管理处理器（可选） */
  mcpServerApiHandler?: MCPServerApiHandler;
  /** 更新管理处理器 */
  updateApiHandler: UpdateApiHandler;
  /** 扣子 API 处理器 - 使用静态方法，所以是类而不是实例 */
  cozeApiHandler: typeof CozeApiHandler;
  /** 创建端点处理器的工厂函数 */
  createEndpointHandler: (
    connectionManager: IndependentXiaozhiConnectionManager
  ) => MCPEndpointApiHandler;
}

/**
 * 路由注册选项接口
 * 控制路由注册的行为
 */
export interface RouteRegistryOptions {
  /** 是否启用详细的路由注册日志 */
  verboseLogging?: boolean;
  /** 是否在注册失败时抛出异常 */
  throwOnRegistrationError?: boolean;
}

/**
 * 路由统计信息接口
 * 提供路由系统的运行时统计
 */
export interface RouteStatistics {
  /** 注册的域数量 */
  domainCount: number;
  /** 注册的路由总数 */
  totalRouteCount: number;
  /** 各域的路由数量分布 */
  routeDistribution: Record<string, number>;
  /** 支持的 HTTP 方法统计 */
  methodDistribution: Record<string, number>;
}

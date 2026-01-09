/**
 * 路由系统相关类型定义
 * 提供类型安全的路由配置和依赖注入
 */

import type {
  ConfigApiHandler,
  CozeApiHandler,
  MCPEndpointApiHandler,
  MCPRouteHandler,
  MCPServerApiHandler,
  ServiceApiHandler,
  StaticFileHandler,
  StatusApiHandler,
  ToolApiHandler,
  ToolCallLogApiHandler,
  UpdateApiHandler,
  VersionApiHandler,
} from "@handlers/index.js";
import type { Context, MiddlewareHandler } from "hono";

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
  /** 扣子 API 处理器 */
  cozeApiHandler: CozeApiHandler;
  /** 小智接入点处理器（通过中间件动态注入） */
  endpointHandler?: MCPEndpointApiHandler;
}

/**
 * 路由注册选项接口
 * 控制路由注册的行为
 *
 * @future-feature 计划在 v2.0.0 中实现，用于提供更灵活的路由注册控制
 * - 支持详细的注册日志，便于调试和监控
 * - 支持注册失败时的异常处理策略配置
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
 *
 * @future-feature 计划在 v2.0.0 中实现，用于提供路由系统的监控和分析能力
 * - 统计各域的路由数量分布
 * - 分析 HTTP 方法的使用情况
 * - 支持路由性能监控和优化建议
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

/**
 * HTTP 方法类型
 */
export type HTTPMethod = "GET" | "POST" | "PUT" | "DELETE" | "PATCH";

/**
 * 路由定义接口
 * 定义单个路由的配置信息
 */
export interface RouteDefinition {
  /** HTTP 方法 */
  method: HTTPMethod;
  /** 完整路由路径（相对于应用根路径） */
  path: string;
  /** 处理函数 */
  handler: (c: Context) => Promise<Response | undefined>;
  /** 路由级别的中间件 */
  middleware?: MiddlewareHandler[];
}

/**
 * 路由组接口
 * 用于需要组级别中间件或元数据的场景
 */
export interface RouteGroup {
  /** 路由定义数组 */
  routes: RouteDefinition[];
  /** 可选的组名称（用于日志和调试） */
  name?: string;
  /** 可选的组描述 */
  description?: string;
  /** 组级别的中间件（应用到组内所有路由） */
  middleware?: MiddlewareHandler[];
}

/**
 * 路由注册联合类型
 * 支持直接注册路由数组或路由组
 */
export type RouteRegistry = RouteDefinition[] | RouteGroup;

/**
 * 判断是否为路由组
 */
export function isRouteGroup(route: RouteRegistry): route is RouteGroup {
  return Array.isArray((route as RouteGroup).routes);
}

/**
 * 将路由注册转换为路由数组
 */
export function normalizeRoutes(route: RouteRegistry): RouteDefinition[] {
  if (isRouteGroup(route)) {
    const { routes, middleware } = route;
    if (middleware && middleware.length > 0) {
      return routes.map((r) => ({
        ...r,
        middleware: [...middleware, ...(r.middleware || [])],
      }));
    }
    return routes;
  }
  return route;
}

/**
 * 创建路由处理器辅助函数
 * 自动处理依赖注入，减少样板代码
 *
 * @example
 * ```typescript
 * const h = createHandler("versionApiHandler");
 * export const routes = [
 *   {
 *     method: "GET",
 *     path: "/api/version",
 *     handler: h((handler, c) => handler.getVersion(c)),
 *   }
 * ];
 * ```
 */
export function createHandler<K extends keyof HandlerDependencies>(
  dependencyKey: K
): (
  method: (handler: HandlerDependencies[K], c: Context) => Promise<Response>
) => RouteDefinition["handler"] {
  return (method) => (c: Context) => {
    const dependencies = c.get("dependencies") as HandlerDependencies;
    const handler = dependencies[dependencyKey];
    return method(handler, c);
  };
}

/**
 * 路由域配置接口
 * @deprecated 使用 RouteDefinition[] 代替
 */
export interface RouteConfig {
  /** 域名称 */
  name: string;
  /** 域基础路径 */
  path: string;
  /** 域描述 */
  description?: string;
  /** 路由定义列表 */
  routes: RouteDefinition[];
  /** 域级别的中间件 */
  middleware?: MiddlewareHandler[];
}

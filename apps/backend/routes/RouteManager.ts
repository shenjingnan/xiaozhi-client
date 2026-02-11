/**
 * 路由管理器
 * 提供直接、高效的路由注册和管理功能
 */

import type { Logger } from "@/Logger.js";
import type { Context, Hono, Next } from "hono";
import type { AppContext } from "../types/hono.context.js";
import {
  type RouteDefinition,
  type RouteRegistry,
  normalizeRoutes,
} from "./types.js";

/**
 * 路由管理器
 * 直接管理路由配置，提供路由注册和应用功能
 * 通过依赖注入接收 Logger 实例，保持与项目日志系统的一致性
 */
export class RouteManager {
  private routes: Map<string, RouteDefinition[]> = new Map();

  constructor(private logger: Logger) {}

  /**
   * 注册单个路由模块
   */
  registerRoute(name: string, routeRegistry: RouteRegistry): void {
    const routes = normalizeRoutes(routeRegistry);
    if (this.routes.has(name)) {
      this.logger.warn(`路由组 '${name}' 已存在，将被覆盖`);
    }
    this.routes.set(name, routes);
    this.logger.info(`已注册路由组: ${name} (${routes.length} 个路由)`);
  }

  /**
   * 批量注册路由模块
   */
  registerRoutes(routeRegistries: Record<string, RouteRegistry>): void {
    this.logger.info(
      `开始批量注册 ${Object.keys(routeRegistries).length} 个路由组...`
    );

    for (const [name, routeRegistry] of Object.entries(routeRegistries)) {
      this.registerRoute(name, routeRegistry);
    }

    this.logger.info(`批量注册完成，共注册 ${this.routes.size} 个路由组`);
  }

  /**
   * 获取所有注册的路由配置
   */
  getAllRoutes(): Map<string, RouteDefinition[]> {
    return new Map(this.routes);
  }

  /**
   * 获取指定名称的路由配置
   */
  getRoute(name: string): RouteDefinition[] | undefined {
    return this.routes.get(name);
  }

  /**
   * 将路由应用到 Hono 应用实例
   */
  applyToApp(app: Hono<AppContext>): void {
    // 获取所有路由并排序，确保 static 路由最后应用
    const routeEntries = Array.from(this.routes.entries());
    routeEntries.sort(([nameA], [nameB]) => {
      // static 路由永远排在最后
      if (nameA === "static") return 1;
      if (nameB === "static") return -1;
      return 0;
    });

    let totalRouteCount = 0;
    for (const [groupName, routes] of routeEntries) {
      try {
        for (const route of routes) {
          this.applyRouteDefinition(app, route, groupName);
          totalRouteCount++;
        }
      } catch (error) {
        this.logger.error(`✗ 应用路由组失败: ${groupName}`, error);
      }
    }

    this.logger.info(`路由应用完成，共 ${totalRouteCount} 个路由`);
  }

  /**
   * 应用单个路由定义到 Hono 应用
   */
  private applyRouteDefinition(
    app: Hono<AppContext>,
    route: RouteDefinition,
    groupName: string
  ): void {
    const { method, path, handler, middleware = [] } = route;

    // 创建包装的处理器，添加错误处理
    const wrappedHandler = async (c: Context<AppContext>, next: Next) => {
      try {
        return await handler(c);
      } catch (error) {
        this.logger.error(`路由处理错误 [${method} ${path}]:`, error);
        return c.fail(
          "HANDLER_ERROR",
          "处理器执行失败",
          error instanceof Error ? error.message : String(error),
          500
        );
      }
    };

    // 使用动态方法调用避免重复代码
    // 注意：Hono 4.11.4 对展开中间件数组的类型推断更加严格，需要使用 any 类型
    const methodLower = method.toLowerCase() as Lowercase<typeof method>;
    const validMethods = new Set(["get", "post", "put", "delete", "patch"]);

    if (!validMethods.has(methodLower)) {
      throw new Error(`不支持的 HTTP 方法: ${method}`);
    }

    // 使用 any 类型绕过 Hono 的严格类型检查，因为展开中间件数组时无法正确推断类型
    if (middleware.length > 0) {
      (app[methodLower] as any)(path, ...middleware, wrappedHandler);
    } else {
      (app[methodLower] as any)(path, wrappedHandler);
    }
  }

  /**
   * 清除所有路由（主要用于测试）
   */
  clear(): void {
    this.routes.clear();
    this.logger.info("已清除所有路由配置");
  }

  /**
   * 检查路由是否已注册
   */
  hasRoute(name: string): boolean {
    return this.routes.has(name);
  }

  /**
   * 列出所有已注册的路由域名称
   */
  getRouteNames(): string[] {
    return Array.from(this.routes.keys());
  }
}

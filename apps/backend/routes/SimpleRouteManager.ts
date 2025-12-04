/**
 * 简化的路由管理器
 * 替代原有的复杂三层架构（BaseRoute + RouteAggregator + RouteRegistry）
 * 提供直接、高效的路由注册和管理功能
 */

import type { HandlerDependencies } from "./types.js";
import type { Hono } from "hono";
import type { AppContext } from "../types/hono.context.js";
import type { RouteStats, SimpleRouteConfig } from "./types.js";

/**
 * 简化的路由管理器
 * 直接管理路由配置，减少不必要的抽象层次
 */
export class SimpleRouteManager {
  private routes: Map<string, SimpleRouteConfig> = new Map();
  private dependencies: HandlerDependencies;

  constructor(dependencies: HandlerDependencies) {
    this.dependencies = dependencies;
  }

  /**
   * 注册单个路由模块
   */
  registerRoute(name: string, config: SimpleRouteConfig): void {
    if (this.routes.has(name)) {
      console.warn(`路由域 '${name}' 已存在，将被覆盖`);
    }
    this.routes.set(name, config);
    console.log(`已注册路由域: ${name} (${config.routes.length} 个路由)`);
  }

  /**
   * 批量注册路由模块
   */
  registerRoutes(routeConfigs: Record<string, SimpleRouteConfig>): void {
    console.log(`开始批量注册 ${Object.keys(routeConfigs).length} 个路由域...`);

    for (const [name, config] of Object.entries(routeConfigs)) {
      this.registerRoute(name, config);
    }

    console.log(`批量注册完成，共注册 ${this.routes.size} 个路由域`);
  }

  /**
   * 获取所有注册的路由配置
   */
  getAllRoutes(): Map<string, SimpleRouteConfig> {
    return new Map(this.routes);
  }

  /**
   * 获取指定名称的路由配置
   */
  getRoute(name: string): SimpleRouteConfig | undefined {
    return this.routes.get(name);
  }

  /**
   * 获取路由统计信息
   */
  getRouteStats(): RouteStats {
    const stats: RouteStats = {
      domains: this.routes.size,
      routes: 0,
      successful: 0,
      failed: 0,
    };

    for (const config of this.routes.values()) {
      stats.routes += config.routes.length;
      stats.successful += config.routes.length; // 简化版本，假设都成功
    }

    return stats;
  }

  /**
   * 将路由应用到 Hono 应用实例
   */
  applyToApp(app: Hono<AppContext>): void {
    console.log(`开始将 ${this.routes.size} 个路由域应用到 Hono 应用...`);

    // 设置全局中间件，注入依赖
    app.use("*", async (c, next) => {
      c.set("dependencies", this.dependencies);
      await next();
    });

    for (const [domainName, config] of this.routes) {
      try {
        this.applyRouteConfig(app, config);
        console.log(`✓ 成功应用路由域: ${domainName}`);
      } catch (error) {
        console.error(`✗ 应用路由域失败: ${domainName}`, error);
      }
    }

    console.log("路由应用完成");
  }

  /**
   * 应用单个路由配置到 Hono 应用
   */
  private applyRouteConfig(app: Hono<AppContext>, config: SimpleRouteConfig): void {
    // 注册每个具体的路由
    for (const route of config.routes) {
      const fullPath = config.path + route.path;

      // 应用域级别的中间件和路由级别的中间件
      const allMiddleware = [
        ...(config.middleware || []),
        ...(route.middleware || []),
      ];

      // 注册路由 - 使用Hono的标准API
      switch (route.method) {
        case "GET":
          if (allMiddleware.length > 0) {
            app.get(fullPath, ...allMiddleware, route.handler);
          } else {
            app.get(fullPath, route.handler);
          }
          break;
        case "POST":
          if (allMiddleware.length > 0) {
            app.post(fullPath, ...allMiddleware, route.handler);
          } else {
            app.post(fullPath, route.handler);
          }
          break;
        case "PUT":
          if (allMiddleware.length > 0) {
            app.put(fullPath, ...allMiddleware, route.handler);
          } else {
            app.put(fullPath, route.handler);
          }
          break;
        case "DELETE":
          if (allMiddleware.length > 0) {
            app.delete(fullPath, ...allMiddleware, route.handler);
          } else {
            app.delete(fullPath, route.handler);
          }
          break;
        case "PATCH":
          if (allMiddleware.length > 0) {
            app.patch(fullPath, ...allMiddleware, route.handler);
          } else {
            app.patch(fullPath, route.handler);
          }
          break;
        default:
          throw new Error(`不支持的 HTTP 方法: ${route.method}`);
      }
    }
  }

  /**
   * 清除所有路由（主要用于测试）
   */
  clear(): void {
    this.routes.clear();
    console.log("已清除所有路由配置");
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

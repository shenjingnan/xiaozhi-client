/**
 * 路由管理器
 * 提供直接、高效的路由注册和管理功能
 */

import type { Context, Hono, Next } from "hono";
import { createErrorResponse } from "../middlewares/error.middleware.js";
import type { AppContext } from "../types/hono.context.js";
import type { RouteConfig } from "./types.js";

/**
 * 路由管理器
 * 直接管理路由配置，提供路由注册和应用功能
 * 注意：依赖注入现在通过 WebServer 的中间件处理，RouteManager 不再直接管理依赖
 */
export class RouteManager {
  private routes: Map<string, RouteConfig> = new Map();

  /**
   * 注册单个路由模块
   */
  registerRoute(name: string, config: RouteConfig): void {
    if (this.routes.has(name)) {
      console.warn(`路由域 '${name}' 已存在，将被覆盖`);
    }
    this.routes.set(name, config);
    console.log(`已注册路由域: ${name} (${config.routes.length} 个路由)`);
  }

  /**
   * 批量注册路由模块
   */
  registerRoutes(routeConfigs: Record<string, RouteConfig>): void {
    console.log(`开始批量注册 ${Object.keys(routeConfigs).length} 个路由域...`);

    for (const [name, config] of Object.entries(routeConfigs)) {
      this.registerRoute(name, config);
    }

    console.log(`批量注册完成，共注册 ${this.routes.size} 个路由域`);
  }

  /**
   * 获取所有注册的路由配置
   */
  getAllRoutes(): Map<string, RouteConfig> {
    return new Map(this.routes);
  }

  /**
   * 获取指定名称的路由配置
   */
  getRoute(name: string): RouteConfig | undefined {
    return this.routes.get(name);
  }

  /**
   * 将路由应用到 Hono 应用实例
   */
  applyToApp(app: Hono<AppContext>): void {
    console.log(`开始将 ${this.routes.size} 个路由域应用到 Hono 应用...`);

    // 注意：全局依赖注入中间件已移至 WebServer.ts 的 setupMiddleware()，避免中间件顺序冲突

    // 获取所有路由并排序，确保 static 路由最后应用
    const routeEntries = Array.from(this.routes.entries());
    routeEntries.sort(([nameA], [nameB]) => {
      // static 路由永远排在最后
      if (nameA === "static") return 1;
      if (nameB === "static") return -1;
      return 0;
    });

    for (const [domainName, config] of routeEntries) {
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
  private applyRouteConfig(app: Hono<AppContext>, config: RouteConfig): void {
    // 注册每个具体的路由
    for (const route of config.routes) {
      const fullPath = config.path + route.path;

      // 应用域级别的中间件和路由级别的中间件
      const allMiddleware = [
        ...(config.middleware || []),
        ...(route.middleware || []),
      ];

      // 创建包装的处理器，添加错误处理
      const wrappedHandler = async (c: Context<AppContext>, next: Next) => {
        try {
          const result = await route.handler(c);
          // 直接返回结果，不管是 Response 还是什么
          // Hono 会处理 Response 对象
          return result;
        } catch (error) {
          console.error(`路由处理错误 [${route.method} ${fullPath}]:`, error);
          const errorResponse = createErrorResponse(
            "HANDLER_ERROR",
            "处理器执行失败",
            error instanceof Error ? error.message : String(error)
          );
          return c.json(errorResponse, 500);
        }
      };

      // 使用方法映射简化注册逻辑，减少重复
      const methodHandlers = {
        GET: app.get.bind(app),
        POST: app.post.bind(app),
        PUT: app.put.bind(app),
        DELETE: app.delete.bind(app),
        PATCH: app.patch.bind(app),
      } as const;

      const handler =
        methodHandlers[route.method as keyof typeof methodHandlers];
      if (!handler) {
        throw new Error(`不支持的 HTTP 方法: ${route.method}`);
      }

      if (allMiddleware.length > 0) {
        handler(fullPath, ...allMiddleware, wrappedHandler);
      } else {
        handler(fullPath, wrappedHandler);
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

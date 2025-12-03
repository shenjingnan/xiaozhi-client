/**
 * 基础路由抽象类
 * 定义路由模块的基本结构和通用行为
 */

import type { Hono } from "hono";
import type { AppContext } from "../types/hono.context.js";
import type { HandlerDependencies, RouteDomainConfig } from "./types.js";

/**
 * 基础路由抽象类
 * 所有具体路由模块都应该继承此类
 */
export abstract class BaseRoute {
  protected dependencies: HandlerDependencies;

  constructor(dependencies: HandlerDependencies) {
    this.dependencies = dependencies;
  }

  /**
   * 获取路由域配置
   * 子类必须实现此方法来定义具体的路由配置
   */
  abstract getRouteConfig(): RouteDomainConfig;

  /**
   * 验证依赖是否已正确注入
   * @param dependencyName 依赖名称
   * @returns 依赖是否存在
   */
  protected hasDependency(dependencyName: keyof HandlerDependencies): boolean {
    return this.dependencies[dependencyName] !== undefined;
  }

  /**
   * 获取指定依赖，如果不存在则抛出错误
   * @param dependencyName 依赖名称
   * @returns 依赖实例
   * @throws Error 如果依赖不存在
   */
  protected getRequiredDependency<T extends keyof HandlerDependencies>(
    dependencyName: T
  ): NonNullable<HandlerDependencies[T]> {
    const dependency = this.dependencies[dependencyName];
    if (dependency === undefined) {
      throw new Error(`必需的依赖 '${dependencyName as string}' 未注入`);
    }
    return dependency as NonNullable<HandlerDependencies[T]>;
  }

  /**
   * 注册路由到 Hono 应用
   * @param app Hono 应用实例
   * @param options 注册选项
   */
  register(
    app: Hono<AppContext>,
    options?: { verboseLogging?: boolean }
  ): void {
    const config = this.getRouteConfig();
    const { verboseLogging = false } = options || {};

    if (verboseLogging) {
      console.log(`注册路由域: ${config.name} (${config.description})`);
      console.log(`基础路径: ${config.path}`);
      console.log(`路由数量: ${config.routes.length}`);
    }

    // 注册域级别的中间件（如果存在）
    if (config.middleware && config.middleware.length > 0) {
      if (verboseLogging) {
        console.log(`注册 ${config.middleware.length} 个域级别中间件`);
      }
      for (const middleware of config.middleware) {
        app.use(config.path, middleware);
      }
    }

    // 注册具体的路由
    let routeCount = 0;
    for (const route of config.routes) {
      const fullPath = `${config.path}${route.path}`;

      // 注册路由级别的中间件（如果存在）
      if (route.middleware && route.middleware.length > 0) {
        if (verboseLogging) {
          console.log(
            `  路由 ${route.method} ${fullPath} - 添加 ${route.middleware.length} 个中间件`
          );
        }
        for (const middleware of route.middleware) {
          app.use(fullPath, middleware);
        }
      }

      // 注册路由处理器
      try {
        switch (route.method) {
          case "GET":
            app.get(fullPath, route.handler);
            break;
          case "POST":
            app.post(fullPath, route.handler);
            break;
          case "PUT":
            app.put(fullPath, route.handler);
            break;
          case "DELETE":
            app.delete(fullPath, route.handler);
            break;
          case "PATCH":
            app.patch(fullPath, route.handler);
            break;
          default:
            // TypeScript 的类型检查应该防止这种情况，但为了运行时安全还是添加检查
            throw new Error(`不支持的 HTTP 方法: ${route.method as string}`);
        }

        routeCount++;
        if (verboseLogging) {
          console.log(`  ✓ ${route.method} ${fullPath}`);
        }
      } catch (error) {
        const errorMessage = `注册路由失败: ${route.method} ${fullPath}`;
        console.error(errorMessage, error);
        throw new Error(
          `${errorMessage}: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    }

    if (verboseLogging) {
      console.log(`✅ 域 '${config.name}' 注册完成，共 ${routeCount} 个路由\n`);
    }
  }

  /**
   * 获取路由域的基本信息
   * @returns 路由域信息对象
   */
  getDomainInfo() {
    const config = this.getRouteConfig();
    return {
      name: config.name,
      description: config.description,
      basePath: config.path,
      routeCount: config.routes.length,
      methods: Array.from(new Set(config.routes.map((route) => route.method))),
      paths: config.routes.map((route) => `${config.path}${route.path}`),
    };
  }

  /**
   * 验证路由配置的完整性
   * @throws Error 如果配置有问题
   */
  protected validateConfig(config: RouteDomainConfig): void {
    if (!config.name || typeof config.name !== "string") {
      throw new Error("路由域名称是必需的且必须是字符串");
    }

    if (!config.description || typeof config.description !== "string") {
      throw new Error("路由域描述是必需的且必须是字符串");
    }

    if (!config.path || typeof config.path !== "string") {
      throw new Error("路由域路径是必需的且必须是字符串");
    }

    if (!Array.isArray(config.routes) || config.routes.length === 0) {
      throw new Error("路由域必须包含至少一个路由配置");
    }

    // 验证每个路由配置
    for (let i = 0; i < config.routes.length; i++) {
      const route = config.routes[i];
      if (!route.path || typeof route.path !== "string") {
        throw new Error(`路由配置 ${i}: 路径是必需的且必须是字符串`);
      }

      if (!["GET", "POST", "PUT", "DELETE", "PATCH"].includes(route.method)) {
        throw new Error(`路由配置 ${i}: 不支持的 HTTP方法 '${route.method}'`);
      }

      if (typeof route.handler !== "function") {
        throw new Error(`路由配置 ${i}: 处理器必须是函数`);
      }
    }
  }
}

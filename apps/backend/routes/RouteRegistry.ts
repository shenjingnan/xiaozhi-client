/**
 * 路由注册器
 * 负责管理和注册所有路由模块
 */

import type { Hono } from "hono";
import type { AppContext } from "../types/hono.context.js";
import type { BaseRoute } from "./BaseRoute.js";
import type {
  HandlerDependencies,
  RouteRegistryOptions,
  RouteStatistics,
} from "./types.js";

/**
 * 路由注册器类
 * 管理所有路由模块的注册和生命周期
 */
export class RouteRegistry {
  private app: Hono<AppContext>;
  private dependencies: HandlerDependencies;
  private options: RouteRegistryOptions;
  private registeredRoutes: BaseRoute[] = [];
  private isRegistered = false;

  /**
   * 构造函数
   * @param app Hono 应用实例
   * @param dependencies 处理器依赖
   * @param options 注册选项
   */
  constructor(
    app: Hono<AppContext>,
    dependencies: HandlerDependencies,
    options: RouteRegistryOptions = {}
  ) {
    this.app = app;
    this.dependencies = dependencies;
    this.options = {
      verboseLogging: false,
      throwOnRegistrationError: true,
      ...options,
    };

    // 验证依赖
    this.validateDependencies();
  }

  /**
   * 注册单个路由模块
   * @param route 路由模块实例
   */
  registerRoute(route: BaseRoute): void {
    if (this.isRegistered) {
      throw new Error("路由已经完成注册，无法添加新的路由模块");
    }

    try {
      route.register(this.app, { verboseLogging: this.options.verboseLogging });
      this.registeredRoutes.push(route);

      if (this.options.verboseLogging) {
        console.log(`✅ 路由模块 '${route.getDomainInfo().name}' 注册成功`);
      }
    } catch (error) {
      const errorMessage = `注册路由模块失败: ${route.getDomainInfo().name}`;
      console.error(errorMessage, error);

      if (this.options.throwOnRegistrationError) {
        throw new Error(
          `${errorMessage}: ${error instanceof Error ? error.message : String(error)}`
        );
      }
      console.warn(`⚠️  ${errorMessage}，但继续执行其他路由注册`);
    }
  }

  /**
   * 批量注册路由模块
   * @param routes 路由模块数组
   */
  registerRoutes(routes: BaseRoute[]): void {
    if (this.isRegistered) {
      throw new Error("路由已经完成注册，无法添加新的路由模块");
    }

    if (this.options.verboseLogging) {
      console.log(`开始批量注册 ${routes.length} 个路由模块...\n`);
    }

    for (const route of routes) {
      this.registerRoute(route);
    }

    if (this.options.verboseLogging) {
      console.log("批量路由注册完成");
    }
  }

  /**
   * 标记路由注册完成
   * 完成后将无法添加新的路由模块
   */
  completeRegistration(): void {
    if (this.options.verboseLogging) {
      const stats = this.getStatistics();
      console.log("\n=== 路由注册完成 ===");
      console.log(
        `总计 ${stats.domainCount} 个域，${stats.totalRouteCount} 个路由`
      );
      console.log("分布情况:", stats.routeDistribution);
      console.log("HTTP 方法分布:", stats.methodDistribution);
      console.log("==================\n");
    }

    this.isRegistered = true;
  }

  /**
   * 获取注册统计信息
   * @returns 路由统计信息
   */
  getStatistics(): RouteStatistics {
    const routeDistribution: Record<string, number> = {};
    const methodDistribution: Record<string, number> = {};
    let totalRouteCount = 0;

    for (const route of this.registeredRoutes) {
      const domainInfo = route.getDomainInfo();

      // 统计域路由数量
      routeDistribution[domainInfo.name] = domainInfo.routeCount;
      totalRouteCount += domainInfo.routeCount;

      // 统计 HTTP 方法分布
      for (const method of domainInfo.methods) {
        methodDistribution[method] = (methodDistribution[method] || 0) + 1;
      }
    }

    return {
      domainCount: this.registeredRoutes.length,
      totalRouteCount,
      routeDistribution,
      methodDistribution,
    };
  }

  /**
   * 获取所有已注册的路由模块信息
   * @returns 路由模块信息数组
   */
  getRegisteredRoutesInfo() {
    return this.registeredRoutes.map((route) => route.getDomainInfo());
  }

  /**
   * 检查指定的路由域是否已注册
   * @param domainName 域名称
   * @returns 是否已注册
   */
  hasDomain(domainName: string): boolean {
    return this.registeredRoutes.some(
      (route) => route.getDomainInfo().name === domainName
    );
  }

  /**
   * 获取指定的路由域信息
   * @param domainName 域名称
   * @returns 域信息或 null
   */
  getDomainInfo(domainName: string) {
    const route = this.registeredRoutes.find(
      (route) => route.getDomainInfo().name === domainName
    );
    return route ? route.getDomainInfo() : null;
  }

  /**
   * 验证依赖注入的完整性
   * @throws Error 如果缺少必需的依赖
   */
  private validateDependencies(): void {
    const requiredDependencies: (keyof HandlerDependencies)[] = [
      "configApiHandler",
      "statusApiHandler",
      "serviceApiHandler",
      "toolApiHandler",
      "toolCallLogApiHandler",
      "versionApiHandler",
      "staticFileHandler",
      "mcpRouteHandler",
      "updateApiHandler",
      "cozeApiHandler",
      "createEndpointHandler",
    ];

    const missingDependencies: string[] = [];

    for (const dep of requiredDependencies) {
      if (!this.dependencies[dep]) {
        missingDependencies.push(dep);
      }
    }

    if (missingDependencies.length > 0) {
      throw new Error(`缺少必需的依赖: ${missingDependencies.join(", ")}`);
    }

    if (this.options.verboseLogging) {
      console.log("✅ 所有必需依赖已验证");
    }
  }

  /**
   * 重置注册器状态（主要用于测试）
   */
  reset(): void {
    this.registeredRoutes = [];
    this.isRegistered = false;
  }

  /**
   * 获取注册状态
   * @returns 是否已完成注册
   */
  isRegistrationComplete(): boolean {
    return this.isRegistered;
  }

  /**
   * 获取注册的路由数量
   * @returns 路由数量
   */
  getRouteCount(): number {
    return this.registeredRoutes.length;
  }

  /**
   * 获取所有注册的域名称
   * @returns 域名称数组
   */
  getDomainNames(): string[] {
    return this.registeredRoutes.map((route) => route.getDomainInfo().name);
  }
}

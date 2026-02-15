/**
 * 中间件管理器
 *
 * 负责 Hono 应用的中间件配置和管理，包括：
 * - Logger 中间件
 * - 响应增强中间件
 * - WebServer 实例注入
 * - MCP Service Manager 中间件
 * - 端点管理器中间件
 * - 接入点处理器中间件
 * - CORS 中间件
 * - 错误处理中间件
 * - 路由依赖注入中间件
 *
 * @example
 * ```typescript
 * const manager = new MiddlewareManager(app, webServer);
 * await manager.setup();
 * ```
 */

import type { Hono } from "hono";
import type { AppContext } from "../types/hono.context.js";
import type { IWebServer } from "../types/hono.context.js";
import {
  corsMiddleware,
  endpointManagerMiddleware,
  endpointsMiddleware,
  errorHandlerMiddleware,
  loggerMiddleware,
  mcpServiceManagerMiddleware,
  notFoundHandlerMiddleware,
  responseEnhancerMiddleware,
} from "../middlewares/index.js";
import type { HandlerDependencies } from "../routes/index.js";

/**
 * 中间件管理器配置选项
 */
export interface MiddlewareManagerOptions {
  /** Hono 应用实例 */
  app: Hono<AppContext>;
  /** WebServer 实例 */
  webServer: IWebServer;
  /** 创建处理器依赖的函数 */
  createHandlerDependencies: () => HandlerDependencies;
}

/**
 * 中间件管理器
 *
 * 负责统一配置和管理所有中间件，确保中间件按正确顺序应用
 */
export class MiddlewareManager {
  constructor(private options: MiddlewareManagerOptions) {}

  /**
   * 设置所有中间件
   *
   * 中间件应用顺序很重要：
   * 1. Logger - 必须在最前面，记录所有请求
   * 2. Response Enhancer - 增强 Hono Context，添加 success/fail 等方法
   * 3. WebServer 注入 - 将 WebServer 实例注入到上下文
   * 4. MCP Service Manager - 注入 MCP 服务管理器
   * 5. Endpoint Manager - 注入端点管理器
   * 6. Endpoints - 注入接入点处理器
   * 7. CORS - 跨域资源共享
   * 8. Error Handler - 错误处理
   * 9. Handler Dependencies - 注入路由依赖
   * 10. Not Found - 404 处理（必须在所有路由设置完成后）
   */
  setup(): void {
    const { app, webServer, createHandlerDependencies } = this.options;

    // 1. Logger 中间件 - 必须在最前面
    app.use("*", loggerMiddleware);

    // 2. 响应增强中间件 - 在 logger 之后，其他中间件之前
    // 这样所有路由都可以使用 c.success、c.fail、c.paginate 方法
    app.use("*", responseEnhancerMiddleware);

    // 3. 注入 WebServer 实例到上下文
    // 使用类型断言避免循环引用问题
    app.use("*", async (c, next) => {
      c.set("webServer", webServer);
      await next();
    });

    // 4. MCP Service Manager 中间件 - 必须在 WebServer 注入之后
    app.use("*", mcpServiceManagerMiddleware);

    // 5. 小智连接管理器中间件
    app.use("*", endpointManagerMiddleware());

    // 6. 小智接入点处理器中间件（在连接管理器中间件之后）
    app.use("*", endpointsMiddleware());

    // 7. CORS 中间件
    app.use("*", corsMiddleware);

    // 8. 错误处理中间件
    app.onError(errorHandlerMiddleware);

    // 9. 注入路由系统依赖
    // 注意：这个中间件必须在路由注册之前设置
    app.use("*", async (c, next) => {
      const dependencies = createHandlerDependencies();
      c.set("dependencies", dependencies);
      await next();
    });
  }

  /**
   * 设置 404 处理器
   *
   * 这个方法必须在所有路由设置完成后调用
   */
  setupNotFoundHandler(): void {
    const { app } = this.options;
    app.notFound(notFoundHandlerMiddleware);
  }

  /**
   * 获取 Hono 应用实例
   */
  getApp(): Hono<AppContext> {
    return this.options.app;
  }
}

/**
 * Web 服务器
 *
 * 负责：
 * - 启动和管理 HTTP/HTTPS 服务器
 * - 协调各个管理器和处理器
 * - 集成 MCP 服务和端点管理器
 * - 生命周期管理（启动、停止、清理）
 *
 * 重构说明：
 * - 原本的中间件配置已移至 MiddlewareManager
 * - 原本的 WebSocket 管理已移至 WebSocketManager
 * - 原本的事件监听器协调已移至 EventCoordinator
 * - 原本的 Handler 依赖管理已移至 HandlerRegistry
 *
 * @example
 * ```typescript
 * import { WebServer } from './WebServer';
 *
 * const server = new WebServer();
 * await server.start();
 * ```
 */

import { createServer } from "node:http";
import type { IncomingMessage, Server, ServerResponse } from "node:http";
import type { Logger } from "@/Logger.js";
import { logger } from "@/Logger.js";
import {
  ConfigApiHandler,
  CozeHandler,
  HeartbeatHandler,
  MCPHandler,
  MCPRouteHandler,
  MCPToolHandler,
  MCPToolLogHandler,
  RealtimeNotificationHandler,
  ServiceApiHandler,
  StaticFileHandler,
  StatusApiHandler,
  TTSApiHandler,
  UpdateApiHandler,
  VersionApiHandler,
} from "@/handlers/index.js";
import { MCPServiceManager } from "@/lib/mcp";
import type { EnhancedToolInfo } from "@/lib/mcp/types.js";
import { ensureToolJSONSchema } from "@/lib/mcp/types.js";
import type { EventBus, EventBusEvents } from "@/services/index.js";
import {
  NotificationService,
  StatusService,
  destroyEventBus,
  getEventBus,
} from "@/services/index.js";
import type { AppContext } from "@/types/index.js";
import { createApp } from "@/types/index.js";
import type { ServerType } from "@hono/node-server";
import { serve } from "@hono/node-server";
import type { Tool } from "@modelcontextprotocol/sdk/types.js";
import { normalizeServiceConfig } from "@xiaozhi-client/config";
import { configManager } from "@xiaozhi-client/config";
import type { MCPServerConfig } from "@xiaozhi-client/config";
import { EndpointManager } from "@xiaozhi-client/endpoint";
import type { SimpleConnectionStatus } from "@xiaozhi-client/endpoint";
import type { Hono } from "hono";

import { HTTP_SERVER_CONFIG } from "@/constants/index.js";
import { MCPServiceManagerNotInitializedError } from "@/errors/mcp-errors.middleware.js";
// 路由系统导入
import {
  type HandlerDependencies,
  RouteManager,
  // 导入所有路由配置
  configRoutes,
  cozeRoutes,
  endpointRoutes,
  mcpRoutes,
  mcpserverRoutes,
  miscRoutes,
  servicesRoutes,
  staticRoutes,
  statusRoutes,
  toolLogsRoutes,
  toolsRoutes,
  ttsRoutes,
  updateRoutes,
  versionRoutes,
} from "./routes/index.js";

// 管理器导入
import {
  EventCoordinator,
  HandlerRegistry,
  MiddlewareManager,
  WebSocketManager,
} from "./managers/index.js";

// 统一成功响应格式
interface ApiSuccessResponse<T = unknown> {
  success: boolean;
  data?: T;
  message?: string;
}

// 小智连接状态响应格式
interface XiaozhiConnectionStatusResponse {
  type: "multi-endpoint" | "single-endpoint" | "none";
  connected?: boolean;
  endpoint?: string;
  manager?: {
    connectedConnections: number;
    totalConnections: number;
    healthCheckStats: Record<string, unknown>;
  };
  connections?: SimpleConnectionStatus[];
}

/**
 * WebServer - 主控制器，协调各个管理器和处理器
 */
export class WebServer {
  private app: Hono<AppContext>;
  private httpServer: ServerType | null = null;
  private logger: Logger;
  private port: number;

  // 管理器
  private middlewareManager: MiddlewareManager;
  private webSocketManager: WebSocketManager;
  private eventCoordinator: EventCoordinator;
  private handlerRegistry: HandlerRegistry;
  private routeManager?: RouteManager;

  // 事件总线
  private eventBus: EventBus;

  // 服务层
  private statusService: StatusService;
  private notificationService: NotificationService;

  // WebSocket 处理器
  private realtimeNotificationHandler: RealtimeNotificationHandler;
  private heartbeatHandler: HeartbeatHandler;

  // 心跳监控
  private heartbeatMonitorInterval?: NodeJS.Timeout;

  // 连接管理相关属性
  private endpointManager: EndpointManager | null = null;
  private mcpServiceManager: MCPServiceManager | null = null;

  constructor(port?: number) {
    // 端口配置
    try {
      this.port =
        port ?? configManager.getWebUIPort() ?? HTTP_SERVER_CONFIG.DEFAULT_PORT;
    } catch (error) {
      // 配置读取失败时使用默认端口
      this.port = port ?? HTTP_SERVER_CONFIG.DEFAULT_PORT;
    }
    this.logger = logger;

    // 初始化事件总线
    this.eventBus = getEventBus();

    // 初始化服务层
    this.statusService = new StatusService();
    this.notificationService = new NotificationService();

    // 初始化 WebSocket 处理器
    this.realtimeNotificationHandler = new RealtimeNotificationHandler(
      this.notificationService,
      this.statusService
    );
    this.heartbeatHandler = new HeartbeatHandler(
      this.statusService,
      this.notificationService
    );

    // 初始化 Handler 注册表
    this.handlerRegistry = new HandlerRegistry();
    this.initializeHandlers();

    // 初始化管理器
    // 初始化 Hono 应用
    this.app = createApp();

    // 初始化中间件管理器
    this.middlewareManager = new MiddlewareManager({
      app: this.app,
      webServer: this as unknown as import("./types/hono.context.js").IWebServer,
      createHandlerDependencies: () => this.handlerRegistry.createDependencies(),
    });

    // 初始化 WebSocket 管理器
    this.webSocketManager = new WebSocketManager({
      logger: this.logger,
      realtimeNotificationHandler: this.realtimeNotificationHandler,
      heartbeatHandler: this.heartbeatHandler,
    });

    // 初始化事件协调器
    this.eventCoordinator = new EventCoordinator({
      eventBus: this.eventBus,
      notificationService: this.notificationService,
      logger: this.logger,
    });

    // 设置中间件
    this.middlewareManager.setup();

    // 在所有路由设置完成后，设置 404 处理
    this.middlewareManager.setupNotFoundHandler();

    // 设置事件监听器
    this.eventCoordinator.setup();
  }

  /**
   * 初始化所有 Handler
   */
  private initializeHandlers(): void {
    // 初始化 HTTP API 处理器
    this.handlerRegistry.register(
      "configApiHandler",
      new ConfigApiHandler()
    );
    this.handlerRegistry.register(
      "statusApiHandler",
      new StatusApiHandler(this.statusService)
    );
    this.handlerRegistry.register(
      "serviceApiHandler",
      new ServiceApiHandler(this.statusService)
    );
    this.handlerRegistry.register(
      "mcpToolHandler",
      new MCPToolHandler()
    );
    this.handlerRegistry.register(
      "mcpToolLogHandler",
      new MCPToolLogHandler()
    );
    this.handlerRegistry.register(
      "versionApiHandler",
      new VersionApiHandler()
    );
    this.handlerRegistry.register(
      "staticFileHandler",
      new StaticFileHandler()
    );
    this.handlerRegistry.register(
      "mcpRouteHandler",
      new MCPRouteHandler()
    );
    this.handlerRegistry.register(
      "updateApiHandler",
      new UpdateApiHandler()
    );
    this.handlerRegistry.register(
      "cozeHandler",
      new CozeHandler()
    );
    this.handlerRegistry.register(
      "ttsApiHandler",
      new TTSApiHandler()
    );

    // MCPServerApiHandler 将在 start() 方法中初始化，因为它需要 mcpServiceManager
  }

  /**
   * 初始化所有连接（配置驱动）
   */
  private async initializeConnections(): Promise<void> {
    try {
      this.logger.debug("开始初始化连接...");

      // 2. 初始化 MCP 服务管理器（WebServer 直接管理）
      if (!this.mcpServiceManager) {
        this.logger.debug("创建新的 MCPServiceManager 实例");
        this.mcpServiceManager = new MCPServiceManager();
        // 启动服务管理器，确保它可以正常工作
        await this.mcpServiceManager.start();
      } else {
        this.logger.debug("使用现有的 MCPServiceManager 实例，跳过创建");
      }

      // 1. 读取配置
      const config = await this.loadConfiguration();

      // 2.1. 初始化 MCP 服务器 API 处理器
      const mcpHandler = new MCPHandler(this.mcpServiceManager, configManager);
      this.handlerRegistry.register("mcpHandler", mcpHandler);

      // 3. 从配置加载 MCP 服务
      await this.loadMCPServicesFromConfig(config.mcpServers);

      // 4. 获取工具列表
      const rawTools: EnhancedToolInfo[] = this.mcpServiceManager.getAllTools();
      this.logger.debug(`已加载 ${rawTools.length} 个工具`);

      // 5. 转换工具格式以符合 MCP SDK 要求
      const tools: Tool[] = rawTools.map((tool) => ({
        name: tool.name,
        description: tool.description || "",
        inputSchema: ensureToolJSONSchema(tool.inputSchema),
      }));

      // 6. 初始化小智接入点连接
      await this.initializeXiaozhiConnection(config.mcpEndpoint);

      this.logger.debug("所有连接初始化完成");
    } catch (error) {
      this.logger.error("连接初始化失败:", error);
      // 降级模式：即使配置加载失败，也确保 MCPServiceManager 可用
      if (!this.mcpServiceManager) {
        this.logger.warn(
          "配置加载失败，正在进入降级模式。在降级模式下：\n" +
            "1. 将创建一个空配置的 MCPServiceManager 实例\n" +
            "2. 不会加载任何 MCP 服务器或端点\n" +
            "3. WebServer 仍然可以启动并提供基础 API 服务\n" +
            "4. 用户需要通过 API 重新配置端点或服务器\n" +
            "5. 建议尽快运行 'xiaozhi init' 初始化配置文件"
        );
        this.mcpServiceManager = new MCPServiceManager();
        await this.mcpServiceManager.start();
        this.logger.info("降级模式已激活，MCPServiceManager 使用空配置启动");
      }
    }
  }

  /**
   * 加载配置文件
   */
  private async loadConfiguration(): Promise<{
    mcpEndpoint: string | string[];
    mcpServers: Record<string, MCPServerConfig>;
    webUIPort: number;
  }> {
    if (!configManager.configExists()) {
      throw new Error("配置文件不存在，请先运行 'xiaozhi init' 初始化配置");
    }

    // 在加载配置前，先清理无效的服务器工具配置
    // 确保 mcpServerConfig 与 mcpServers 保持同步
    configManager.cleanupInvalidServerToolsConfig();

    const config = configManager.getConfig();

    return {
      mcpEndpoint: config.mcpEndpoint,
      mcpServers: config.mcpServers,
      webUIPort: config.webUI?.port ?? HTTP_SERVER_CONFIG.DEFAULT_PORT,
    };
  }

  /**
   * 从配置加载 MCP 服务
   */
  private async loadMCPServicesFromConfig(
    mcpServers: Record<string, MCPServerConfig>
  ): Promise<void> {
    if (!this.mcpServiceManager) {
      throw new Error("MCPServiceManager 未初始化");
    }

    for (const [name, config] of Object.entries(mcpServers)) {
      this.logger.debug(`添加 MCP 服务配置: ${name}`);
      // 使用配置适配器转换配置格式
      const serviceConfig = normalizeServiceConfig(config);
      this.mcpServiceManager.addServiceConfig(name, serviceConfig);
    }

    await this.mcpServiceManager.startAllServices();
  }

  /**
   * 初始化小智接入点连接（使用新 API）
   */
  private async initializeXiaozhiConnection(
    mcpEndpoint: string | string[]
  ): Promise<void> {
    // 处理多端点配置
    const endpoints = Array.isArray(mcpEndpoint) ? mcpEndpoint : [mcpEndpoint];
    const validEndpoints = endpoints.filter(
      (ep) => ep && !ep.includes("<请填写")
    );

    // 1. 初始化连接管理器（无论是否有有效端点）
    this.logger.debug(
      `初始化小智接入点连接管理器，端点数量: ${validEndpoints.length}`
    );

    try {
      // 创建连接管理器实例（总是创建）
      if (!this.endpointManager) {
        this.endpointManager = new EndpointManager({
          defaultReconnectDelay: 2000,
        });
        // ✅ 传入 mcpServiceManager 实例
        this.endpointManager.setMcpManager(this.mcpServiceManager!);
        this.logger.debug("✅ 新建连接管理器实例");

        // 更新事件协调器的端点管理器引用
        this.eventCoordinator.setEndpointManager(this.endpointManager);
      }

      this.logger.debug("✅ 连接管理器设置完成");

      // 2. 只有在有有效端点时才创建并添加端点
      if (validEndpoints.length > 0) {
        this.logger.debug("有效端点列表:", validEndpoints);

        // 直接使用 URL 字符串添加端点（新 API）
        for (const endpointUrl of validEndpoints) {
          this.endpointManager.addEndpoint(endpointUrl);
          this.logger.debug(`✅ 已添加端点: ${endpointUrl}`);
        }

        // 连接所有端点
        await this.endpointManager.connect();

        // 设置端点添加事件监听器
        this.endpointManager.on(
          "endpointAdded",
          (event: { endpoint: string }) => {
            this.logger.debug(`端点已添加: ${event.endpoint}`);
          }
        );

        // 设置端点移除事件监听器
        this.endpointManager.on(
          "endpointRemoved",
          (event: { endpoint: string }) => {
            this.logger.debug(`端点已移除: ${event.endpoint}`);
          }
        );

        this.logger.debug(
          `小智接入点连接管理器初始化完成，管理 ${validEndpoints.length} 个端点`
        );
      } else {
        this.logger.debug("小智接入点连接管理器初始化完成（无端点）");
      }
    } catch (error) {
      this.logger.error("小智接入点连接管理器初始化失败:", error);
      // 抛出错误，让调用者知道初始化失败
      throw error;
    }
  }

  /**
   * 设置连接管理器实例（主要用于测试依赖注入）
   */
  public setXiaozhiConnectionManager(manager: EndpointManager): void {
    this.endpointManager = manager;
    this.eventCoordinator.setEndpointManager(manager);
  }

  /**
   * 获取小智连接管理器实例
   * 提供给中间件使用
   * WebServer 启动后始终返回有效的连接管理器实例
   * @throws {Error} 如果连接管理器未初始化
   */
  public getEndpointManager(): EndpointManager {
    if (!this.endpointManager) {
      throw new Error(
        "小智连接管理器未初始化，请确保 WebServer 已调用 start() 方法完成初始化"
      );
    }
    return this.endpointManager;
  }

  /**
   * 设置 MCP 服务管理器实例（主要用于测试依赖注入）
   * 警告：如果要替换现有实例，调用者需要负责清理原有实例的资源
   */
  public setMCPServiceManager(manager: MCPServiceManager): void {
    // 如果已有实例且它正在运行，先清理它
    if (this.mcpServiceManager && this.mcpServiceManager !== manager) {
      this.logger.warn(
        "替换现有的 MCPServiceManager 实例，注意清理原有实例的资源"
      );
      // 注意：这里不直接调用 stopAllServices，因为调用者可能还在使用它
      // 调用者应该负责清理原有实例
    }

    this.mcpServiceManager = manager;
    this.logger.debug("MCPServiceManager 实例已更新");
  }

  /**
   * 获取 MCP 服务管理器实例
   * 提供给中间件使用
   * WebServer 启动后始终返回有效的服务管理器实例
   * @throws {MCPServiceManagerNotInitializedError} 如果服务管理器未初始化
   */
  public getMCPServiceManager(): MCPServiceManager {
    if (!this.mcpServiceManager) {
      throw new MCPServiceManagerNotInitializedError(
        "MCPServiceManager 未初始化，请确保 WebServer 已调用 start() 方法完成初始化"
      );
    }
    return this.mcpServiceManager;
  }

  /**
   * 获取小智连接状态信息
   */
  getEndpointConnectionStatus(): XiaozhiConnectionStatusResponse {
    if (this.endpointManager) {
      const connectionStatuses = this.endpointManager.getConnectionStatus();
      return {
        type: "multi-endpoint",
        manager: {
          connectedConnections: connectionStatuses.filter(
            (status: SimpleConnectionStatus) => status.connected
          ).length,
          totalConnections: connectionStatuses.length,
          healthCheckStats: {}, // 简化后不再提供复杂的健康检查统计
        },
        connections: connectionStatuses,
      };
    }

    return {
      type: "none",
      connected: false,
    };
  }

  /**
   * 设置路由系统
   */
  private setupRouteSystem(): void {
    // 初始化路由管理器，注入 Logger 实例
    this.routeManager = new RouteManager(this.logger);
  }

  /**
   * 从路由配置设置路由
   */
  private setupRoutesFromRegistry(): void {
    if (!this.routeManager || !this.app) {
      throw new Error("路由系统未初始化");
    }

    try {
      // 注册所有路由配置 - static 放在最后，作为回退
      this.routeManager.registerRoutes({
        config: configRoutes,
        status: statusRoutes,
        tools: toolsRoutes,
        mcp: mcpRoutes,
        version: versionRoutes,
        services: servicesRoutes,
        update: updateRoutes,
        coze: cozeRoutes,
        "tool-logs": toolLogsRoutes,
        mcpserver: mcpserverRoutes,
        endpoint: endpointRoutes,
        misc: miscRoutes,
        tts: ttsRoutes,
        static: staticRoutes, // 放在最后作为回退
      });

      // 应用路由到 Hono 应用
      this.routeManager.applyToApp(this.app);

      this.logger.info("路由系统注册完成");
    } catch (error) {
      this.logger.error("路由系统注册失败:", error);
    }
  }

  public async start(): Promise<void> {
    // 检查服务器是否已经启动
    if (this.httpServer) {
      this.logger.warn("Web server is already running");
      return;
    }

    // 1. 初始化所有连接（配置驱动）
    // 这必须在启动服务器之前完成，确保 MCPServiceManager 可用
    await this.initializeConnections();

    // 2. 设置路由系统（在连接初始化之后）
    this.setupRouteSystem();
    this.setupRoutesFromRegistry();

    // 3. 启动 HTTP 服务器
    const server = serve({
      fetch: this.app.fetch,
      port: this.port,
      hostname: HTTP_SERVER_CONFIG.DEFAULT_BIND_ADDRESS, // 绑定到所有网络接口，支持 Docker 部署
      createServer,
    });

    // 保存服务器实例
    this.httpServer = server;

    // 设置 WebSocket 服务器
    if (!this.httpServer) {
      throw new Error("HTTP server 未初始化");
    }
    await this.webSocketManager.start(
      this.httpServer as Server<
        typeof IncomingMessage,
        typeof ServerResponse
      >
    );

    // 启动心跳监控
    this.heartbeatMonitorInterval =
      this.webSocketManager.startHeartbeatMonitoring();

    this.logger.info(
      `Web server listening on http://${HTTP_SERVER_CONFIG.DEFAULT_BIND_ADDRESS}:${this.port}`
    );
    this.logger.info(`Local access: http://localhost:${this.port}`);
  }

  public stop(): Promise<void> {
    return new Promise((resolve) => {
      let resolved = false;

      const doResolve = () => {
        if (!resolved) {
          resolved = true;
          resolve();
        }
      };

      // 清理连接管理器和 MCPServiceManager
      (async () => {
        try {
          if (this.endpointManager) {
            await this.endpointManager.cleanup();
            this.logger.debug("连接管理器已清理");
          }
        } catch (error) {
          this.logger.error("连接管理器清理失败:", error);
        }

        try {
          if (this.mcpServiceManager) {
            await this.mcpServiceManager.stopAllServices();
            this.mcpServiceManager = null;
            this.logger.debug("MCPServiceManager 已清理");
          }
        } catch (error) {
          this.logger.error("MCPServiceManager 清理失败:", error);
        }

        // 停止心跳监控
        if (this.heartbeatMonitorInterval) {
          this.webSocketManager.stopHeartbeatMonitoring();
          this.heartbeatMonitorInterval = undefined;
        }

        // 停止 WebSocket 服务器
        this.webSocketManager.stop();

        // 强制关闭 HTTP 服务器，不等待现有连接
        if (this.httpServer) {
          this.httpServer.close(() => {
            this.logger.info("Web 服务器已停止");
            doResolve();
          });

          // 设置超时，如果 2 秒内没有关闭则强制退出
          setTimeout(() => {
            this.logger.info("Web 服务器已强制停止");
            doResolve();
          }, 2000);
        } else {
          this.logger.info("Web 服务器已停止");
          doResolve();
        }
      })();
    });
  }

  /**
   * 销毁 WebServer 实例，清理所有资源
   */
  public destroy(): void {
    this.logger.debug("销毁 WebServer 实例");

    // 停止心跳监控
    if (this.heartbeatMonitorInterval) {
      this.webSocketManager.stopHeartbeatMonitoring();
      this.heartbeatMonitorInterval = undefined;
    }

    // 销毁服务层
    this.statusService.destroy();
    this.notificationService.destroy();

    // 销毁事件总线
    destroyEventBus();

    // 清理管理器
    this.handlerRegistry.clear();

    this.logger.debug("WebServer 实例已销毁");
  }

  /**
   * 获取 Handler 注册表
   * 用于测试和依赖注入
   */
  getHandlerRegistry(): HandlerRegistry {
    return this.handlerRegistry;
  }

  /**
   * 获取事件协调器
   * 用于测试和依赖注入
   */
  getEventCoordinator(): EventCoordinator {
    return this.eventCoordinator;
  }

  /**
   * 获取 WebSocket 管理器
   * 用于测试和依赖注入
   */
  getWebSocketManager(): WebSocketManager {
    return this.webSocketManager;
  }

  /**
   * 获取中间件管理器
   * 用于测试和依赖注入
   */
  getMiddlewareManager(): MiddlewareManager {
    return this.middlewareManager;
  }
}

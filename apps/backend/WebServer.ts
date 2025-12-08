import { createServer } from "node:http";
import type { IncomingMessage, Server, ServerResponse } from "node:http";
import { ProxyMCPServer } from "@/lib/endpoint/connection.js";
import type { MCPServiceManager } from "@/lib/mcp";
import { ensureToolJSONSchema } from "@/lib/mcp/types.js";
import { convertLegacyToNew } from "@adapters/index.js";
import {
  ConfigApiHandler,
  CozeApiHandler,
  HeartbeatHandler,
  MCPRouteHandler,
  MCPServerApiHandler,
  RealtimeNotificationHandler,
  ServiceApiHandler,
  StaticFileHandler,
  StatusApiHandler,
  ToolApiHandler,
  ToolCallLogApiHandler,
  UpdateApiHandler,
  VersionApiHandler,
} from "@handlers/index.js";
import type { ServerType } from "@hono/node-server";
import { serve } from "@hono/node-server";
import {
  corsMiddleware,
  errorHandlerMiddleware,
  loggerMiddleware,
  mcpServiceManagerMiddleware,
  notFoundHandlerMiddleware,
  xiaozhiConnectionManagerMiddleware,
  xiaozhiEndpointsMiddleware,
} from "@middlewares/index.js";
import type { Tool } from "@modelcontextprotocol/sdk/types.js";
import type { Logger } from "@root/Logger.js";
import { logger } from "@root/Logger.js";
import { configManager } from "@root/configManager.js";
import type { MCPServerConfig } from "@root/configManager.js";
import type { AppContext } from "@root/types/index.js";
import { createApp } from "@root/types/index.js";
import type {
  EndpointConfigChangeEvent,
  EventBus,
  EventBusEvents,
  IndependentXiaozhiConnectionManager,
  SimpleConnectionStatus,
} from "@services/index.js";
import {
  ConfigService,
  MCPServiceManagerSingleton,
  NotificationService,
  StatusService,
  XiaozhiConnectionManagerSingleton,
  destroyEventBus,
  getEventBus,
} from "@services/index.js";
import type { Hono } from "hono";
import { WebSocketServer } from "ws";

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
  updateRoutes,
  versionRoutes,
} from "./routes/index.js";

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
    reconnectStats: Record<string, unknown>;
  };
  connections?: SimpleConnectionStatus[];
}

/**
 * WebServer - 主控制器，协调各个服务和处理器
 */
export class WebServer {
  private app: Hono<AppContext>;
  private httpServer: ServerType | null = null;
  private wss: WebSocketServer | null = null;
  private logger: Logger;
  private port: number;

  // 事件总线
  private eventBus: EventBus;

  // 服务层
  private configService: ConfigService;
  private statusService: StatusService;
  private notificationService: NotificationService;

  // HTTP API 处理器
  private configApiHandler: ConfigApiHandler;
  private statusApiHandler: StatusApiHandler;
  private serviceApiHandler: ServiceApiHandler;
  private toolApiHandler: ToolApiHandler;
  private toolCallLogApiHandler: ToolCallLogApiHandler;
  private versionApiHandler: VersionApiHandler;
  private staticFileHandler: StaticFileHandler;
  private mcpRouteHandler: MCPRouteHandler;
  private mcpServerApiHandler?: MCPServerApiHandler;
  private updateApiHandler: UpdateApiHandler;
  private cozeApiHandler: CozeApiHandler;

  // WebSocket 处理器
  private realtimeNotificationHandler: RealtimeNotificationHandler;
  private heartbeatHandler: HeartbeatHandler;

  // 心跳监控
  private heartbeatMonitorInterval?: NodeJS.Timeout;

  // 路由系统
  private routeManager?: RouteManager;

  // 向后兼容的属性
  private proxyMCPServer: ProxyMCPServer | undefined;
  private xiaozhiConnectionManager:
    | IndependentXiaozhiConnectionManager
    | undefined;
  private mcpServiceManager: MCPServiceManager | undefined;

  constructor(port?: number) {
    // 端口配置
    try {
      this.port = port ?? configManager.getWebUIPort() ?? 9999;
    } catch (error) {
      // 配置读取失败时使用默认端口
      this.port = port ?? 9999;
    }
    this.logger = logger.withTag("WebServer");

    // 初始化事件总线
    this.eventBus = getEventBus();

    // 初始化服务层
    this.configService = new ConfigService();
    this.statusService = new StatusService();
    this.notificationService = new NotificationService();

    // 初始化 HTTP API 处理器
    this.configApiHandler = new ConfigApiHandler();
    this.statusApiHandler = new StatusApiHandler(this.statusService);
    this.serviceApiHandler = new ServiceApiHandler(this.statusService);
    this.toolApiHandler = new ToolApiHandler();
    this.toolCallLogApiHandler = new ToolCallLogApiHandler();
    this.versionApiHandler = new VersionApiHandler();
    this.staticFileHandler = new StaticFileHandler();
    this.mcpRouteHandler = new MCPRouteHandler();
    this.updateApiHandler = new UpdateApiHandler();
    this.cozeApiHandler = new CozeApiHandler();

    // MCPServerApiHandler 将在 start() 方法中初始化，因为它需要 mcpServiceManager

    // 初始化 WebSocket 处理器
    this.realtimeNotificationHandler = new RealtimeNotificationHandler(
      this.notificationService,
      this.statusService
    );
    this.heartbeatHandler = new HeartbeatHandler(
      this.statusService,
      this.notificationService
    );

    // 初始化 Hono 应用
    this.app = createApp();
    this.setupMiddleware();

    // 在所有路由设置完成后，设置 404 处理
    this.app.notFound(notFoundHandlerMiddleware);

    // 监听接入点状态变更事件
    this.setupEndpointStatusListener();

    // HTTP 服务器和 WebSocket 服务器将在 start() 方法中初始化
  }

  /**
   * 初始化所有连接（配置驱动）
   */
  private async initializeConnections(): Promise<void> {
    try {
      this.logger.debug("开始初始化连接...");

      // 1. 读取配置
      const config = await this.loadConfiguration();

      // 2. 初始化 MCP 服务管理器
      this.mcpServiceManager = await MCPServiceManagerSingleton.getInstance();

      // 2.1. 初始化 MCP 服务器 API 处理器
      this.mcpServerApiHandler = new MCPServerApiHandler(
        this.mcpServiceManager,
        configManager
      );

      // 3. 从配置加载 MCP 服务
      await this.loadMCPServicesFromConfig(config.mcpServers);

      // 4. 获取工具列表
      const rawTools = this.mcpServiceManager.getAllTools();
      this.logger.debug(`已加载 ${rawTools.length} 个工具`);

      // 5. 转换工具格式以符合 MCP SDK 要求
      const tools: Tool[] = rawTools.map((tool) => ({
        name: tool.name,
        description: tool.description || "",
        inputSchema: ensureToolJSONSchema(tool.inputSchema),
      }));

      // 6. 初始化小智接入点连接
      await this.initializeXiaozhiConnection(config.mcpEndpoint, tools);

      this.logger.debug("所有连接初始化完成");
    } catch (error) {
      this.logger.error("连接初始化失败:", error);
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
      webUIPort: config.webUI?.port ?? 9999,
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
      const serviceConfig = convertLegacyToNew(name, config);
      this.mcpServiceManager.addServiceConfig(name, serviceConfig);
    }

    await this.mcpServiceManager.startAllServices();
  }

  /**
   * 初始化小智接入点连接
   */
  private async initializeXiaozhiConnection(
    mcpEndpoint: string | string[],
    tools: Tool[]
  ): Promise<void> {
    // 处理多端点配置
    const endpoints = Array.isArray(mcpEndpoint) ? mcpEndpoint : [mcpEndpoint];
    const validEndpoints = endpoints.filter(
      (ep) => ep && !ep.includes("<请填写")
    );

    // 1. 初始化连接管理器
    this.logger.debug(
      `初始化小智接入点连接管理器，端点数量: ${validEndpoints.length}`
    );

    try {
      // 获取小智连接管理器单例
      this.xiaozhiConnectionManager =
        await XiaozhiConnectionManagerSingleton.getInstance({
          reconnectInterval: 5000,
          maxReconnectAttempts: 3,
          connectionTimeout: 10000,
        });

      // 设置 MCP 服务管理器
      if (this.mcpServiceManager && this.xiaozhiConnectionManager) {
        this.xiaozhiConnectionManager.setServiceManager(this.mcpServiceManager);
      }

      this.logger.debug("✅ 连接管理器初始化完成");
    } catch (error) {
      this.logger.error("❌ 连接管理器初始化失败:", error);
      // 连接管理器初始化失败时，继续后续流程，允许延迟初始化
      return;
    }

    // 2. 只有在有有效端点时才进行连接和初始化
    if (validEndpoints.length > 0) {
      this.logger.debug("有效端点列表:", validEndpoints);

      try {
        // 初始化连接管理器（传入端点列表）
        await this.xiaozhiConnectionManager.initialize(validEndpoints, tools);

        // 连接所有端点
        await this.xiaozhiConnectionManager.connect();

        // 设置配置变更监听器
        this.xiaozhiConnectionManager.on(
          "configChange",
          (event: EndpointConfigChangeEvent) => {
            this.logger.debug(`小智连接配置变更: ${event.type}`, event.data);
          }
        );

        this.logger.debug(
          `小智接入点连接管理器初始化完成，管理 ${validEndpoints.length} 个端点`
        );
      } catch (error) {
        this.logger.error("小智接入点连接管理器初始化失败:", error);

        // 如果新的连接管理器失败，回退到原有的单连接模式（向后兼容）
        this.logger.warn("回退到单连接模式");
        const validEndpoint = validEndpoints[0];

        this.logger.debug(`初始化单个小智接入点连接: ${validEndpoint}`);
        this.proxyMCPServer = new ProxyMCPServer(validEndpoint);

        if (this.mcpServiceManager) {
          this.proxyMCPServer.setServiceManager(this.mcpServiceManager);
        }

        // 使用重连机制连接到小智接入点
        const proxyServer = this.proxyMCPServer;
        await this.connectWithRetry(
          () => proxyServer.connect(),
          "小智接入点连接"
        );
        this.logger.debug("小智接入点连接成功");
      }
    } else {
      try {
        if (this.xiaozhiConnectionManager) {
          // 初始化为空管理器，允许后续动态添加端点
          await this.xiaozhiConnectionManager.initialize([], tools);
          this.logger.debug("连接管理器已初始化为空管理器，支持动态添加端点");
        }
      } catch (error) {
        this.logger.error("❌ 空连接管理器初始化失败:", error);
        // 不抛出错误，允许系统继续运行
      }
    }
  }

  /**
   * 获取小智连接管理器实例
   * 提供给中间件使用
   */
  public getXiaozhiConnectionManager():
    | IndependentXiaozhiConnectionManager
    | undefined {
    return this.xiaozhiConnectionManager;
  }

  /**
   * 获取小智连接状态信息
   */
  getXiaozhiConnectionStatus(): XiaozhiConnectionStatusResponse {
    if (this.xiaozhiConnectionManager) {
      return {
        type: "multi-endpoint",
        manager: {
          connectedConnections: this.xiaozhiConnectionManager
            .getConnectionStatus()
            .filter((status) => status.connected).length,
          totalConnections:
            this.xiaozhiConnectionManager.getConnectionStatus().length,
          healthCheckStats: {}, // 简化后不再提供复杂的健康检查统计
          reconnectStats: this.xiaozhiConnectionManager.getReconnectStats(),
        },
        connections: this.xiaozhiConnectionManager.getConnectionStatus(),
      };
    }

    if (this.proxyMCPServer) {
      return {
        type: "single-endpoint",
        connected: true,
        endpoint: "unknown",
      };
    }

    return {
      type: "none",
      connected: false,
    };
  }

  /**
   * 带重试的连接方法
   */
  private async connectWithRetry<T>(
    connectionFn: () => Promise<T>,
    context: string,
    maxAttempts = 5,
    initialDelay = 1000,
    maxDelay = 30000,
    backoffMultiplier = 2
  ): Promise<T> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        this.logger.info(`${context} - 尝试连接 (${attempt}/${maxAttempts})`);
        return await connectionFn();
      } catch (error) {
        lastError = error as Error;
        this.logger.warn(`${context} - 连接失败:`, error);

        if (attempt < maxAttempts) {
          const delay = Math.min(
            initialDelay * backoffMultiplier ** (attempt - 1),
            maxDelay
          );
          this.logger.info(`${context} - ${delay}ms 后重试...`);
          await this.sleep(delay);
        }
      }
    }

    throw new Error(
      `${context} - 连接失败，已达到最大重试次数: ${lastError?.message}`
    );
  }

  /**
   * 延迟工具方法
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private setupMiddleware() {
    // Logger 中间件 - 必须在最前面
    this.app?.use("*", loggerMiddleware);

    // MCP Service Manager 中间件 - 在 Logger 之后，CORS 之前
    this.app?.use("*", mcpServiceManagerMiddleware);

    // 注入 WebServer 实例到上下文
    // 使用类型断言避免循环引用问题
    this.app?.use("*", async (c, next) => {
      c.set(
        "webServer",
        this as unknown as import("./types/hono.context.js").IWebServer
      );
      await next();
    });

    // 小智连接管理器中间件
    this.app?.use("*", xiaozhiConnectionManagerMiddleware());

    // 小智端点处理器中间件（在连接管理器中间件之后）
    this.app?.use("*", xiaozhiEndpointsMiddleware());

    // CORS 中间件
    this.app?.use("*", corsMiddleware);

    // 错误处理中间件
    this.app?.onError(errorHandlerMiddleware);

    // 注入路由系统依赖
    // 注意：这个中间件必须在路由注册之前设置
    this.app?.use("*", async (c, next) => {
      const dependencies = this.createHandlerDependencies();
      c.set("dependencies", dependencies);
      await next();
    });
  }

  /**
   * 创建处理器依赖对象
   * 统一管理依赖对象的创建，避免代码重复
   */
  private createHandlerDependencies(): HandlerDependencies {
    return {
      configApiHandler: this.configApiHandler,
      statusApiHandler: this.statusApiHandler,
      serviceApiHandler: this.serviceApiHandler,
      toolApiHandler: this.toolApiHandler,
      toolCallLogApiHandler: this.toolCallLogApiHandler,
      versionApiHandler: this.versionApiHandler,
      staticFileHandler: this.staticFileHandler,
      mcpRouteHandler: this.mcpRouteHandler,
      mcpServerApiHandler: this.mcpServerApiHandler,
      updateApiHandler: this.updateApiHandler,
      cozeApiHandler: this.cozeApiHandler,
      // endpointHandler 通过中间件动态注入，不在此初始化
    };
  }

  /**
   * 设置路由系统
   */
  private setupRouteSystem(): void {
    // 初始化路由管理器
    // 注意：RouteManager 不再需要依赖参数，因为依赖通过中间件动态注入
    this.routeManager = new RouteManager();
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
        static: staticRoutes, // 放在最后作为回退
      });

      // 应用路由到 Hono 应用
      this.routeManager.applyToApp(this.app);

      this.logger.info("路由系统注册完成");
    } catch (error) {
      this.logger.error("路由系统注册失败:", error);
    }
  }

  private setupWebSocket() {
    if (!this.wss) return;

    this.wss.on("connection", (ws) => {
      // 生成客户端 ID
      const clientId = `client-${Date.now()}-${Math.random()
        .toString(36)
        .substr(2, 9)}`;

      this.logger.debug(`WebSocket 客户端已连接: ${clientId}`);
      this.logger.debug(
        `当前 WebSocket 连接数: ${this.wss?.clients.size || 0}`
      );

      // 注册客户端到通知服务
      this.realtimeNotificationHandler.handleClientConnect(ws, clientId);
      this.heartbeatHandler.handleClientConnect(clientId);

      ws.on("message", async (message) => {
        try {
          const data = JSON.parse(message.toString());

          // 根据消息类型分发到不同的处理器
          if (data.type === "clientStatus") {
            await this.heartbeatHandler.handleClientStatus(ws, data, clientId);
          } else {
            await this.realtimeNotificationHandler.handleMessage(
              ws,
              data,
              clientId
            );
          }
        } catch (error) {
          this.logger.error("WebSocket message error:", error);
          const errorResponse = {
            type: "error",
            error: {
              code: "MESSAGE_PARSE_ERROR",
              message: error instanceof Error ? error.message : "消息解析失败",
              timestamp: Date.now(),
            },
          };
          ws.send(JSON.stringify(errorResponse));
        }
      });

      ws.on("close", () => {
        this.logger.debug(`WebSocket 客户端已断开连接: ${clientId}`);
        this.logger.debug(
          `剩余 WebSocket 连接数: ${this.wss?.clients.size || 0}`
        );

        // 处理客户端断开连接
        this.realtimeNotificationHandler.handleClientDisconnect(clientId);
        this.heartbeatHandler.handleClientDisconnect(clientId);
      });

      ws.on("error", (error) => {
        this.logger.error(`WebSocket 连接错误 (${clientId}):`, error);
      });

      // 发送初始数据
      this.realtimeNotificationHandler.sendInitialData(ws, clientId);
    });
  }

  /**
   * 设置接入点状态变更事件监听
   */
  private setupEndpointStatusListener(): void {
    this.eventBus.onEvent(
      "endpoint:status:changed",
      (eventData: EventBusEvents["endpoint:status:changed"]) => {
        // 向所有连接的 WebSocket 客户端广播接入点状态变更事件
        const message = {
          type: "endpoint_status_changed",
          data: {
            endpoint: eventData.endpoint,
            connected: eventData.connected,
            operation: eventData.operation,
            success: eventData.success,
            message: eventData.message,
            timestamp: eventData.timestamp,
          },
        };

        this.notificationService.broadcast("endpoint_status_changed", message);
        this.logger.debug(
          `广播接入点状态变更事件: ${eventData.endpoint} - ${eventData.operation}`
        );
      }
    );
  }

  public async start(): Promise<void> {
    // 检查服务器是否已经启动
    if (this.httpServer) {
      this.logger.warn("Web server is already running");
      return;
    }

    // 1. 启动 HTTP 服务器
    const server = serve({
      fetch: this.app.fetch,
      port: this.port,
      hostname: "0.0.0.0", // 绑定到所有网络接口，支持 Docker 部署
      createServer,
    });

    // 保存服务器实例
    this.httpServer = server;

    // 设置 WebSocket 服务器
    if (!this.httpServer) {
      throw new Error("HTTP server 未初始化");
    }
    this.wss = new WebSocketServer({
      server: this.httpServer as Server<
        typeof IncomingMessage,
        typeof ServerResponse
      >,
    });
    this.setupWebSocket();

    // 启动心跳监控
    this.heartbeatMonitorInterval =
      this.heartbeatHandler.startHeartbeatMonitoring();

    this.logger.info(`Web server listening on http://0.0.0.0:${this.port}`);
    this.logger.info(`Local access: http://localhost:${this.port}`);

    // // 输出架构重构信息
    // this.logger.info("=== 通信架构重构信息 - 第二阶段完成 ===");
    // this.logger.info("✅ 模块化拆分: HTTP/WebSocket 处理器独立");
    // this.logger.info(
    //   "✅ 服务层抽象: ConfigService, StatusService, NotificationService"
    // );
    // this.logger.info("✅ 事件驱动机制: EventBus 实现模块间解耦通信");
    // this.logger.info("✅ HTTP API 职责: 配置管理、状态查询、服务控制");
    // this.logger.info("✅ WebSocket 职责: 实时通知、心跳检测、事件广播");
    // this.logger.info(
    //   "⚠️  已废弃的 WebSocket 消息: getConfig, updateConfig, getStatus, restartService"
    // );
    // this.logger.info("📖 推荐使用对应的 HTTP API 替代废弃的 WebSocket 消息");
    // this.logger.info("================================================");

    // 2. 初始化所有连接（配置驱动）
    await this.initializeConnections();

    // 3. 设置路由系统（在连接初始化之后）
    this.setupRouteSystem();
    this.setupRoutesFromRegistry();
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

      // 停止 MCP 客户端
      this.proxyMCPServer?.disconnect();

      // 停止心跳监控
      if (this.heartbeatMonitorInterval) {
        this.heartbeatHandler.stopHeartbeatMonitoring(
          this.heartbeatMonitorInterval
        );
        this.heartbeatMonitorInterval = undefined;
      }

      // 强制断开所有 WebSocket 客户端连接
      if (this.wss) {
        for (const client of this.wss.clients) {
          client.terminate();
        }

        // 关闭 WebSocket 服务器
        this.wss.close(() => {
          // 强制关闭 HTTP 服务器，不等待现有连接
          if (this.httpServer) {
            this.httpServer.close(() => {
              this.logger.info("Web 服务器已停止");
              doResolve();
            });
          } else {
            this.logger.info("Web 服务器已停止");
            doResolve();
          }

          // 设置超时，如果 2 秒内没有关闭则强制退出
          setTimeout(() => {
            this.logger.info("Web 服务器已强制停止");
            doResolve();
          }, 2000);
        });
      } else {
        this.logger.info("Web 服务器已停止");
        doResolve();
      }
    });
  }

  /**
   * 销毁 WebServer 实例，清理所有资源
   */
  public destroy(): void {
    this.logger.debug("销毁 WebServer 实例");

    // 停止心跳监控
    if (this.heartbeatMonitorInterval) {
      this.heartbeatHandler.stopHeartbeatMonitoring(
        this.heartbeatMonitorInterval
      );
      this.heartbeatMonitorInterval = undefined;
    }

    // 销毁服务层
    this.statusService.destroy();
    this.notificationService.destroy();

    // 销毁事件总线
    destroyEventBus();

    // 断开 MCP 连接
    this.proxyMCPServer?.disconnect();

    this.logger.debug("WebServer 实例已销毁");
  }
}

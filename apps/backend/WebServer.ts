import { createServer } from "node:http";
import type { IncomingMessage, Server, ServerResponse } from "node:http";
import { MCPServiceManager } from "@/lib/mcp";
import type { EnhancedToolInfo } from "@/lib/mcp/types.js";
import { ensureToolJSONSchema } from "@/lib/mcp/types.js";
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
  endpointManagerMiddleware,
  endpointsMiddleware,
  errorHandlerMiddleware,
  loggerMiddleware,
  mcpServiceManagerMiddleware,
  notFoundHandlerMiddleware,
  responseEnhancerMiddleware,
} from "@middlewares/index.js";
import type { Tool } from "@modelcontextprotocol/sdk/types.js";
import type { Logger } from "@root/Logger.js";
import { logger } from "@root/Logger.js";
import type { AppContext } from "@root/types/index.js";
import { createApp } from "@root/types/index.js";
import type { EventBus, EventBusEvents } from "@services/index.js";
import {
  NotificationService,
  StatusService,
  destroyEventBus,
  getEventBus,
} from "@services/index.js";
import { normalizeServiceConfig } from "@xiaozhi-client/config";
import { configManager } from "@xiaozhi-client/config";
import type { MCPServerConfig } from "@xiaozhi-client/config";
import { EndpointManager } from "@xiaozhi-client/endpoint";
import type { SimpleConnectionStatus } from "@xiaozhi-client/endpoint";
import type { Hono } from "hono";
import { WebSocketServer } from "ws";

import { MCPServiceManagerNotInitializedError } from "./errors/MCPErrors.middleware.js";
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

  // 连接管理相关属性
  private endpointManager: EndpointManager | null = null;
  private mcpServiceManager: MCPServiceManager | null = null; // WebServer 直接管理的实例

  constructor(port?: number) {
    // 端口配置
    try {
      this.port = port ?? configManager.getWebUIPort() ?? 9999;
    } catch (error) {
      // 配置读取失败时使用默认端口
      this.port = port ?? 9999;
    }
    this.logger = logger;

    // 初始化事件总线
    this.eventBus = getEventBus();

    // 初始化服务层
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
    // 监听 MCP 服务添加事件
    this.setupMCPServerAddedListener();
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
      this.mcpServerApiHandler = new MCPServerApiHandler(
        this.mcpServiceManager,
        configManager
      );

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

    // 响应增强中间件 - 在 logger 之后，其他中间件之前
    // 这样所有路由都可以使用 c.success、c.fail、c.paginate 方法
    this.app?.use("*", responseEnhancerMiddleware);

    // 注入 WebServer 实例到上下文
    // 使用类型断言避免循环引用问题
    this.app?.use("*", async (c, next) => {
      c.set(
        "webServer",
        this as unknown as import("./types/hono.context.js").IWebServer
      );
      await next();
    });

    // MCP Service Manager 中间件 - 必须在 WebServer 注入之后
    this.app?.use("*", mcpServiceManagerMiddleware);

    // 小智连接管理器中间件
    this.app?.use("*", endpointManagerMiddleware());

    // 小智接入点处理器中间件（在连接管理器中间件之后）
    this.app?.use("*", endpointsMiddleware());

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

  /**
   * 设置 MCP 服务添加事件监听
   * 当添加新的 MCP 服务后，自动重连接入点以同步服务列表
   */
  private setupMCPServerAddedListener(): void {
    // 监听单个服务添加事件
    this.eventBus.onEvent(
      "mcp:server:added",
      async (eventData: EventBusEvents["mcp:server:added"]) => {
        this.logger.info(
          `检测到 MCP 服务添加: ${eventData.serverName}，工具数量: ${eventData.tools.length}`
        );

        if (!this.endpointManager) {
          this.logger.warn("EndpointManager 未初始化，跳过重连");
          return;
        }

        try {
          // 获取当前连接的端点数量
          const connectionStatuses = this.endpointManager.getConnectionStatus();
          const connectedEndpointCount = connectionStatuses.filter(
            (status) => status.connected
          ).length;

          if (connectedEndpointCount === 0) {
            this.logger.debug("当前没有已连接的端点，跳过重连");
            return;
          }

          this.logger.info(`开始重连 ${connectedEndpointCount} 个接入点...`);

          // 重连所有端点
          await this.endpointManager.reconnect();

          this.logger.info("接入点重连成功，新服务工具已同步");

          // 发送重连完成事件
          this.eventBus.emitEvent("endpoint:reconnect:completed", {
            trigger: "mcp_server_added",
            serverName: eventData.serverName,
            endpointCount: connectedEndpointCount,
            timestamp: Date.now(),
          });
        } catch (error) {
          this.logger.error("接入点重连失败:", error);

          // 发送重连失败事件
          this.eventBus.emitEvent("endpoint:reconnect:failed", {
            trigger: "mcp_server_added",
            serverName: eventData.serverName,
            error: error instanceof Error ? error.message : String(error),
            timestamp: Date.now(),
          });
        }
      }
    );

    // 监听批量服务添加事件
    this.eventBus.onEvent(
      "mcp:server:batch_added",
      async (eventData: EventBusEvents["mcp:server:batch_added"]) => {
        this.logger.info(
          `检测到批量 MCP 服务添加: ${eventData.addedCount} 个成功，${eventData.failedCount} 个失败`
        );

        if (!this.endpointManager || eventData.addedCount === 0) {
          return;
        }

        try {
          // 获取当前连接的端点数量
          const connectionStatuses = this.endpointManager.getConnectionStatus();
          const connectedEndpointCount = connectionStatuses.filter(
            (status) => status.connected
          ).length;

          if (connectedEndpointCount === 0) {
            this.logger.debug("当前没有已连接的端点，跳过重连");
            return;
          }

          this.logger.info(`开始重连 ${connectedEndpointCount} 个接入点...`);

          // 重连所有端点
          await this.endpointManager.reconnect();

          this.logger.info("接入点重连成功，批量服务工具已同步");

          // 发送重连完成事件
          this.eventBus.emitEvent("endpoint:reconnect:completed", {
            trigger: "mcp_server_batch_added",
            serverName: undefined,
            endpointCount: connectedEndpointCount,
            timestamp: Date.now(),
          });
        } catch (error) {
          this.logger.error("接入点重连失败:", error);

          // 发送重连失败事件
          this.eventBus.emitEvent("endpoint:reconnect:failed", {
            trigger: "mcp_server_batch_added",
            serverName: undefined,
            error: error instanceof Error ? error.message : String(error),
            timestamp: Date.now(),
          });
        }
      }
    );
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

    this.logger.debug("WebServer 实例已销毁");
  }
}

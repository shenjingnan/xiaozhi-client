import { createServer } from "node:http";
import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { WebSocketServer } from "ws";
import { type Logger, logger } from "./Logger.js";
import { ProxyMCPServer, type Tool } from "./ProxyMCPServer.js";
import { convertLegacyToNew } from "./adapters/ConfigAdapter.js";
import { createContainer } from "./cli/Container.js";
import { configManager } from "./configManager.js";
import type { AppConfig, MCPServerConfig } from "./configManager.js";
// MCPTransportType 已移除，不再需要导入
import type { MCPServiceManager } from "./services/MCPServiceManager.js";
import { MCPServiceManagerSingleton } from "./services/MCPServiceManagerSingleton.js";
import type { XiaozhiConnectionManager } from "./services/XiaozhiConnectionManager.js";
import { XiaozhiConnectionManagerSingleton } from "./services/XiaozhiConnectionManagerSingleton.js";

import { ConfigApiHandler } from "./handlers/ConfigApiHandler.js";
import { CozeApiHandler } from "./handlers/CozeApiHandler.js";
import { HeartbeatHandler } from "./handlers/HeartbeatHandler.js";
import { MCPRouteHandler } from "./handlers/MCPRouteHandler.js";
import { MCPServerApiHandler } from "./handlers/MCPServerApiHandler.js";
import { RealtimeNotificationHandler } from "./handlers/RealtimeNotificationHandler.js";
import { ServiceApiHandler } from "./handlers/ServiceApiHandler.js";
import { StaticFileHandler } from "./handlers/StaticFileHandler.js";
import { StatusApiHandler } from "./handlers/StatusApiHandler.js";
import { ToolApiHandler } from "./handlers/ToolApiHandler.js";
import { VersionApiHandler } from "./handlers/VersionApiHandler.js";
import { ConfigService } from "./services/ConfigService.js";
// 导入新的服务和处理器
import {
  type EventBus,
  destroyEventBus,
  getEventBus,
} from "./services/EventBus.js";
import { NotificationService } from "./services/NotificationService.js";
import { StatusService } from "./services/StatusService.js";

// 统一错误响应格式
interface ApiErrorResponse {
  error: {
    code: string;
    message: string;
    details?: any;
  };
}

// 统一成功响应格式
interface ApiSuccessResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
}

// 硬编码常量已移除，改为配置驱动
interface ClientInfo {
  status: "connected" | "disconnected";
  mcpEndpoint: string;
  activeMCPServers: string[];
  lastHeartbeat?: number;
}

/**
 * WebServer - 主控制器，协调各个服务和处理器
 */
export class WebServer {
  private app: Hono;
  private httpServer: any = null;
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
  private mcpServerApiHandler: MCPServerApiHandler;
  private statusApiHandler: StatusApiHandler;
  private serviceApiHandler: ServiceApiHandler;
  private toolApiHandler: ToolApiHandler;
  private versionApiHandler: VersionApiHandler;
  private staticFileHandler: StaticFileHandler;
  private mcpRouteHandler: MCPRouteHandler;

  // WebSocket 处理器
  private realtimeNotificationHandler: RealtimeNotificationHandler;
  private heartbeatHandler: HeartbeatHandler;

  // 心跳监控
  private heartbeatMonitorInterval?: NodeJS.Timeout;

  // 向后兼容的属性
  private proxyMCPServer: ProxyMCPServer | undefined;
  private xiaozhiConnectionManager: XiaozhiConnectionManager | undefined;
  private mcpServiceManager: MCPServiceManager | undefined;

  /**
   * 创建统一的错误响应
   * @deprecated 使用处理器中的方法替代
   */
  private createErrorResponse(
    code: string,
    message: string,
    details?: any
  ): ApiErrorResponse {
    return {
      error: {
        code,
        message,
        details,
      },
    };
  }

  /**
   * 创建统一的成功响应
   * @deprecated 使用处理器中的方法替代
   */
  private createSuccessResponse<T>(
    data?: T,
    message?: string
  ): ApiSuccessResponse<T> {
    return {
      success: true,
      data,
      message,
    };
  }

  /**
   * 记录废弃功能使用警告
   * @deprecated 使用处理器中的方法替代
   */
  private logDeprecationWarning(feature: string, alternative: string): void {
    this.logger.warn(
      `[DEPRECATED] ${feature} 功能已废弃，请使用 ${alternative} 替代`
    );
  }

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
    this.mcpServerApiHandler = new MCPServerApiHandler();
    this.statusApiHandler = new StatusApiHandler(this.statusService);
    this.serviceApiHandler = new ServiceApiHandler(this.statusService);
    this.toolApiHandler = new ToolApiHandler();
    this.versionApiHandler = new VersionApiHandler();
    this.staticFileHandler = new StaticFileHandler();
    this.mcpRouteHandler = new MCPRouteHandler();

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
    this.app = new Hono();
    this.setupMiddleware();
    this.setupRoutes();

    this.logger.info("WebServer 架构重构完成 - 第二阶段：模块化拆分");

    // HTTP 服务器和 WebSocket 服务器将在 start() 方法中初始化
  }

  /**
   * 初始化所有连接（配置驱动）
   */
  private async initializeConnections(): Promise<void> {
    try {
      this.logger.info("开始初始化连接...");

      // 1. 读取配置
      const config = await this.loadConfiguration();

      // 2. 初始化 MCP 服务管理器
      this.mcpServiceManager = await MCPServiceManagerSingleton.getInstance();

      // 3. 从配置加载 MCP 服务
      await this.loadMCPServicesFromConfig(config.mcpServers);

      // 4. 获取工具列表
      const tools = this.mcpServiceManager.getAllTools();
      this.logger.info(`已加载 ${tools.length} 个工具`);

      // 5. 初始化小智接入点连接
      await this.initializeXiaozhiConnection(config.mcpEndpoint, tools);

      this.logger.info("所有连接初始化完成");
    } catch (error) {
      this.logger.error("连接初始化失败:", error);
      throw error;
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
      this.logger.info(`添加 MCP 服务配置: ${name}`);
      // 使用配置适配器转换配置格式
      const serviceConfig = convertLegacyToNew(name, config);
      this.mcpServiceManager.addServiceConfig(name, serviceConfig);
    }

    await this.mcpServiceManager.startAllServices();
    this.logger.info("所有 MCP 服务已启动");
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

    if (validEndpoints.length === 0) {
      this.logger.warn("未配置有效的小智接入点，跳过连接");
      return;
    }

    this.logger.info(
      `初始化小智接入点连接管理器，端点数量: ${validEndpoints.length}`
    );
    this.logger.debug("有效端点列表:", validEndpoints);

    try {
      // 获取小智连接管理器单例
      this.xiaozhiConnectionManager =
        await XiaozhiConnectionManagerSingleton.getInstance({
          healthCheckInterval: 30000,
          reconnectInterval: 5000,
          maxReconnectAttempts: 10,
          loadBalanceStrategy: "round-robin",
          connectionTimeout: 10000,
        });

      // 设置 MCP 服务管理器
      if (this.mcpServiceManager) {
        this.xiaozhiConnectionManager.setServiceManager(this.mcpServiceManager);
      }

      // 初始化连接管理器
      await this.xiaozhiConnectionManager.initialize(validEndpoints, tools);

      // 连接所有端点
      await this.xiaozhiConnectionManager.connect();

      // 设置配置变更监听器
      this.xiaozhiConnectionManager.on("configChange", (event: any) => {
        this.logger.info(`小智连接配置变更: ${event.type}`, event.data);
      });

      this.logger.info(
        `小智接入点连接管理器初始化完成，管理 ${validEndpoints.length} 个端点`
      );
    } catch (error) {
      this.logger.error("小智接入点连接管理器初始化失败:", error);

      // 如果新的连接管理器失败，回退到原有的单连接模式（向后兼容）
      this.logger.warn("回退到单连接模式");
      const validEndpoint = validEndpoints[0];

      this.logger.info(`初始化单个小智接入点连接: ${validEndpoint}`);
      this.proxyMCPServer = new ProxyMCPServer(validEndpoint);

      if (this.mcpServiceManager) {
        this.proxyMCPServer.setServiceManager(this.mcpServiceManager);
      }

      // 使用重连机制连接到小智接入点
      await this.connectWithRetry(
        () => this.proxyMCPServer!.connect(),
        "小智接入点连接"
      );
      this.logger.info("小智接入点连接成功（单连接模式）");
    }
  }

  /**
   * 获取最佳的小智连接（用于向后兼容）
   */
  private getBestXiaozhiConnection(): ProxyMCPServer | null {
    if (this.xiaozhiConnectionManager) {
      return this.xiaozhiConnectionManager.selectBestConnection();
    }
    return this.proxyMCPServer || null;
  }

  /**
   * 获取小智连接状态信息
   */
  getXiaozhiConnectionStatus(): any {
    if (this.xiaozhiConnectionManager) {
      return {
        type: "multi-endpoint",
        manager: {
          healthyConnections:
            this.xiaozhiConnectionManager.getHealthyConnections().length,
          totalConnections:
            this.xiaozhiConnectionManager.getConnectionStatus().length,
          loadBalanceStats: this.xiaozhiConnectionManager.getLoadBalanceStats(),
          healthCheckStats: this.xiaozhiConnectionManager.getHealthCheckStats(),
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
    // CORS 中间件
    this.app?.use(
      "*",
      cors({
        origin: "*",
        allowMethods: ["GET", "POST", "PUT", "OPTIONS"],
        allowHeaders: ["Content-Type"],
      })
    );

    // 错误处理中间件
    this.app?.onError((err, c) => {
      this.logger.error("HTTP request error:", err);
      const errorResponse = this.createErrorResponse(
        "INTERNAL_SERVER_ERROR",
        "服务器内部错误",
        process.env.NODE_ENV === "development" ? err.stack : undefined
      );
      return c.json(errorResponse, 500);
    });
  }

  private setupRoutes() {
    // 配置相关 API 路由
    this.app?.get("/api/config", (c) => this.configApiHandler.getConfig(c));
    this.app?.put("/api/config", (c) => this.configApiHandler.updateConfig(c));
    this.app?.get("/api/config/mcp-endpoint", (c) =>
      this.configApiHandler.getMcpEndpoint(c)
    );
    this.app?.get("/api/config/mcp-endpoints", (c) =>
      this.configApiHandler.getMcpEndpoints(c)
    );
    this.app?.get("/api/config/mcp-servers", (c) =>
      this.configApiHandler.getMcpServers(c)
    );
    this.app?.get("/api/config/connection", (c) =>
      this.configApiHandler.getConnectionConfig(c)
    );
    this.app?.post("/api/config/reload", (c) =>
      this.configApiHandler.reloadConfig(c)
    );
    this.app?.get("/api/config/path", (c) =>
      this.configApiHandler.getConfigPath(c)
    );
    this.app?.get("/api/config/exists", (c) =>
      this.configApiHandler.checkConfigExists(c)
    );

    // 版本信息 API 路由
    this.app?.get("/api/version", (c) => this.versionApiHandler.getVersion(c));
    this.app?.get("/api/version/simple", (c) =>
      this.versionApiHandler.getVersionSimple(c)
    );
    this.app?.post("/api/version/cache/clear", (c) =>
      this.versionApiHandler.clearVersionCache(c)
    );

    // 状态相关 API 路由
    this.app?.get("/api/status", (c) => this.statusApiHandler.getStatus(c));
    this.app?.get("/api/status/client", (c) =>
      this.statusApiHandler.getClientStatus(c)
    );
    this.app?.get("/api/status/restart", (c) =>
      this.statusApiHandler.getRestartStatus(c)
    );
    this.app?.get("/api/status/connected", (c) =>
      this.statusApiHandler.checkClientConnected(c)
    );
    this.app?.get("/api/status/heartbeat", (c) =>
      this.statusApiHandler.getLastHeartbeat(c)
    );
    this.app?.get("/api/status/mcp-servers", (c) =>
      this.statusApiHandler.getActiveMCPServers(c)
    );
    this.app?.put("/api/status/client", (c) =>
      this.statusApiHandler.updateClientStatus(c)
    );
    this.app?.put("/api/status/mcp-servers", (c) =>
      this.statusApiHandler.setActiveMCPServers(c)
    );
    this.app?.post("/api/status/reset", (c) =>
      this.statusApiHandler.resetStatus(c)
    );

    // 服务相关 API 路由
    this.app?.post("/api/services/restart", (c) =>
      this.serviceApiHandler.restartService(c)
    );
    this.app?.post("/api/services/stop", (c) =>
      this.serviceApiHandler.stopService(c)
    );
    this.app?.post("/api/services/start", (c) =>
      this.serviceApiHandler.startService(c)
    );
    this.app?.get("/api/services/status", (c) =>
      this.serviceApiHandler.getServiceStatus(c)
    );
    this.app?.get("/api/services/health", (c) =>
      this.serviceApiHandler.getServiceHealth(c)
    );

    // 工具调用相关 API 路由
    this.app?.post("/api/tools/call", (c) => this.toolApiHandler.callTool(c));
    this.app?.get("/api/tools/list", (c) => this.toolApiHandler.listTools(c));
    this.app?.get("/api/tools/custom", (c) =>
      this.toolApiHandler.getCustomTools(c)
    );
    // 新增工具管理路由
    this.app?.post("/api/tools/custom", (c) =>
      this.toolApiHandler.addCustomTool(c)
    );
    this.app?.put("/api/tools/custom/:toolName", (c) =>
      this.toolApiHandler.updateCustomTool(c)
    );
    this.app?.delete("/api/tools/custom/:toolName", (c) =>
      this.toolApiHandler.removeCustomTool(c)
    );

    // MCP 服务管理 API 路由 (新增)
    this.app?.post("/api/mcp-servers/add", (c) =>
      this.mcpServerApiHandler.addMCPServer(c)
    );
    this.app?.post("/api/mcp-servers/remove", (c) =>
      this.mcpServerApiHandler.removeMCPServer(c)
    );
    this.app?.post("/api/mcp-servers/test-connection", (c) =>
      this.mcpServerApiHandler.testConnection(c)
    );
    this.app?.get("/api/mcp-servers/:serviceName/status", (c) =>
      this.mcpServerApiHandler.getServiceStatus(c)
    );
    this.app?.get("/api/mcp-servers/:serviceName/tools", (c) =>
      this.mcpServerApiHandler.getServiceTools(c)
    );
    this.app?.put("/api/mcp-servers/:serviceName/config", (c) =>
      this.mcpServerApiHandler.updateServiceConfig(c)
    );

    // 扣子 API 相关路由
    this.app?.get("/api/coze/workspaces", (c) =>
      CozeApiHandler.getWorkspaces(c)
    );
    this.app?.get("/api/coze/workflows", (c) => CozeApiHandler.getWorkflows(c));
    this.app?.post("/api/coze/cache/clear", (c) =>
      CozeApiHandler.clearCache(c)
    );
    this.app?.get("/api/coze/cache/stats", (c) =>
      CozeApiHandler.getCacheStats(c)
    );

    // MCP 服务路由 - 符合 MCP Streamable HTTP 规范
    this.app?.post("/mcp", (c) => this.mcpRouteHandler.handlePost(c));
    this.app?.get("/mcp", (c) => this.mcpRouteHandler.handleGet(c));

    // 处理未知的 API 路由
    this.app?.all("/api/*", async (c) => {
      const errorResponse = this.createErrorResponse(
        "API_NOT_FOUND",
        `API 端点不存在: ${c.req.path}`
      );
      return c.json(errorResponse, 404);
    });

    // 静态文件服务 - 放在最后作为回退
    this.app.get("*", (c) => this.staticFileHandler.handleStaticFile(c));
  }

  private setupWebSocket() {
    if (!this.wss) return;

    this.wss.on("connection", (ws) => {
      // 生成客户端 ID
      const clientId = `client-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

      this.logger.info(`WebSocket 客户端已连接: ${clientId}`);
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
        this.logger.info(`WebSocket 客户端已断开连接: ${clientId}`);
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
    this.wss = new WebSocketServer({ server: this.httpServer });
    this.setupWebSocket();

    // 启动心跳监控
    this.heartbeatMonitorInterval =
      this.heartbeatHandler.startHeartbeatMonitoring();

    this.logger.info(`Web server listening on http://0.0.0.0:${this.port}`);
    this.logger.info(`Local access: http://localhost:${this.port}`);

    // 输出架构重构信息
    this.logger.info("=== 通信架构重构信息 - 第二阶段完成 ===");
    this.logger.info("✅ 模块化拆分: HTTP/WebSocket 处理器独立");
    this.logger.info(
      "✅ 服务层抽象: ConfigService, StatusService, NotificationService"
    );
    this.logger.info("✅ 事件驱动机制: EventBus 实现模块间解耦通信");
    this.logger.info("✅ HTTP API 职责: 配置管理、状态查询、服务控制");
    this.logger.info("✅ WebSocket 职责: 实时通知、心跳检测、事件广播");
    this.logger.info(
      "⚠️  已废弃的 WebSocket 消息: getConfig, updateConfig, getStatus, restartService"
    );
    this.logger.info("📖 推荐使用对应的 HTTP API 替代废弃的 WebSocket 消息");
    this.logger.info("================================================");

    // 2. 初始化所有连接（配置驱动）
    try {
      await this.initializeConnections();
      this.logger.info("所有连接初始化完成");
    } catch (error) {
      this.logger.error("连接初始化失败，但 Web 服务器继续运行:", error);
      // 连接失败不影响 Web 服务器启动，用户可以通过界面查看错误信息
    }
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
              this.logger.info("Web server stopped");
              doResolve();
            });
          } else {
            this.logger.info("Web server stopped");
            doResolve();
          }

          // 设置超时，如果 2 秒内没有关闭则强制退出
          setTimeout(() => {
            this.logger.info("Web server force stopped");
            doResolve();
          }, 2000);
        });
      } else {
        this.logger.info("Web server stopped");
        doResolve();
      }
    });
  }

  /**
   * 销毁 WebServer 实例，清理所有资源
   */
  public destroy(): void {
    this.logger.info("销毁 WebServer 实例");

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

    this.logger.info("WebServer 实例已销毁");
  }
}

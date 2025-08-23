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
import { RouteManager } from "./routes/RouteManager.js";
import { ConfigRoutes, StatusRoutes, StaticRoutes } from "./routes/index.js";
import { WebSocketManager } from "./websocket/WebSocketManager.js";
import { ConfigHandler, StatusHandler, ServiceHandler } from "./websocket/handlers/index.js";

// 硬编码常量已移除，改为配置驱动
interface ClientInfo {
  status: "connected" | "disconnected";
  mcpEndpoint: string;
  activeMCPServers: string[];
  lastHeartbeat?: number;
}

export class WebServer {
  private app: Hono;
  private httpServer: any = null;
  private wss: WebSocketServer | null = null;
  private logger: Logger;
  private port: number;
  private clientInfo: ClientInfo = {
    status: "disconnected",
    mcpEndpoint: "",
    activeMCPServers: [],
  };
  private heartbeatTimeout?: NodeJS.Timeout;
  private readonly HEARTBEAT_TIMEOUT = 35000; // 35 seconds (slightly more than client's 30s interval)
  private statusHandler?: StatusHandler;
  private proxyMCPServer: ProxyMCPServer | undefined; // 保留用于向后兼容
  private xiaozhiConnectionManager: XiaozhiConnectionManager | undefined;
  private mcpServiceManager: MCPServiceManager | undefined;
  private routeManager: RouteManager;
  private webSocketManager: WebSocketManager;

  constructor(port?: number) {
    // 端口配置
    try {
      this.port = port ?? configManager.getWebUIPort() ?? 9999;
    } catch (error) {
      // 配置读取失败时使用默认端口
      this.port = port ?? 9999;
    }
    this.logger = logger;

    // 延迟初始化，在 start() 方法中进行连接管理
    // 移除硬编码的 MCP 服务和工具配置

    // 初始化管理器
    this.routeManager = new RouteManager();
    this.webSocketManager = new WebSocketManager();

    // 初始化 Hono 应用
    this.app = new Hono();
    this.setupMiddleware();
    this.setupRoutes();

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
      return c.json({ error: "Internal Server Error" }, 500);
    });
  }

  private setupRoutes() {
    // 创建路由处理器
    const configRoutes = new ConfigRoutes();
    const statusRoutes = new StatusRoutes();
    const staticRoutes = new StaticRoutes();

    // 设置回调函数
    configRoutes.setBroadcastCallback((message) => {
      this.broadcastMessage(message);
    });

    statusRoutes.setMCPStatusCallback(() => {
      return this.proxyMCPServer?.getStatus();
    });

    // 添加路由处理器到管理器
    this.routeManager.addRouteHandler(configRoutes);
    this.routeManager.addRouteHandler(statusRoutes);
    this.routeManager.addRouteHandler(staticRoutes);

    // 注册所有路由
    this.routeManager.registerRoutes(this.app);
  }



  private setupWebSocket() {
    if (!this.wss) return;

    // 创建消息处理器
    const configHandler = new ConfigHandler();
    const statusHandler = new StatusHandler();
    const serviceHandler = new ServiceHandler();

    // 保存 statusHandler 引用以便其他方法使用
    this.statusHandler = statusHandler;

    // 设置回调函数
    configHandler.setBroadcastCallback((message) => {
      this.broadcastMessage(message);
    });

    statusHandler.setBroadcastCallback((message) => {
      this.broadcastMessage(message);
    });

    serviceHandler.setBroadcastCallback((message) => {
      this.broadcastMessage(message);
    });

    serviceHandler.setCreateContainer(async () => {
      return await createContainer();
    });

    // 添加消息处理器到管理器
    this.webSocketManager.addMessageHandler(configHandler);
    this.webSocketManager.addMessageHandler(statusHandler);
    this.webSocketManager.addMessageHandler(serviceHandler);

    // 设置 WebSocket 服务器（使用现有的 wss 实例）
    // 注意：这里我们需要手动设置连接处理，因为 wss 已经创建
    this.wss.on("connection", (ws) => {
      this.webSocketManager.handleConnection(ws);

      // 发送初始数据
      setTimeout(async () => {
        await configHandler.sendInitialConfig(ws);
        await statusHandler.sendInitialStatus(ws);
      }, 100);
    });
  }



  /**
   * 通用的消息广播方法
   * @param message 要广播的消息对象
   */
  private broadcastMessage(message: any): void {
    if (!this.wss) return;

    const messageStr = JSON.stringify(message);
    for (const client of this.wss.clients) {
      if (client.readyState === 1) {
        client.send(messageStr);
      }
    }
  }

  public broadcastConfigUpdate(config: AppConfig) {
    this.broadcastMessage({ type: "configUpdate", data: config });
  }



  private broadcastStatusUpdate() {
    if (!this.wss) return;

    const message = JSON.stringify({
      type: "statusUpdate",
      data: this.clientInfo,
    });
    for (const client of this.wss.clients) {
      if (client.readyState === 1) {
        client.send(message);
      }
    }
  }

  private updateClientInfo(info: Partial<ClientInfo>) {
    this.clientInfo = { ...this.clientInfo, ...info };
    if (info.lastHeartbeat) {
      this.clientInfo.lastHeartbeat = Date.now();
    }

    // Reset heartbeat timeout when receiving client status
    if (info.status === "connected") {
      this.resetHeartbeatTimeout();
    }
  }

  private resetHeartbeatTimeout() {
    // Clear existing timeout
    if (this.heartbeatTimeout) {
      clearTimeout(this.heartbeatTimeout);
    }

    // Set new timeout
    this.heartbeatTimeout = setTimeout(() => {
      this.logger.warn("客户端心跳超时，标记为断开连接");
      this.updateClientInfo({ status: "disconnected" });
      this.broadcastStatusUpdate();
    }, this.HEARTBEAT_TIMEOUT);
  }



  public updateStatus(info: Partial<ClientInfo>) {
    // 更新本地状态（保持向后兼容）
    this.updateClientInfo(info);

    // 如果 statusHandler 可用，也更新它的状态
    if (this.statusHandler) {
      if (info.status === "connected") {
        this.statusHandler.setClientConnected(
          info.mcpEndpoint || "",
          info.activeMCPServers || []
        );
      } else if (info.status === "disconnected") {
        this.statusHandler.setClientDisconnected();
      }
    }

    this.broadcastStatusUpdate();
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

    this.logger.info(`Web server listening on http://0.0.0.0:${this.port}`);
    this.logger.info(`Local access: http://localhost:${this.port}`);

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

      // Clear heartbeat timeout
      if (this.heartbeatTimeout) {
        clearTimeout(this.heartbeatTimeout);
        this.heartbeatTimeout = undefined;
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
}

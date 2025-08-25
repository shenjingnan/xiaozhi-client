import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { createServer } from "node:http";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
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
  private proxyMCPServer: ProxyMCPServer | undefined; // 保留用于向后兼容
  private xiaozhiConnectionManager: XiaozhiConnectionManager | undefined;
  private mcpServiceManager: MCPServiceManager | undefined;

  /**
   * 创建统一的错误响应
   */
  private createErrorResponse(code: string, message: string, details?: any): ApiErrorResponse {
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
   */
  private createSuccessResponse<T>(data?: T, message?: string): ApiSuccessResponse<T> {
    return {
      success: true,
      data,
      message,
    };
  }

  /**
   * 记录废弃功能使用警告
   */
  private logDeprecationWarning(feature: string, alternative: string): void {
    this.logger.warn(`[DEPRECATED] ${feature} 功能已废弃，请使用 ${alternative} 替代`);
  }

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
      const errorResponse = this.createErrorResponse(
        "INTERNAL_SERVER_ERROR",
        "服务器内部错误",
        process.env.NODE_ENV === "development" ? err.stack : undefined
      );
      return c.json(errorResponse, 500);
    });
  }

  private setupRoutes() {
    // API 路由
    this.app?.get("/api/config", async (c) => {
      try {
        const config = configManager.getConfig();
        this.logger.debug("HTTP API: 获取配置成功");
        return c.json(this.createSuccessResponse(config));
      } catch (error) {
        this.logger.error("HTTP API: 获取配置失败", error);
        const errorResponse = this.createErrorResponse(
          "CONFIG_READ_ERROR",
          error instanceof Error ? error.message : "获取配置失败"
        );
        return c.json(errorResponse, 500);
      }
    });

    this.app?.put("/api/config", async (c) => {
      try {
        const newConfig: AppConfig = await c.req.json();
        this.updateConfig(newConfig);

        // 广播配置更新
        this.broadcastConfigUpdate(newConfig);

        this.logger.info("HTTP API: 配置更新成功");
        return c.json(this.createSuccessResponse(null, "配置更新成功"));
      } catch (error) {
        this.logger.error("HTTP API: 配置更新失败", error);
        const errorResponse = this.createErrorResponse(
          "CONFIG_UPDATE_ERROR",
          error instanceof Error ? error.message : "配置更新失败"
        );
        return c.json(errorResponse, 400);
      }
    });

    this.app?.get("/api/status", async (c) => {
      try {
        const mcpStatus = this.proxyMCPServer?.getStatus();
        const statusData = {
          ...this.clientInfo,
          mcpConnection: mcpStatus,
        };
        this.logger.debug("HTTP API: 获取状态成功");
        return c.json(this.createSuccessResponse(statusData));
      } catch (error) {
        this.logger.error("HTTP API: 获取状态失败", error);
        const errorResponse = this.createErrorResponse(
          "STATUS_READ_ERROR",
          error instanceof Error ? error.message : "获取状态失败"
        );
        return c.json(errorResponse, 500);
      }
    });

    // 添加服务重启 API
    this.app?.post("/api/services/restart", async (c) => {
      try {
        this.logger.info("HTTP API: 收到服务重启请求");

        // 广播重启状态
        this.broadcastRestartStatus("restarting");

        // 异步执行重启，不阻塞响应
        setTimeout(async () => {
          try {
            await this.restartService();
            setTimeout(() => {
              this.broadcastRestartStatus("completed");
            }, 5000);
          } catch (error) {
            this.logger.error("HTTP API: 服务重启失败", error);
            this.broadcastRestartStatus(
              "failed",
              error instanceof Error ? error.message : "未知错误"
            );
          }
        }, 500);

        return c.json(this.createSuccessResponse(null, "重启请求已接收"));
      } catch (error) {
        this.logger.error("HTTP API: 处理重启请求失败", error);
        const errorResponse = this.createErrorResponse(
          "RESTART_REQUEST_ERROR",
          error instanceof Error ? error.message : "处理重启请求失败"
        );
        return c.json(errorResponse, 500);
      }
    });

    // 处理未知的 API 路由
    this.app?.all("/api/*", async (c) => {
      const errorResponse = this.createErrorResponse(
        "API_NOT_FOUND",
        `API 端点不存在: ${c.req.path}`
      );
      return c.json(errorResponse, 404);
    });

    // 静态文件服务 - 放在最后作为回退
    this.app.get("*", async (c) => {
      return this.serveStaticFile(c);
    });
  }

  private async serveStaticFile(c: any) {
    const pathname = new URL(c.req.url).pathname;
    try {
      // 获取当前文件所在目录
      const __dirname = dirname(fileURLToPath(import.meta.url));

      // 确定web目录路径
      const possibleWebPaths = [
        join(__dirname, "..", "web", "dist"), // 构建后的目录
        join(__dirname, "..", "web"), // 开发目录
        join(process.cwd(), "web", "dist"), // 当前工作目录
        join(process.cwd(), "web"),
      ];

      const webPath = possibleWebPaths.find((p) => existsSync(p));

      if (!webPath) {
        // 如果找不到 web 目录，返回简单的 HTML 页面
        const errorHtml = `
          <!DOCTYPE html>
          <html>
          <head>
            <title>小智配置管理</title>
            <meta charset="utf-8">
            <style>
              body { font-family: sans-serif; max-width: 800px; margin: 50px auto; padding: 20px; }
              .error { color: #e53e3e; background: #fed7d7; padding: 20px; border-radius: 8px; }
            </style>
          </head>
          <body>
            <h1>小智配置管理</h1>
            <div class="error">
              <p>错误：找不到前端资源文件。</p>
              <p>请先构建前端项目：</p>
              <pre>cd web && pnpm install && pnpm build</pre>
            </div>
          </body>
          </html>
        `;
        return c.html(errorHtml);
      }

      // 处理路径
      let filePath = pathname;
      if (filePath === "/") {
        filePath = "/index.html";
      }

      // 安全性检查：防止路径遍历
      if (filePath.includes("..")) {
        return c.text("Forbidden", 403);
      }

      const fullPath = join(webPath, filePath);

      // 检查文件是否存在
      if (!existsSync(fullPath)) {
        // 对于 SPA，返回 index.html
        const indexPath = join(webPath, "index.html");
        if (existsSync(indexPath)) {
          const content = await readFile(indexPath);
          return c.html(content.toString());
        }
        return c.text("Not Found", 404);
      }

      // 读取文件
      const content = await readFile(fullPath);

      // 设置正确的 Content-Type
      const ext = fullPath.split(".").pop()?.toLowerCase();
      const contentTypes: Record<string, string> = {
        html: "text/html",
        js: "application/javascript",
        css: "text/css",
        json: "application/json",
        png: "image/png",
        jpg: "image/jpeg",
        jpeg: "image/jpeg",
        gif: "image/gif",
        svg: "image/svg+xml",
        ico: "image/x-icon",
      };

      const contentType = contentTypes[ext || ""] || "application/octet-stream";

      // 对于文本文件，返回字符串；对于二进制文件，返回 ArrayBuffer
      if (
        contentType.startsWith("text/") ||
        contentType.includes("javascript") ||
        contentType.includes("json")
      ) {
        return c.text(content.toString(), 200, { "Content-Type": contentType });
      }
      return c.body(content, 200, { "Content-Type": contentType });
    } catch (error) {
      this.logger.error("Serve static file error:", error);
      return c.text("Internal Server Error", 500);
    }
  }

  private setupWebSocket() {
    if (!this.wss) return;

    this.wss.on("connection", (ws) => {
      this.logger.info("WebSocket 客户端已连接");
      this.logger.debug(`当前 WebSocket 连接数: ${this.wss?.clients.size || 0}`);

      ws.on("message", async (message) => {
        try {
          const data = JSON.parse(message.toString());
          await this.handleWebSocketMessage(ws, data);
        } catch (error) {
          this.logger.error("WebSocket message error:", error);
          const errorResponse = {
            type: "error",
            error: {
              code: "MESSAGE_PARSE_ERROR",
              message: error instanceof Error ? error.message : "消息解析失败",
              timestamp: Date.now()
            }
          };
          ws.send(JSON.stringify(errorResponse));
        }
      });

      ws.on("close", () => {
        this.logger.info("WebSocket 客户端已断开连接");
        this.logger.debug(`剩余 WebSocket 连接数: ${this.wss?.clients.size || 0}`);
      });

      ws.on("error", (error) => {
        this.logger.error("WebSocket 连接错误:", error);
      });

      this.sendInitialData(ws);
    });
  }

  /**
   * 处理 WebSocket 消息
   * @deprecated 部分消息类型已废弃，建议使用 HTTP API
   */
  private async handleWebSocketMessage(ws: any, data: any) {
    switch (data.type) {
      case "getConfig": {
        // @deprecated 使用 GET /api/config 替代
        this.logDeprecationWarning("WebSocket getConfig", "GET /api/config");

        try {
          const config = configManager.getConfig();
          this.logger.debug("WebSocket: getConfig 请求处理成功");
          ws.send(JSON.stringify({ type: "config", data: config }));
        } catch (error) {
          this.logger.error("WebSocket: getConfig 请求处理失败", error);
          ws.send(JSON.stringify({
            type: "error",
            error: {
              code: "CONFIG_READ_ERROR",
              message: error instanceof Error ? error.message : "获取配置失败"
            }
          }));
        }
        break;
      }

      case "updateConfig":
        // @deprecated 使用 PUT /api/config 替代
        this.logDeprecationWarning("WebSocket updateConfig", "PUT /api/config");

        try {
          this.updateConfig(data.config);
          this.broadcastConfigUpdate(data.config);
          this.logger.debug("WebSocket: updateConfig 请求处理成功");
        } catch (error) {
          this.logger.error("WebSocket: updateConfig 请求处理失败", error);
          ws.send(JSON.stringify({
            type: "error",
            error: {
              code: "CONFIG_UPDATE_ERROR",
              message: error instanceof Error ? error.message : "配置更新失败"
            }
          }));
        }
        break;

      case "getStatus":
        // @deprecated 使用 GET /api/status 替代
        this.logDeprecationWarning("WebSocket getStatus", "GET /api/status");

        try {
          ws.send(JSON.stringify({ type: "status", data: this.clientInfo }));
          this.logger.debug("WebSocket: getStatus 请求处理成功");
        } catch (error) {
          this.logger.error("WebSocket: getStatus 请求处理失败", error);
          ws.send(JSON.stringify({
            type: "error",
            error: {
              code: "STATUS_READ_ERROR",
              message: error instanceof Error ? error.message : "获取状态失败"
            }
          }));
        }
        break;

      case "clientStatus": {
        // 心跳检测和状态更新 - 保留此功能，这是 WebSocket 的核心职责
        try {
          this.updateClientInfo(data.data);
          this.broadcastStatusUpdate();
          // 每次客户端状态更新时，也发送最新的配置
          const latestConfig = configManager.getConfig();
          ws.send(JSON.stringify({ type: "configUpdate", data: latestConfig }));
          this.logger.debug("WebSocket: clientStatus 更新成功");
        } catch (error) {
          this.logger.error("WebSocket: clientStatus 更新失败", error);
          ws.send(JSON.stringify({
            type: "error",
            error: {
              code: "CLIENT_STATUS_ERROR",
              message: error instanceof Error ? error.message : "客户端状态更新失败"
            }
          }));
        }
        break;
      }

      case "restartService":
        // @deprecated 使用 POST /api/services/restart 替代
        this.logDeprecationWarning("WebSocket restartService", "POST /api/services/restart");

        try {
          this.logger.info("WebSocket: 收到服务重启请求");
          this.broadcastRestartStatus("restarting");

          // 延迟执行重启
          setTimeout(async () => {
            try {
              await this.restartService();
              // 服务重启需要一些时间，延迟发送成功状态
              setTimeout(() => {
                this.broadcastRestartStatus("completed");
              }, 5000);
            } catch (error) {
              this.logger.error("WebSocket: 服务重启失败", error);
              this.broadcastRestartStatus(
                "failed",
                error instanceof Error ? error.message : "未知错误"
              );
            }
          }, 500);
        } catch (error) {
          this.logger.error("WebSocket: 处理重启请求失败", error);
          ws.send(JSON.stringify({
            type: "error",
            error: {
              code: "RESTART_REQUEST_ERROR",
              message: error instanceof Error ? error.message : "处理重启请求失败"
            }
          }));
        }
        break;

      default:
        this.logger.warn(`WebSocket: 未知的消息类型: ${data.type}`);
        ws.send(JSON.stringify({
          type: "error",
          error: {
            code: "UNKNOWN_MESSAGE_TYPE",
            message: `未知的消息类型: ${data.type}`
          }
        }));
    }
  }

  private async sendInitialData(ws: any) {
    const config = configManager.getConfig();
    ws.send(JSON.stringify({ type: "config", data: config }));
    ws.send(JSON.stringify({ type: "status", data: this.clientInfo }));

    // 延迟发送配置更新，确保 MCP Server Proxy 有足够时间完成工具列表更新
    setTimeout(() => {
      const updatedConfig = configManager.getConfig();
      ws.send(JSON.stringify({ type: "configUpdate", data: updatedConfig }));
    }, 2000); // 2秒延迟
  }

  public broadcastConfigUpdate(config: AppConfig) {
    if (!this.wss) return;

    const message = JSON.stringify({ type: "configUpdate", data: config });
    for (const client of this.wss.clients) {
      if (client.readyState === 1) {
        client.send(message);
      }
    }
  }

  private broadcastRestartStatus(
    status: "restarting" | "completed" | "failed",
    error?: string
  ) {
    if (!this.wss) return;

    const message = JSON.stringify({
      type: "restartStatus",
      data: {
        status,
        error,
        timestamp: Date.now(),
      },
    });
    for (const client of this.wss.clients) {
      if (client.readyState === 1) {
        client.send(message);
      }
    }
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

  private updateConfig(newConfig: AppConfig) {
    // 更新 MCP 端点
    if (newConfig.mcpEndpoint !== configManager.getMcpEndpoint()) {
      configManager.updateMcpEndpoint(newConfig.mcpEndpoint);
    }

    // 更新 MCP 服务
    const currentServers = configManager.getMcpServers();
    for (const [name, config] of Object.entries(newConfig.mcpServers)) {
      if (JSON.stringify(currentServers[name]) !== JSON.stringify(config)) {
        configManager.updateMcpServer(name, config);
      }
    }

    // 删除不存在的服务
    for (const name of Object.keys(currentServers)) {
      if (!(name in newConfig.mcpServers)) {
        configManager.removeMcpServer(name);

        // 同时清理该服务在 mcpServerConfig 中的工具配置
        configManager.removeServerToolsConfig(name);
      }
    }

    // 更新连接配置
    if (newConfig.connection) {
      configManager.updateConnectionConfig(newConfig.connection);
    }

    // 更新 ModelScope 配置
    if (newConfig.modelscope) {
      configManager.updateModelScopeConfig(newConfig.modelscope);
    }

    // 更新 Web UI 配置
    if (newConfig.webUI) {
      configManager.updateWebUIConfig(newConfig.webUI);
    }

    // 更新服务工具配置
    if (newConfig.mcpServerConfig) {
      for (const [serverName, toolsConfig] of Object.entries(
        newConfig.mcpServerConfig
      )) {
        for (const [toolName, toolConfig] of Object.entries(
          toolsConfig.tools
        )) {
          configManager.setToolEnabled(serverName, toolName, toolConfig.enable);
          // 注释：configManager 不支持直接设置工具描述，描述作为工具配置的一部分保存
        }
      }
    }
  }

  private async restartService(): Promise<void> {
    this.logger.info("正在重启 MCP 服务...");

    // 清除心跳超时定时器，避免重启过程中误报断开连接
    if (this.heartbeatTimeout) {
      clearTimeout(this.heartbeatTimeout);
      this.heartbeatTimeout = undefined;
    }

    try {
      // 获取当前服务状态
      const container = await createContainer();
      const serviceManager = container.get("serviceManager") as any;
      const status = await serviceManager.getStatus();
      if (!status.running) {
        this.logger.warn("MCP 服务未运行，尝试启动服务");

        // 如果服务未运行，尝试启动服务
        const startArgs = ["start", "--daemon"];
        const child = spawn("xiaozhi", startArgs, {
          detached: true,
          stdio: "ignore",
          env: {
            ...process.env,
            XIAOZHI_CONFIG_DIR: process.env.XIAOZHI_CONFIG_DIR || process.cwd(),
          },
        });
        child.unref();
        this.logger.info("MCP 服务启动命令已发送");
        return;
      }

      // 获取服务运行模式
      const isDaemon = status.mode === "daemon";

      // 执行重启命令
      const restartArgs = ["restart"];
      if (isDaemon) {
        restartArgs.push("--daemon");
      }

      // 在子进程中执行重启命令
      const child = spawn("xiaozhi", restartArgs, {
        detached: true,
        stdio: "ignore",
        env: {
          ...process.env,
          XIAOZHI_CONFIG_DIR: process.env.XIAOZHI_CONFIG_DIR || process.cwd(),
        },
      });

      child.unref();

      this.logger.info("MCP 服务重启命令已发送");

      // 重启后重新设置心跳超时
      this.resetHeartbeatTimeout();
    } catch (error) {
      this.logger.error(
        `重启服务失败: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
      // 失败时也要重新设置心跳超时
      this.resetHeartbeatTimeout();
      throw error;
    }
  }

  public updateStatus(info: Partial<ClientInfo>) {
    this.updateClientInfo(info);
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

    // 输出架构重构信息
    this.logger.info("=== 通信架构重构信息 ===");
    this.logger.info("HTTP API 职责: 配置管理、状态查询、服务控制");
    this.logger.info("WebSocket 职责: 实时通知、心跳检测、事件广播");
    this.logger.info("已废弃的 WebSocket 消息: getConfig, updateConfig, getStatus, restartService");
    this.logger.info("推荐使用对应的 HTTP API 替代废弃的 WebSocket 消息");
    this.logger.info("========================");

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

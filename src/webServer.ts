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
import { getServiceStatus } from "./cli.js";
import { configManager } from "./configManager.js";
import type { AppConfig } from "./configManager.js";
import { Logger } from "./logger.js";
import { ProxyMCPServer, type Tool } from "./proxyMCPServer.js";
import { MCPTransportType } from "./services/MCPService.js";
import type { MCPServiceManager } from "./services/MCPServiceManager.js";
import { MCPServiceManagerSingleton } from "./services/mcpServiceManagerSingleton.js";

const DEFAULT_MCP_SERVERS = {
  calculator: {
    name: "calculator",
    type: MCPTransportType.STDIO,
    command: "node",
    args: [
      "/Users/nemo/github/shenjingnan/xiaozhi-client/templates/hello-world/mcpServers/calculator.js",
    ],
  },
  datetime: {
    name: "datetime",
    type: MCPTransportType.STDIO,
    command: "node",
    args: [
      "/Users/nemo/github/shenjingnan/xiaozhi-client/templates/hello-world/mcpServers/datetime.js",
    ],
  },
};

// 默认工具集合
const MOCK_TOOLS: Tool[] = [
  {
    name: "calculator_add",
    description: "简单的加法计算器",
    inputSchema: {
      type: "object",
      properties: {
        a: { type: "number", description: "第一个数字" },
        b: { type: "number", description: "第二个数字" },
      },
      required: ["a", "b"],
    },
  },
  {
    name: "weather_get",
    description: "获取天气信息",
    inputSchema: {
      type: "object",
      properties: {
        city: { type: "string", description: "城市名称" },
      },
      required: ["city"],
    },
  },
];
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
  private proxyMCPServer: ProxyMCPServer;
  private mcpServiceManager: MCPServiceManager | undefined;

  constructor(port?: number) {
    // 如果没有指定端口，从配置文件获取
    if (port === undefined) {
      try {
        this.port = configManager.getWebUIPort();
      } catch (error) {
        // 如果配置文件不存在或读取失败，使用默认端口
        this.port = 9999;
      }
    } else {
      this.port = port;
    }
    this.logger = new Logger();
    MCPServiceManagerSingleton.getInstance().then((mcpServiceManager) => {
      this.mcpServiceManager = mcpServiceManager;
      this.mcpServiceManager.addServiceConfig(
        "calculator",
        DEFAULT_MCP_SERVERS.calculator
      );
      this.mcpServiceManager.addServiceConfig(
        "datetime",
        DEFAULT_MCP_SERVERS.datetime
      );
      this.mcpServiceManager.startAllServices().then(() => {
        const tools = this.mcpServiceManager?.getAllTools();
        console.log("tools", tools);
      });
    });
    // 初始化 MCP 客户端
    const endpointUrl =
      "wss://api.xiaozhi.me/mcp/?token=eyJhbGciOiJFUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjMwMjcyMCwiYWdlbnRJZCI6NDgwMjU2LCJlbmRwb2ludElkIjoiYWdlbnRfNDgwMjU2IiwicHVycG9zZSI6Im1jcC1lbmRwb2ludCIsImlhdCI6MTc1NDg5MTkyMn0.GjjPD8J31faYDJKymp-e1zJB3miE_nwd00zMLRFfNzZmmE-ale0_2Ppa-dWwRPt6HQ1DHyKSQM_3wh-55KEewg";
    this.proxyMCPServer = new ProxyMCPServer(endpointUrl);
    this.proxyMCPServer.addTool(MOCK_TOOLS[0].name, MOCK_TOOLS[0]);

    // 初始化 Hono 应用
    this.app = new Hono();
    this.setupMiddleware();
    this.setupRoutes();

    // HTTP 服务器和 WebSocket 服务器将在 start() 方法中初始化
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
    // API 路由
    this.app?.get("/api/config", async (c) => {
      const config = configManager.getConfig();
      return c.json(config);
    });

    this.app?.put("/api/config", async (c) => {
      try {
        const newConfig: AppConfig = await c.req.json();
        this.updateConfig(newConfig);

        // 广播配置更新
        this.broadcastConfigUpdate(newConfig);

        // 直接返回成功，不再自动重启
        this.logger.info("配置已更新");
        return c.json({ success: true });
      } catch (error) {
        return c.json(
          {
            error: error instanceof Error ? error.message : String(error),
          },
          400
        );
      }
    });

    this.app?.get("/api/status", async (c) => {
      const mcpStatus = this.proxyMCPServer.getStatus();
      return c.json({
        ...this.clientInfo,
        mcpConnection: mcpStatus,
      });
    });

    // 处理未知的 API 路由
    this.app?.all("/api/*", async (c) => {
      return c.text("Not Found", 404);
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
      // 只在调试模式下输出连接日志
      this.logger.debug("WebSocket client connected");

      ws.on("message", async (message) => {
        try {
          const data = JSON.parse(message.toString());
          await this.handleWebSocketMessage(ws, data);
        } catch (error) {
          this.logger.error("WebSocket message error:", error);
          ws.send(
            JSON.stringify({
              type: "error",
              error: error instanceof Error ? error.message : String(error),
            })
          );
        }
      });

      ws.on("close", () => {
        // 只在调试模式下输出断开日志
        this.logger.debug("WebSocket client disconnected");
      });

      this.sendInitialData(ws);
    });
  }

  private async handleWebSocketMessage(ws: any, data: any) {
    switch (data.type) {
      case "getConfig": {
        const config = configManager.getConfig();
        this.logger.debug("getConfig ws getConfig", config);
        ws.send(JSON.stringify({ type: "config", data: config }));
        break;
      }

      case "updateConfig":
        this.updateConfig(data.config);
        this.broadcastConfigUpdate(data.config);
        break;

      case "getStatus":
        ws.send(JSON.stringify({ type: "status", data: this.clientInfo }));
        break;

      case "clientStatus": {
        this.updateClientInfo(data.data);
        this.broadcastStatusUpdate();
        // 每次客户端状态更新时，也发送最新的配置
        const latestConfig = configManager.getConfig();
        ws.send(JSON.stringify({ type: "configUpdate", data: latestConfig }));
        break;
      }

      case "restartService":
        // 处理手动重启请求
        this.logger.info("收到手动重启服务请求");
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
            this.logger.error(
              `手动重启失败: ${
                error instanceof Error ? error.message : String(error)
              }`
            );
            this.broadcastRestartStatus(
              "failed",
              error instanceof Error ? error.message : "未知错误"
            );
          }
        }, 500);
        break;
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
      const status = getServiceStatus();
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
    // 使用 @hono/node-server 启动服务器，绑定到 0.0.0.0
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

    // 启动 MCP 客户端连接
    try {
      await this.proxyMCPServer.connect();
      this.logger.info("MCP 客户端连接成功");
    } catch (error) {
      this.logger.error("MCP 客户端连接失败:", error);
      // MCP 连接失败不影响 Web 服务器启动
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
      this.proxyMCPServer.disconnect();

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

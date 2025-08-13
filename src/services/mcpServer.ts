import { randomUUID } from "node:crypto";
import { EventEmitter } from "node:events";
import type { Server } from "node:http";
import express from "express";
import { ProxyMCPServer } from "../ProxyMCPServer.js";
import { configManager } from "../configManager.js";
import { logger as globalLogger } from "../logger.js";
import { MCPServiceManager } from "./MCPServiceManager.js";
import { MCPMessageHandler } from "../core/MCPMessageHandler.js";

const logger = globalLogger.withTag("mcp-server");

interface SSEClient {
  id: string;
  sessionId: string;
  response: express.Response;
}

export class MCPServer extends EventEmitter {
  private app: express.Application;
  private server: Server | null = null;
  private clients: Map<string, SSEClient> = new Map();
  private proxyMCPServer: ProxyMCPServer | null = null;
  private mcpServiceManager: MCPServiceManager;
  private messageHandler: MCPMessageHandler;
  private port: number;

  constructor(port = 3000) {
    super();
    this.port = port;
    this.app = express();

    // 初始化 MCPServiceManager 和 MessageHandler
    this.mcpServiceManager = new MCPServiceManager();
    this.messageHandler = new MCPMessageHandler(this.mcpServiceManager);

    this.setupMiddleware();
    this.setupRoutes();
  }

  private setupMiddleware(): void {
    this.app.use(express.json());
    this.app.use(express.urlencoded({ extended: true }));

    // 为MCP客户端设置CORS
    this.app.use((req, res, next) => {
      res.header("Access-Control-Allow-Origin", "*");
      res.header("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
      res.header("Access-Control-Allow-Headers", "Content-Type, Accept");
      res.header("Cache-Control", "no-cache");
      next();
    });
  }

  private setupRoutes(): void {
    // MCP协议的SSE端点
    this.app.get("/sse", (req, res) => {
      const clientId = Date.now().toString();
      const sessionId = randomUUID();

      // 设置SSE头部（匹配SDK实现）
      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache, no-transform");
      res.setHeader("Connection", "keep-alive");
      res.setHeader("X-Accel-Buffering", "no");

      // 使用sessionId注册客户端
      this.clients.set(sessionId, { id: clientId, sessionId, response: res });
      logger.info(`MCP客户端已连接: ${clientId} (会话: ${sessionId})`);

      // 首先发送端点事件（SDK标准）
      res.write(`event: endpoint\ndata: /messages?sessionId=${sessionId}\n\n`);

      // 处理客户端断开连接
      req.on("close", () => {
        this.clients.delete(sessionId);
        logger.info(`MCP客户端已断开连接: ${clientId} (会话: ${sessionId})`);
      });
    });

    // SSE传输的消息端点（MCP SDK标准）
    this.app.post("/messages", async (req, res) => {
      try {
        const sessionId = req.query.sessionId as string;
        const message = req.body;

        logger.info(
          `通过SSE传输收到消息 (会话: ${sessionId}):`,
          JSON.stringify(message)
        );

        if (!sessionId || !this.clients.has(sessionId)) {
          res.status(400).json({
            jsonrpc: "2.0",
            error: {
              code: -32600,
              message: "无效或缺少sessionId",
            },
            id: message.id,
          });
          return;
        }

        // 使用新的统一消息处理器
        const response = await this.messageHandler.handleMessage(message);
        logger.debug('消息处理响应:', response);

        // 通过SSE将响应发送到特定客户端
        const client = this.clients.get(sessionId);
        if (client) {
          this.sendToClient(client, response);
        }

        // 发送202 Accepted以确认收到（SDK标准）
        res.status(202).send();
      } catch (error) {
        logger.error("SSE消息错误:", error);
        res.status(500).json({
          jsonrpc: "2.0",
          error: {
            code: -32603,
            message: error instanceof Error ? error.message : "内部错误",
          },
          id: req.body.id,
        });
      }
    });

    // 用于直接RPC通信的JSON-RPC端点
    this.app.post("/rpc", async (req, res) => {
      try {
        const message = req.body;
        logger.debug("收到RPC消息:", message);

        // 使用新的统一消息处理器
        const response = await this.messageHandler.handleMessage(message);
        res.json(response);
      } catch (error) {
        logger.error("RPC错误:", error);
        res.status(500).json({
          jsonrpc: "2.0",
          error: {
            code: -32603,
            message: error instanceof Error ? error.message : "内部错误",
          },
          id: req.body.id,
        });
      }
    });

    // 状态端点
    this.app.get("/status", (req, res) => {
      res.json({
        status: "ok",
        mode: "mcp-server",
        serviceManager: "running",
        clients: this.clients.size,
        tools: this.mcpServiceManager.getAllTools().length,
      });
    });

    // 健康检查
    this.app.get("/health", (req, res) => {
      res.json({
        status: "ok",
        mode: "mcp-server",
        serviceManager: "running",
        clients: this.clients.size,
        tools: this.mcpServiceManager.getAllTools().length,
      });
    });
  }

  private sendToClient(client: SSEClient, message: any): void {
    try {
      // 使用事件：消息格式（SDK标准）
      const data = `event: message\ndata: ${JSON.stringify(message)}\n\n`;
      client.response.write(data);
    } catch (error) {
      logger.error(`发送到客户端 ${client.id} 失败:`, error);
      this.clients.delete(client.sessionId);
    }
  }

  private broadcastToClients(message: any): void {
    for (const client of this.clients.values()) {
      this.sendToClient(client, message);
    }
  }

  public async start(): Promise<void> {
    try {
      // 初始化 MCPServiceManager
      await this.mcpServiceManager.startAllServices();

      // 启动HTTP服务器
      await new Promise<void>((resolve, reject) => {
        this.server = this.app.listen(this.port, "0.0.0.0", () => {
          logger.info(`MCP服务器监听端口 ${this.port} (所有网络接口)`);
          logger.info(`SSE端点: http://0.0.0.0:${this.port}/sse`);
          logger.info(`消息端点: http://0.0.0.0:${this.port}/messages`);
          logger.info(`RPC端点: http://0.0.0.0:${this.port}/rpc`);
          logger.info(`状态端点: http://0.0.0.0:${this.port}/status`);
          logger.info(`本地访问: http://localhost:${this.port}`);
          resolve();
        });

        this.server?.on("error", reject);
      });

      // 启动MCP客户端连接到xiaozhi.me（不要阻塞服务器启动）
      this.startMCPClient().catch((error) => {
        logger.error("启动连接到xiaozhi.me的MCP客户端失败:", error);
      });

      this.emit("started");
    } catch (error) {
      logger.error("启动MCP服务器失败:", error);
      throw error;
    }
  }

  private async startMCPClient(): Promise<void> {
    try {
      // 获取小智接入点配置
      let mcpEndpoint: string | null = null;
      try {
        if (configManager.configExists()) {
          const endpoints = configManager.getMcpEndpoints();
          mcpEndpoint =
            endpoints.find((ep) => ep && !ep.includes("<请填写")) || null;
        }
      } catch (error) {
        logger.warn("从配置中读取小智接入点失败:", error);
      }

      // 只有在配置了有效端点时才启动连接
      if (mcpEndpoint) {
        this.proxyMCPServer = new ProxyMCPServer(mcpEndpoint);
        this.proxyMCPServer.setServiceManager(this.mcpServiceManager);

        await this.proxyMCPServer.connect();
        logger.info("小智接入点连接成功");
      } else {
        logger.info("未配置有效的小智接入点，跳过连接");
      }
    } catch (error) {
      logger.error("启动MCP客户端失败:", error);
    }
  }

  public async stop(): Promise<void> {
    logger.info("正在停止MCP服务器...");

    // 关闭所有SSE连接
    for (const client of this.clients.values()) {
      try {
        client.response.end();
      } catch (error) {
        // 忽略关闭时的错误
      }
    }
    this.clients.clear();

    // 停止HTTP服务器
    if (this.server) {
      await new Promise<void>((resolve) => {
        this.server!.close(() => resolve());
      });
      this.server = null;
    }

    // 停止小智接入点连接
    if (this.proxyMCPServer) {
      await this.proxyMCPServer.disconnect();
      this.proxyMCPServer = null;
    }

    // 停止 MCP 服务管理器
    await this.mcpServiceManager.stopAllServices();

    this.emit("stopped");
    logger.info("MCP服务器已停止");
  }

  /**
   * 获取 MCPServiceManager 实例（用于测试）
   */
  getServiceManager(): MCPServiceManager {
    return this.mcpServiceManager;
  }

  /**
   * 获取 MCPMessageHandler 实例（用于测试）
   */
  getMessageHandler(): MCPMessageHandler {
    return this.messageHandler;
  }
}

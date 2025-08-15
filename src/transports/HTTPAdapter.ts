/**
 * HTTP 传输适配器
 * 处理 HTTP 和 SSE (Server-Sent Events) 的 MCP 通信
 * 从 mcpServer.ts 中抽取的 HTTP/SSE 处理逻辑
 */

import { randomUUID } from "node:crypto";
import type { Server } from "node:http";
import express from "express";
import type { Request, Response } from "express";
import type { MCPMessageHandler } from "../core/MCPMessageHandler.js";
import { ConnectionState, TransportAdapter } from "./TransportAdapter.js";
import type {
  MCPMessage,
  MCPResponse,
  TransportConfig,
} from "./TransportAdapter.js";

/**
 * SSE 客户端接口
 */
interface SSEClient {
  id: string;
  sessionId: string;
  response: Response;
  connectedAt: Date;
}

/**
 * HTTP 适配器配置
 */
export interface HTTPConfig extends TransportConfig {
  port?: number;
  host?: string;
  enableSSE?: boolean;
  enableRPC?: boolean;
  corsOrigin?: string;
  maxClients?: number;
}

/**
 * HTTP 传输适配器实现
 * 支持直接 HTTP RPC 调用和 SSE 流式通信
 */
export class HTTPAdapter extends TransportAdapter {
  private app: express.Application;
  private server: Server | null = null;
  private clients: Map<string, SSEClient> = new Map();
  private port: number;
  private host: string;
  private enableSSE: boolean;
  private enableRPC: boolean;
  private corsOrigin: string;
  private maxClients: number;

  constructor(
    messageHandler: MCPMessageHandler,
    config: HTTPConfig = { name: "http" }
  ) {
    super(messageHandler, config);

    this.port = config.port || 3000;
    this.host = config.host || "0.0.0.0";
    this.enableSSE = config.enableSSE !== false; // 默认启用
    this.enableRPC = config.enableRPC !== false; // 默认启用
    this.corsOrigin = config.corsOrigin || "*";
    this.maxClients = config.maxClients !== undefined ? config.maxClients : 100;

    this.app = express();
    this.setupMiddleware();
  }

  /**
   * 初始化 HTTP 适配器
   */
  async initialize(): Promise<void> {
    this.logger.info("初始化 HTTP 适配器");

    try {
      this.setupRoutes();
      this.setState(ConnectionState.CONNECTING);
      this.logger.info("HTTP 适配器初始化完成");
    } catch (error) {
      this.logger.error("HTTP 适配器初始化失败", error);
      this.setState(ConnectionState.ERROR);
      throw error;
    }
  }

  /**
   * 启动 HTTP 服务器
   */
  async start(): Promise<void> {
    if (this.server) {
      this.logger.warn("HTTP 服务器已在运行");
      return;
    }

    this.logger.info(`启动 HTTP 服务器在 ${this.host}:${this.port}`);

    return new Promise((resolve, reject) => {
      this.server = this.app.listen(this.port, this.host, () => {
        this.setState(ConnectionState.CONNECTED);
        this.logger.info("HTTP 适配器启动成功");
        this.logger.info(`- RPC 端点: http://${this.host}:${this.port}/rpc`);
        if (this.enableSSE) {
          this.logger.info(`- SSE 端点: http://${this.host}:${this.port}/sse`);
          this.logger.info(
            `- 消息端点: http://${this.host}:${this.port}/messages`
          );
        }
        resolve();
      });

      this.server?.on("error", (error) => {
        this.logger.error("HTTP 服务器错误", error);
        this.setState(ConnectionState.ERROR);
        reject(error);
      });
    });
  }

  /**
   * 停止 HTTP 服务器
   */
  async stop(): Promise<void> {
    if (!this.server) {
      return;
    }

    this.logger.info("停止 HTTP 服务器");

    return new Promise((resolve) => {
      // 关闭所有 SSE 连接
      for (const client of this.clients.values()) {
        client.response.end();
      }
      this.clients.clear();

      this.server!.close(() => {
        this.server = null;
        this.setState(ConnectionState.DISCONNECTED);
        this.logger.info("HTTP 服务器已停止");
        resolve();
      });
    });
  }

  /**
   * 发送消息（对于 HTTP 适配器，这个方法主要用于 SSE）
   */
  async sendMessage(message: MCPMessage | MCPResponse): Promise<void> {
    // HTTP 适配器的消息发送主要通过 HTTP 响应或 SSE 推送
    // 这里实现 SSE 广播功能
    if (this.clients.size > 0) {
      this.broadcastToClients(message);
    }
  }

  /**
   * 设置中间件
   */
  private setupMiddleware(): void {
    // 解析 JSON 请求体
    this.app.use(express.json({ limit: "10mb" }));
    this.app.use(express.urlencoded({ extended: true }));

    // 设置 CORS
    this.app.use((req, res, next) => {
      res.header("Access-Control-Allow-Origin", this.corsOrigin);
      res.header("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
      res.header("Access-Control-Allow-Headers", "Content-Type, Accept");
      res.header("Cache-Control", "no-cache");
      next();
    });

    // 请求日志
    this.app.use((req, res, next) => {
      this.logger.debug(`${req.method} ${req.path}`, {
        query: req.query,
        headers: req.headers,
      });
      next();
    });
  }

  /**
   * 设置路由
   */
  private setupRoutes(): void {
    // SSE 端点
    if (this.enableSSE) {
      this.app.get("/sse", this.handleSSE.bind(this));
      this.app.post("/messages", this.handleMessages.bind(this));
    }

    // RPC 端点
    if (this.enableRPC) {
      this.app.post("/rpc", this.handleRPC.bind(this));
    }

    // 状态端点
    this.app.get("/status", this.handleStatus.bind(this));

    // 健康检查端点
    this.app.get("/health", this.handleHealth.bind(this));
  }

  /**
   * 处理 SSE 连接
   */
  private handleSSE(req: Request, res: Response): void {
    // 检查客户端数量限制
    if (this.clients.size >= this.maxClients) {
      res.status(503).json({
        error: "服务器繁忙，客户端连接数已达上限",
        maxClients: this.maxClients,
      });
      return;
    }

    const clientId = Date.now().toString();
    const sessionId = randomUUID();

    // 设置 SSE 头部
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");

    // 注册客户端
    const client: SSEClient = {
      id: clientId,
      sessionId,
      response: res,
      connectedAt: new Date(),
    };

    this.clients.set(sessionId, client);
    this.logger.info(`SSE 客户端已连接: ${clientId} (会话: ${sessionId})`);

    // 发送端点事件（MCP SDK 标准）
    res.write(`event: endpoint\ndata: /messages?sessionId=${sessionId}\n\n`);

    // 处理客户端断开连接
    req.on("close", () => {
      this.clients.delete(sessionId);
      this.logger.info(
        `SSE 客户端已断开连接: ${clientId} (会话: ${sessionId})`
      );
    });

    // 处理连接错误
    req.on("error", (error) => {
      this.logger.error(`SSE 客户端连接错误: ${clientId}`, error);
      this.clients.delete(sessionId);
    });
  }

  /**
   * 处理 SSE 消息
   */
  private async handleMessages(req: Request, res: Response): Promise<void> {
    try {
      const sessionId = req.query.sessionId as string;
      const message = req.body;

      this.logger.debug(`收到 SSE 消息 (会话: ${sessionId}):`, message);

      if (!sessionId || !this.clients.has(sessionId)) {
        res.status(400).json({
          jsonrpc: "2.0",
          error: {
            code: -32600,
            message: "无效或缺少 sessionId",
          },
          id: message.id,
        });
        return;
      }

      // 处理消息
      const response = await this.messageHandler.handleMessage(message);
      this.logger.debug("SSE 消息处理响应:", response);

      // 通过 SSE 发送响应
      const client = this.clients.get(sessionId);
      if (client) {
        this.sendToClient(client, response);
      }

      // 发送 202 Accepted 确认
      res.status(202).send();
    } catch (error) {
      this.logger.error("处理 SSE 消息时出错", error);
      res.status(500).json({
        jsonrpc: "2.0",
        error: {
          code: -32603,
          message: (error as Error).message,
        },
      });
    }
  }

  /**
   * 处理 RPC 请求
   */
  private async handleRPC(req: Request, res: Response): Promise<void> {
    try {
      const message = req.body;
      this.logger.debug("收到 RPC 消息:", message);

      // 处理消息
      const response = await this.messageHandler.handleMessage(message);
      res.json(response);
    } catch (error) {
      this.logger.error("处理 RPC 消息时出错", error);
      res.status(500).json({
        jsonrpc: "2.0",
        error: {
          code: -32603,
          message: (error as Error).message,
        },
        id: req.body?.id || null,
      });
    }
  }

  /**
   * 处理状态请求
   */
  private handleStatus(req: Request, res: Response): void {
    res.json({
      status: "ok",
      mode: "mcp-server", // 从用户角度看，这是 MCP 服务器的状态
      serviceManager: "running", // 添加服务管理器状态
      clients: this.clients.size,
      tools: 0, // 工具数量，这里先设为0，后续可以从消息处理器获取
      maxClients: this.maxClients,
      enableSSE: this.enableSSE,
      enableRPC: this.enableRPC,
      uptime: process.uptime(),
    });
  }

  /**
   * 处理健康检查
   */
  private handleHealth(req: Request, res: Response): void {
    res.json({
      status: "ok",
      mode: "mcp-server", // 从用户角度看，这是 MCP 服务器的健康状态
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * 向特定客户端发送消息
   */
  private sendToClient(
    client: SSEClient,
    message: MCPMessage | MCPResponse
  ): void {
    try {
      const data = this.serializeMessage(message);
      client.response.write(`data: ${data}\n\n`);

      this.logger.debug(`消息已发送到客户端 ${client.id}`, {
        sessionId: client.sessionId,
        messageId: message.id,
      });
    } catch (error) {
      this.logger.error(`向客户端 ${client.id} 发送消息失败`, error);
      // 移除有问题的客户端
      this.clients.delete(client.sessionId);
    }
  }

  /**
   * 广播消息到所有客户端
   */
  private broadcastToClients(message: MCPMessage | MCPResponse): void {
    for (const client of this.clients.values()) {
      this.sendToClient(client, message);
    }
  }

  /**
   * 获取适配器状态
   */
  getStatus(): {
    isRunning: boolean;
    port: number;
    host: string;
    clientCount: number;
    maxClients: number;
    enableSSE: boolean;
    enableRPC: boolean;
    connectionId: string;
    state: ConnectionState;
  } {
    return {
      isRunning: this.server !== null,
      port: this.port,
      host: this.host,
      clientCount: this.clients.size,
      maxClients: this.maxClients,
      enableSSE: this.enableSSE,
      enableRPC: this.enableRPC,
      connectionId: this.connectionId,
      state: this.state,
    };
  }

  /**
   * 获取连接的客户端列表
   */
  getClients(): Array<{
    id: string;
    sessionId: string;
    connectedAt: Date;
  }> {
    return Array.from(this.clients.values()).map((client) => ({
      id: client.id,
      sessionId: client.sessionId,
      connectedAt: client.connectedAt,
    }));
  }
}

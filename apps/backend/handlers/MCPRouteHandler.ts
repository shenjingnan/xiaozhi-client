/**
 * MCP 路由处理器
 * 处理符合 MCP Streamable HTTP 规范的单一 /mcp 端点
 * 支持 POST 请求（JSON-RPC 消息）和 GET 请求（SSE 连接）
 */

import { randomUUID } from "node:crypto";
import { MCPMessageHandler } from "@core/MCPMessageHandler.js";
import type { Logger } from "@root/Logger.js";
import { logger } from "@root/Logger.js";
import type { MCPMessage, MCPResponse } from "@root/types/mcp.js";
import type { AppContext } from "@root/types/hono.context.js";
import type { Context } from "hono";

/**
 * SSE 客户端接口
 */
interface SSEClient {
  id: string;
  sessionId: string;
  response: Response;
  connectedAt: Date;
  lastActivity: Date;
  writer?: WritableStreamDefaultWriter<Uint8Array>;
  abortController?: AbortController;
  heartbeatInterval?: NodeJS.Timeout;
  isAlive: boolean;
  messageCount: number;
  userAgent?: string;
  remoteAddress?: string;
}

/**
 * MCP 路由处理器配置接口
 */
interface MCPRouteHandlerConfig {
  maxClients?: number;
  connectionTimeout?: number;
  heartbeatInterval?: number;
  maxMessageSize?: number;
  enableMetrics?: boolean;
}

/**
 * 连接统计信息
 */
interface ConnectionMetrics {
  totalConnections: number;
  activeConnections: number;
  totalMessages: number;
  errorCount: number;
  averageResponseTime: number;
  uptime: number;
}

/**
 * MCP 路由处理器
 * 实现符合 MCP Streamable HTTP 规范的单一端点处理
 */
export class MCPRouteHandler {
  private logger: Logger;
  private mcpMessageHandler: MCPMessageHandler | null = null;
  private clients: Map<string, SSEClient> = new Map();
  private config: Required<MCPRouteHandlerConfig>;
  private metrics: ConnectionMetrics;
  private cleanupInterval: NodeJS.Timeout | null = null;
  private startTime: Date;

  constructor(config: MCPRouteHandlerConfig = {}) {
    this.logger = logger.withTag("MCPRouteHandler");
    this.config = {
      maxClients: config.maxClients ?? 100,
      connectionTimeout: config.connectionTimeout ?? 300000, // 5分钟
      heartbeatInterval: config.heartbeatInterval ?? 30000, // 30秒
      maxMessageSize: config.maxMessageSize ?? 1024 * 1024, // 1MB
      enableMetrics: config.enableMetrics ?? true,
    };

    this.metrics = {
      totalConnections: 0,
      activeConnections: 0,
      totalMessages: 0,
      errorCount: 0,
      averageResponseTime: 0,
      uptime: 0,
    };

    this.startTime = new Date();

    // 启动清理任务
    this.startCleanupTask();

    this.logger.debug("MCPRouteHandler 初始化完成", {
      maxClients: this.config.maxClients,
      connectionTimeout: this.config.connectionTimeout,
      heartbeatInterval: this.config.heartbeatInterval,
    });
  }

  /**
   * 启动清理任务
   */
  private startCleanupTask(): void {
    this.cleanupInterval = setInterval(() => {
      this.cleanupStaleConnections();
      this.updateMetrics();
    }, 60000); // 每分钟执行一次清理
  }

  /**
   * 停止清理任务
   */
  private stopCleanupTask(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }

  /**
   * 清理过期连接
   */
  private cleanupStaleConnections(): void {
    const now = new Date();
    const staleClients: string[] = [];

    for (const [sessionId, client] of this.clients.entries()) {
      const timeSinceLastActivity =
        now.getTime() - client.lastActivity.getTime();

      if (
        timeSinceLastActivity > this.config.connectionTimeout ||
        !client.isAlive
      ) {
        staleClients.push(sessionId);
      }
    }

    for (const sessionId of staleClients) {
      this.logger.info(`清理过期连接: ${sessionId}`);
      this.handleClientDisconnect(sessionId, "cleanup");
    }

    if (staleClients.length > 0) {
      this.logger.info(`清理了 ${staleClients.length} 个过期连接`);
    }
  }

  /**
   * 更新统计信息
   */
  private updateMetrics(): void {
    if (!this.config.enableMetrics) return;

    this.metrics.activeConnections = this.clients.size;
    this.metrics.uptime = Date.now() - this.startTime.getTime();

    this.logger.debug("连接统计", {
      activeConnections: this.metrics.activeConnections,
      totalConnections: this.metrics.totalConnections,
      totalMessages: this.metrics.totalMessages,
      errorCount: this.metrics.errorCount,
    });
  }

  /**
   * 初始化 MCP 消息处理器
   */
  private async initializeMessageHandler(c: Context): Promise<void> {
    if (this.mcpMessageHandler) {
      return;
    }

    try {
      // 从 Context 中获取 MCP 服务管理器实例
      const serviceManager = c.get("mcpServiceManager");
      if (!serviceManager) {
        throw new Error("MCPServiceManager 未在 Context 中找到，请检查中间件配置");
      }

      this.mcpMessageHandler = new MCPMessageHandler(serviceManager);
      this.logger.debug("MCP 消息处理器初始化成功");
    } catch (error) {
      this.logger.error("MCP 消息处理器初始化失败:", error);
      this.metrics.errorCount++;
      throw error;
    }
  }

  /**
   * 处理 POST 请求（JSON-RPC 消息）
   * 符合 MCP Streamable HTTP 规范
   * 支持直接 JSON-RPC 调用和 SSE 消息处理
   */
  async handlePost(c: Context): Promise<Response> {
    const startTime = Date.now();
    let messageId: string | number | null = null;

    try {
      this.logger.debug("处理 MCP POST 请求");

      // 检查是否是 SSE 消息（通过 sessionId 查询参数）
      const sessionId = c.req.query("sessionId");
      if (sessionId) {
        return await this.handleSSEMessage(c, sessionId);
      }

      // 验证请求大小
      const contentLength = c.req.header("content-length");
      if (
        contentLength &&
        Number.parseInt(contentLength) > this.config.maxMessageSize
      ) {
        this.metrics.errorCount++;
        return this.createErrorResponse(
          -32600,
          `Request too large: Maximum size is ${this.config.maxMessageSize} bytes`
        );
      }

      // 验证 Content-Type
      const contentType = c.req.header("content-type");
      if (!contentType?.includes("application/json")) {
        this.metrics.errorCount++;
        return this.createErrorResponse(
          -32600,
          "Invalid Request: Content-Type must be application/json"
        );
      }

      // 验证 MCP 协议版本头（可选）
      // 支持多种大小写格式的协议版本头
      const protocolVersion =
        c.req.header("mcp-protocol-version") ||
        c.req.header("MCP-Protocol-Version") ||
        c.req.header("Mcp-Protocol-Version");
      const supportedVersions = ["2024-11-05", "2025-06-18"];
      if (protocolVersion && !supportedVersions.includes(protocolVersion)) {
        this.logger.warn(
          `不支持的 MCP 协议版本: ${protocolVersion}，支持的版本: ${supportedVersions.join(", ")}`
        );
      }

      // 解析请求体
      let message: MCPMessage;
      try {
        const rawBody = await c.req.text();
        if (rawBody.length > this.config.maxMessageSize) {
          this.metrics.errorCount++;
          return this.createErrorResponse(
            -32600,
            `Message too large: Maximum size is ${this.config.maxMessageSize} bytes`,
            null
          );
        }
        message = JSON.parse(rawBody);
        messageId = message.id || null;
      } catch (error) {
        this.metrics.errorCount++;
        return this.createErrorResponse(-32700, "Parse error: Invalid JSON");
      }

      // 验证 JSON-RPC 格式
      if (!this.validateMessage(message)) {
        this.metrics.errorCount++;
        return this.createErrorResponse(
          -32600,
          "Invalid Request: Message does not conform to JSON-RPC 2.0",
          messageId
        );
      }

      // 初始化消息处理器
      await this.initializeMessageHandler(c);

      // 处理消息
      if (!this.mcpMessageHandler) {
        throw new Error("消息处理器初始化失败");
      }
      const response = await this.mcpMessageHandler.handleMessage(message);

      // 更新统计信息
      this.metrics.totalMessages++;
      const responseTime = Date.now() - startTime;
      this.metrics.averageResponseTime =
        (this.metrics.averageResponseTime * (this.metrics.totalMessages - 1) +
          responseTime) /
        this.metrics.totalMessages;

      this.logger.debug("MCP POST 请求处理成功", {
        method: message.method,
        messageId: messageId,
        responseTime: responseTime,
        isNotification: response === null,
      });

      // 对于通知消息，返回 204 No Content
      if (response === null) {
        return new Response(null, {
          status: 204,
          headers: {
            "MCP-Protocol-Version": "2024-11-05",
            "X-Response-Time": responseTime.toString(),
          },
        });
      }

      // 返回 JSON-RPC 响应
      return c.json(response, 200, {
        "Content-Type": "application/json",
        "MCP-Protocol-Version": "2024-11-05",
        "X-Response-Time": responseTime.toString(),
      });
    } catch (error) {
      this.metrics.errorCount++;
      const responseTime = Date.now() - startTime;

      this.logger.error("处理 MCP POST 请求时出错:", {
        error: error instanceof Error ? error.message : String(error),
        messageId: messageId,
        responseTime: responseTime,
        stack: error instanceof Error ? error.stack : undefined,
      });

      const errorMessage =
        error instanceof Error ? error.message : String(error);
      return this.createErrorResponse(
        -32603,
        `Internal error: ${errorMessage}`,
        messageId
      );
    }
  }

  /**
   * 处理 SSE 消息
   * 用于处理通过 SSE 连接发送的 JSON-RPC 消息
   */
  private async handleSSEMessage(
    c: Context,
    sessionId: string
  ): Promise<Response> {
    const startTime = Date.now();
    let messageId: string | number | null = null;

    try {
      this.logger.debug(`处理 SSE 消息 (会话: ${sessionId})`);

      // 验证会话是否存在
      const client = this.clients.get(sessionId);
      if (!client) {
        this.metrics.errorCount++;
        return this.createErrorResponse(
          -32600,
          "Invalid Request: Invalid or missing sessionId",
          null
        );
      }

      // 更新客户端活动时间
      client.lastActivity = new Date();

      // 验证请求大小
      const contentLength = c.req.header("content-length");
      if (
        contentLength &&
        Number.parseInt(contentLength) > this.config.maxMessageSize
      ) {
        this.metrics.errorCount++;
        return this.createErrorResponse(
          -32600,
          `Message too large: Maximum size is ${this.config.maxMessageSize} bytes`
        );
      }

      // 解析消息
      let message: MCPMessage;
      try {
        const rawBody = await c.req.text();
        if (rawBody.length > this.config.maxMessageSize) {
          this.metrics.errorCount++;
          return this.createErrorResponse(
            -32600,
            `Message too large: Maximum size is ${this.config.maxMessageSize} bytes`,
            null
          );
        }
        message = JSON.parse(rawBody);
        messageId = message.id || null;
      } catch (error) {
        this.metrics.errorCount++;
        return this.createErrorResponse(-32700, "Parse error: Invalid JSON");
      }

      // 验证消息格式
      if (!this.validateMessage(message)) {
        this.metrics.errorCount++;
        return this.createErrorResponse(
          -32600,
          "Invalid Request: Message does not conform to JSON-RPC 2.0",
          messageId
        );
      }

      // 初始化消息处理器
      await this.initializeMessageHandler(c);

      // 处理消息
      if (!this.mcpMessageHandler) {
        throw new Error("消息处理器初始化失败");
      }
      const response = await this.mcpMessageHandler.handleMessage(message);

      // 更新客户端统计
      client.messageCount++;
      this.metrics.totalMessages++;

      // 通过 SSE 发送响应（仅对非通知消息）
      if (response !== null && client.writer && client.isAlive) {
        try {
          await this.sendSSEEvent(
            client.writer,
            "message",
            JSON.stringify(response)
          );
        } catch (writeError) {
          this.logger.warn(
            `SSE 写入失败，标记客户端为不活跃: ${sessionId}`,
            writeError
          );
          client.isAlive = false;
        }
      }

      const responseTime = Date.now() - startTime;
      this.logger.debug(`SSE 消息处理完成 (会话: ${sessionId})`, {
        method: message.method,
        messageId: messageId,
        responseTime: responseTime,
        messageCount: client.messageCount,
        isNotification: response === null,
      });

      // 返回 202 Accepted 确认
      return new Response(null, {
        status: 202,
        headers: {
          "MCP-Protocol-Version": "2024-11-05",
          "X-Response-Time": responseTime.toString(),
        },
      });
    } catch (error) {
      this.metrics.errorCount++;
      const responseTime = Date.now() - startTime;

      this.logger.error(`处理 SSE 消息时出错 (会话: ${sessionId}):`, {
        error: error instanceof Error ? error.message : String(error),
        messageId: messageId,
        responseTime: responseTime,
        stack: error instanceof Error ? error.stack : undefined,
      });

      const errorMessage =
        error instanceof Error ? error.message : String(error);
      return this.createErrorResponse(
        -32603,
        `Internal error: ${errorMessage}`,
        messageId
      );
    }
  }

  /**
   * 处理 GET 请求（SSE 连接）
   * 符合 MCP Streamable HTTP 规范
   */
  async handleGet(c: Context): Promise<Response> {
    try {
      this.logger.debug("处理 MCP GET 请求（SSE 连接）");

      // 检查客户端数量限制
      if (this.clients.size >= this.config.maxClients) {
        this.metrics.errorCount++;
        return c.json(
          {
            jsonrpc: "2.0",
            error: {
              code: -32000,
              message: "Server busy: Maximum client connections reached",
              data: { maxClients: this.config.maxClients },
            },
            id: null,
          },
          503
        );
      }

      // 生成客户端标识
      const clientId = Date.now().toString();
      const sessionId = randomUUID();
      const now = new Date();

      // 获取客户端信息
      const userAgent = c.req.header("user-agent");
      const remoteAddress =
        c.req.header("x-forwarded-for") ||
        c.req.header("x-real-ip") ||
        "unknown";

      this.logger.info(`SSE 客户端连接: ${clientId} (会话: ${sessionId})`, {
        userAgent: userAgent,
        remoteAddress: remoteAddress,
      });

      // 创建 SSE 流
      const { readable, writable } = new TransformStream();
      const writer = writable.getWriter();

      // 创建 AbortController 用于连接管理
      const abortController = new AbortController();

      // 注册客户端
      const client: SSEClient = {
        id: clientId,
        sessionId,
        response: new Response(readable),
        connectedAt: now,
        lastActivity: now,
        writer,
        abortController,
        isAlive: true,
        messageCount: 0,
        userAgent,
        remoteAddress,
      };

      this.clients.set(sessionId, client);
      this.metrics.totalConnections++;
      this.metrics.activeConnections = this.clients.size;

      // 发送 SSE 头部和初始事件
      try {
        await this.sendSSEEvent(
          writer,
          "connected",
          JSON.stringify({
            sessionId: sessionId,
            endpoint: `/mcp?sessionId=${sessionId}`,
            timestamp: now.toISOString(),
            protocolVersion: "2024-11-05",
          })
        );
      } catch (writeError) {
        this.logger.error(`初始 SSE 事件发送失败: ${sessionId}`, writeError);
        client.isAlive = false;
      }

      // 启动心跳机制
      this.startHeartbeat(client);

      // 设置响应头
      const response = new Response(readable, {
        status: 200,
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache, no-transform",
          Connection: "keep-alive",
          "X-Accel-Buffering": "no",
          "MCP-Protocol-Version": "2024-11-05",
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Headers": "Content-Type, MCP-Protocol-Version",
        },
      });

      // 处理连接关闭
      const handleDisconnect = () => {
        this.handleClientDisconnect(sessionId, clientId);
      };

      c.req.raw.signal?.addEventListener("abort", handleDisconnect);
      abortController.signal.addEventListener("abort", handleDisconnect);

      return response;
    } catch (error) {
      this.metrics.errorCount++;
      this.logger.error("处理 MCP GET 请求时出错:", {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });

      return c.json(
        {
          jsonrpc: "2.0",
          error: {
            code: -32603,
            message: "Internal error",
          },
          id: null,
        },
        500
      );
    }
  }

  /**
   * 启动心跳机制
   */
  private startHeartbeat(client: SSEClient): void {
    if (client.heartbeatInterval) {
      clearInterval(client.heartbeatInterval);
    }

    client.heartbeatInterval = setInterval(async () => {
      if (!client.isAlive || !client.writer) {
        this.stopHeartbeat(client);
        return;
      }

      try {
        await this.sendSSEEvent(
          client.writer,
          "heartbeat",
          JSON.stringify({
            timestamp: new Date().toISOString(),
            sessionId: client.sessionId,
          })
        );

        this.logger.debug(`心跳发送成功: ${client.sessionId}`);
      } catch (error) {
        this.logger.warn(
          `心跳发送失败，标记客户端为不活跃: ${client.sessionId}`,
          error
        );
        client.isAlive = false;
        this.stopHeartbeat(client);
      }
    }, this.config.heartbeatInterval);
  }

  /**
   * 停止心跳机制
   */
  private stopHeartbeat(client: SSEClient): void {
    if (client.heartbeatInterval) {
      clearInterval(client.heartbeatInterval);
      client.heartbeatInterval = undefined;
    }
  }

  /**
   * 发送 SSE 事件
   */
  private async sendSSEEvent(
    writer: WritableStreamDefaultWriter<Uint8Array>,
    event: string,
    data: string
  ): Promise<void> {
    try {
      const eventData = `event: ${event}\ndata: ${data}\n\n`;
      await writer.write(new TextEncoder().encode(eventData));
    } catch (error) {
      this.logger.error("发送 SSE 事件失败:", error);
      throw error; // 重新抛出错误，让调用者处理
    }
  }

  /**
   * 处理客户端断开连接
   */
  private handleClientDisconnect(sessionId: string, reason: string): void {
    const client = this.clients.get(sessionId);
    if (!client) {
      return;
    }

    const connectionDuration = Date.now() - client.connectedAt.getTime();

    this.logger.debug(`SSE 客户端断开连接: ${client.id} (会话: ${sessionId})`, {
      reason: reason,
      duration: connectionDuration,
      messageCount: client.messageCount,
      userAgent: client.userAgent,
      remoteAddress: client.remoteAddress,
    });

    // 停止心跳
    this.stopHeartbeat(client);

    // 中止连接
    if (client.abortController) {
      client.abortController.abort();
    }

    // 关闭写入器
    try {
      if (client.writer) {
        client.writer.close();
      }
    } catch (error) {
      this.logger.debug("关闭 SSE writer 时出错:", error);
    }

    // 从客户端列表中移除
    this.clients.delete(sessionId);
    this.metrics.activeConnections = this.clients.size;
  }

  /**
   * 验证 JSON-RPC 消息格式
   */
  private validateMessage(message: unknown): message is MCPMessage {
    if (!message || typeof message !== "object") {
      this.logger.debug("消息验证失败: 不是对象");
      return false;
    }

    // 类型守卫：确保 message 是对象类型
    const msg = message as Record<string, unknown>;

    if (msg.jsonrpc !== "2.0") {
      this.logger.debug("消息验证失败: jsonrpc 版本不正确", {
        jsonrpc: msg.jsonrpc,
      });
      return false;
    }

    if (!msg.method || typeof msg.method !== "string") {
      this.logger.debug("消息验证失败: method 字段无效", {
        method: msg.method,
      });
      return false;
    }

    // 验证 id 字段（如果存在）
    if (
      msg.id !== undefined &&
      typeof msg.id !== "string" &&
      typeof msg.id !== "number" &&
      msg.id !== null
    ) {
      this.logger.debug("消息验证失败: id 字段类型无效", { id: msg.id });
      return false;
    }

    // 验证 params 字段（如果存在）
    if (msg.params !== undefined && typeof msg.params !== "object") {
      this.logger.debug("消息验证失败: params 字段类型无效", {
        params: msg.params,
      });
      return false;
    }

    return true;
  }

  /**
   * 创建错误响应
   */
  private createErrorResponse(
    code: number,
    message: string,
    id?: string | number | null
  ): Response {
    // 确保ID不为空，如果为空或未提供则生成默认ID
    const responseId = id ?? `error-${Date.now()}`;

    const errorResponse: MCPResponse = {
      jsonrpc: "2.0",
      error: {
        code,
        message,
      },
      id: responseId,
    };

    return new Response(JSON.stringify(errorResponse), {
      status: 400,
      headers: {
        "Content-Type": "application/json",
        "MCP-Protocol-Version": "2024-11-05",
      },
    });
  }

  /**
   * 获取连接状态
   */
  getStatus() {
    return {
      connectedClients: this.clients.size,
      maxClients: this.config.maxClients,
      isInitialized: this.mcpMessageHandler !== null,
      metrics: this.config.enableMetrics ? this.metrics : undefined,
      config: {
        maxClients: this.config.maxClients,
        connectionTimeout: this.config.connectionTimeout,
        heartbeatInterval: this.config.heartbeatInterval,
        maxMessageSize: this.config.maxMessageSize,
      },
    };
  }

  /**
   * 获取详细的连接信息
   */
  getDetailedStatus() {
    const clients = Array.from(this.clients.values()).map((client) => ({
      id: client.id,
      sessionId: client.sessionId,
      connectedAt: client.connectedAt.toISOString(),
      lastActivity: client.lastActivity.toISOString(),
      messageCount: client.messageCount,
      isAlive: client.isAlive,
      userAgent: client.userAgent,
      remoteAddress: client.remoteAddress,
    }));

    return {
      ...this.getStatus(),
      clients,
      startTime: this.startTime.toISOString(),
    };
  }

  /**
   * 广播消息到所有活跃客户端
   */
  async broadcastMessage(event: string, data: unknown): Promise<void> {
    let message: string;
    try {
      // 验证数据是否可以序列化
      message = JSON.stringify(data);
    } catch (error) {
      this.logger.error("广播消息序列化失败:", {
        error: error instanceof Error ? error.message : String(error),
        data,
      });
      throw new Error(
        `广播消息无法序列化: ${error instanceof Error ? error.message : String(error)}`
      );
    }

    const deadClients: string[] = [];

    for (const [sessionId, client] of this.clients.entries()) {
      if (!client.isAlive || !client.writer) {
        deadClients.push(sessionId);
        continue;
      }

      try {
        await this.sendSSEEvent(client.writer, event, message);
      } catch (error) {
        this.logger.warn(
          `广播消息失败，标记客户端为不活跃: ${sessionId}`,
          error
        );
        client.isAlive = false;
        deadClients.push(sessionId);
      }
    }

    // 清理死连接
    for (const sessionId of deadClients) {
      this.handleClientDisconnect(sessionId, "broadcast-failed");
    }
  }

  /**
   * 销毁处理器，清理所有资源
   */
  destroy(): void {
    this.logger.info("正在销毁 MCPRouteHandler");

    // 停止清理任务
    this.stopCleanupTask();

    // 断开所有客户端连接
    for (const [sessionId] of this.clients.entries()) {
      this.handleClientDisconnect(sessionId, "server-shutdown");
    }

    // 清理消息处理器
    this.mcpMessageHandler = null;

    this.logger.info("MCPRouteHandler 销毁完成");
  }
}

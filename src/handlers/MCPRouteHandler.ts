/**
 * MCP 路由处理器
 * 处理符合 MCP Streamable HTTP 规范的单一 /mcp 端点
 * 支持 POST 请求（JSON-RPC 消息）和 GET 请求（SSE 连接）
 */

import { randomUUID } from "node:crypto";
import type { Context } from "hono";
import { type Logger, logger } from "../Logger.js";
import { MCPMessageHandler } from "../core/MCPMessageHandler.js";
import { MCPServiceManagerSingleton } from "../services/MCPServiceManagerSingleton.js";

/**
 * SSE 客户端接口
 */
interface SSEClient {
  id: string;
  sessionId: string;
  response: Response;
  connectedAt: Date;
  writer?: WritableStreamDefaultWriter<Uint8Array>;
}

/**
 * MCP 消息接口
 */
interface MCPMessage {
  jsonrpc: "2.0";
  method: string;
  params?: any;
  id?: string | number;
}

/**
 * MCP 响应接口
 */
interface MCPResponse {
  jsonrpc: "2.0";
  result?: any;
  error?: MCPError;
  id: string | number | null;
}

/**
 * MCP 错误接口
 */
interface MCPError {
  code: number;
  message: string;
  data?: any;
}

/**
 * MCP 路由处理器
 * 实现符合 MCP Streamable HTTP 规范的单一端点处理
 */
export class MCPRouteHandler {
  private logger: Logger;
  private mcpMessageHandler: MCPMessageHandler | null = null;
  private clients: Map<string, SSEClient> = new Map();
  private maxClients: number = 100;

  constructor() {
    this.logger = logger.withTag("MCPRouteHandler");
  }

  /**
   * 初始化 MCP 消息处理器
   */
  private async initializeMessageHandler(): Promise<void> {
    if (this.mcpMessageHandler) {
      return;
    }

    try {
      // 获取 MCP 服务管理器实例
      const serviceManager = await MCPServiceManagerSingleton.getInstance();
      this.mcpMessageHandler = new MCPMessageHandler(serviceManager);
      this.logger.info("MCP 消息处理器初始化成功");
    } catch (error) {
      this.logger.error("MCP 消息处理器初始化失败:", error);
      throw error;
    }
  }

  /**
   * 处理 POST 请求（JSON-RPC 消息）
   * 符合 MCP Streamable HTTP 规范
   * 支持直接 JSON-RPC 调用和 SSE 消息处理
   */
  async handlePost(c: Context): Promise<Response> {
    try {
      this.logger.debug("处理 MCP POST 请求");

      // 检查是否是 SSE 消息（通过 sessionId 查询参数）
      const sessionId = c.req.query("sessionId");
      if (sessionId) {
        return await this.handleSSEMessage(c, sessionId);
      }

      // 验证 Content-Type
      const contentType = c.req.header("content-type");
      if (!contentType?.includes("application/json")) {
        return this.createErrorResponse(
          -32600,
          "Invalid Request: Content-Type must be application/json",
          null
        );
      }

      // 验证 MCP 协议版本头（可选）
      const protocolVersion = c.req.header("mcp-protocol-version");
      if (protocolVersion && protocolVersion !== "2024-11-05") {
        this.logger.warn(`不支持的 MCP 协议版本: ${protocolVersion}`);
      }

      // 解析请求体
      let message: MCPMessage;
      try {
        message = await c.req.json();
      } catch (error) {
        return this.createErrorResponse(
          -32700,
          "Parse error: Invalid JSON",
          null
        );
      }

      // 验证 JSON-RPC 格式
      if (!this.validateMessage(message)) {
        return this.createErrorResponse(
          -32600,
          "Invalid Request: Message does not conform to JSON-RPC 2.0",
          message.id || null
        );
      }

      // 初始化消息处理器
      await this.initializeMessageHandler();

      // 处理消息
      const response = await this.mcpMessageHandler!.handleMessage(message);

      this.logger.debug("MCP POST 请求处理成功");

      // 返回 JSON-RPC 响应
      return c.json(response, 200, {
        "Content-Type": "application/json",
        "MCP-Protocol-Version": "2024-11-05",
      });
    } catch (error) {
      this.logger.error("处理 MCP POST 请求时出错:", error);

      const errorMessage = error instanceof Error ? error.message : String(error);
      return this.createErrorResponse(-32603, `Internal error: ${errorMessage}`, null);
    }
  }

  /**
   * 处理 SSE 消息
   * 用于处理通过 SSE 连接发送的 JSON-RPC 消息
   */
  private async handleSSEMessage(c: Context, sessionId: string): Promise<Response> {
    try {
      this.logger.debug(`处理 SSE 消息 (会话: ${sessionId})`);

      // 验证会话是否存在
      const client = this.clients.get(sessionId);
      if (!client) {
        return this.createErrorResponse(
          -32600,
          "Invalid Request: Invalid or missing sessionId",
          null
        );
      }

      // 解析消息
      let message: MCPMessage;
      try {
        message = await c.req.json();
      } catch (error) {
        return this.createErrorResponse(
          -32700,
          "Parse error: Invalid JSON",
          null
        );
      }

      // 验证消息格式
      if (!this.validateMessage(message)) {
        return this.createErrorResponse(
          -32600,
          "Invalid Request: Message does not conform to JSON-RPC 2.0",
          message.id || null
        );
      }

      // 初始化消息处理器
      await this.initializeMessageHandler();

      // 处理消息
      const response = await this.mcpMessageHandler!.handleMessage(message);

      // 通过 SSE 发送响应
      if (client.writer) {
        await this.sendSSEEvent(client.writer, "message", JSON.stringify(response));
      }

      // 返回 202 Accepted 确认
      return new Response(null, {
        status: 202,
        headers: {
          "MCP-Protocol-Version": "2024-11-05",
        },
      });
    } catch (error) {
      this.logger.error("处理 SSE 消息时出错:", error);

      const errorMessage = error instanceof Error ? error.message : String(error);
      return this.createErrorResponse(-32603, `Internal error: ${errorMessage}`, null);
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
      if (this.clients.size >= this.maxClients) {
        return c.json(
          {
            jsonrpc: "2.0",
            error: {
              code: -32000,
              message: "Server busy: Maximum client connections reached",
              data: { maxClients: this.maxClients },
            },
            id: null,
          },
          503
        );
      }

      // 生成客户端标识
      const clientId = Date.now().toString();
      const sessionId = randomUUID();

      this.logger.info(`SSE 客户端连接: ${clientId} (会话: ${sessionId})`);

      // 创建 SSE 流
      const { readable, writable } = new TransformStream();
      const writer = writable.getWriter();

      // 注册客户端
      const client: SSEClient = {
        id: clientId,
        sessionId,
        response: new Response(readable),
        connectedAt: new Date(),
        writer,
      };

      this.clients.set(sessionId, client);

      // 发送 SSE 头部和初始事件
      await this.sendSSEEvent(writer, "endpoint", `/mcp?sessionId=${sessionId}`);

      // 设置响应头
      const response = new Response(readable, {
        status: 200,
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache, no-transform",
          "Connection": "keep-alive",
          "X-Accel-Buffering": "no",
          "MCP-Protocol-Version": "2024-11-05",
        },
      });

      // 处理连接关闭
      c.req.raw.signal?.addEventListener("abort", () => {
        this.handleClientDisconnect(sessionId, clientId);
      });

      return response;
    } catch (error) {
      this.logger.error("处理 MCP GET 请求时出错:", error);
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
    }
  }

  /**
   * 处理客户端断开连接
   */
  private handleClientDisconnect(sessionId: string, clientId: string): void {
    const client = this.clients.get(sessionId);
    if (client) {
      try {
        client.writer?.close();
      } catch (error) {
        this.logger.debug("关闭 SSE writer 时出错:", error);
      }
      this.clients.delete(sessionId);
      this.logger.info(`SSE 客户端已断开连接: ${clientId} (会话: ${sessionId})`);
    }
  }

  /**
   * 验证 JSON-RPC 消息格式
   */
  private validateMessage(message: any): message is MCPMessage {
    if (!message || typeof message !== "object") {
      return false;
    }

    if (message.jsonrpc !== "2.0") {
      return false;
    }

    if (!message.method || typeof message.method !== "string") {
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
    id: string | number | null
  ): Response {
    const errorResponse: MCPResponse = {
      jsonrpc: "2.0",
      error: {
        code,
        message,
      },
      id,
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
      maxClients: this.maxClients,
      isInitialized: this.mcpMessageHandler !== null,
    };
  }
}

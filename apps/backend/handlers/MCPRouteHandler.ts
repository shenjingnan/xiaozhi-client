/**
 * MCP 路由处理器
 * 处理符合 MCP Streamable HTTP 规范的单一 /mcp 端点
 * 支持 POST 请求（JSON-RPC 消息）
 */

import type { MCPServiceManager } from "@/lib/mcp";
import { MCPMessageHandler } from "@/lib/mcp";
import type { Logger } from "@root/Logger.js";
import { logger } from "@root/Logger.js";
import type { MCPMessage } from "@root/types/mcp.js";
import type { Context } from "hono";

/**
 * MCP 路由处理器配置接口
 */
interface MCPRouteHandlerConfig {
  maxMessageSize?: number;
  enableMetrics?: boolean;
}

/**
 * 连接统计信息
 */
interface ConnectionMetrics {
  totalMessages: number;
  errorCount: number;
  averageResponseTime: number;
}

/**
 * MCP 路由处理器
 * 实现符合 MCP Streamable HTTP 规范的单一端点处理（仅 POST 模式）
 */
export class MCPRouteHandler {
  private logger: Logger;
  private mcpMessageHandler: MCPMessageHandler | null = null;
  private config: {
    maxMessageSize: number;
    enableMetrics: boolean;
  };
  private metrics: ConnectionMetrics;

  constructor(config: MCPRouteHandlerConfig = {}) {
    this.logger = logger;
    this.config = {
      maxMessageSize: config.maxMessageSize ?? 1024 * 1024, // 1MB
      enableMetrics: config.enableMetrics ?? true,
    };

    this.metrics = {
      totalMessages: 0,
      errorCount: 0,
      averageResponseTime: 0,
    };

    this.logger.debug("MCPRouteHandler 初始化完成", {
      maxMessageSize: this.config.maxMessageSize,
      enableMetrics: this.config.enableMetrics,
    });
  }

  /**
   * 获取 MCP 服务管理器实例
   * 优先从 Context 获取，如果不存在则从 WebServer 获取
   */
  private getMCPServiceManager(c: Context): MCPServiceManager {
    // 首先尝试从 Context 获取
    const serviceManager = c.get("mcpServiceManager");
    if (serviceManager) {
      return serviceManager;
    }

    // 如果 Context 中没有，则从 WebServer 获取
    const webServer = c.get("webServer");
    if (!webServer) {
      throw new Error("WebServer 未在 Context 中找到，请检查中间件配置");
    }

    const mcpServiceManager = webServer.getMCPServiceManager();
    this.logger.debug(
      "MCPServiceManager 从 WebServer 获取（Context 中未找到）"
    );

    return mcpServiceManager;
  }

  /**
   * 初始化 MCP 消息处理器
   */
  private async initializeMessageHandler(c: Context): Promise<void> {
    if (this.mcpMessageHandler) {
      return;
    }

    try {
      const serviceManager = this.getMCPServiceManager(c);
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
   */
  async handlePost(c: Context): Promise<Response> {
    const startTime = Date.now();
    let messageId: string | number | null = null;

    try {
      this.logger.debug("处理 MCP POST 请求");

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
          `不支持的 MCP 协议版本: ${protocolVersion}，支持的版本: ${supportedVersions.join(
            ", "
          )}`
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

    const errorResponse = {
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
      isInitialized: this.mcpMessageHandler !== null,
      metrics: this.config.enableMetrics ? this.metrics : undefined,
      config: {
        maxMessageSize: this.config.maxMessageSize,
      },
    };
  }

  /**
   * 销毁处理器，清理所有资源
   */
  destroy(): void {
    this.logger.info("正在销毁 MCPRouteHandler");

    // 清理消息处理器
    this.mcpMessageHandler = null;

    this.logger.info("MCPRouteHandler 销毁完成");
  }
}

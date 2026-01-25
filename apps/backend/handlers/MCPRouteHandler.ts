/**
 * MCP 路由处理器
 * 处理符合 MCP Streamable HTTP 规范的单一 /mcp 端点
 * 使用 @modelcontextprotocol/sdk 的 WebStandardStreamableHTTPServerTransport
 *
 * 重构说明：
 * - 移除了自定义 SSE 客户端管理（~150 行）
 * - 移除了 JSON-RPC 消息验证（~50 行）
 * - 移除了自定义消息解析处理（~100 行）
 * - 移除了自定义 SSE 事件发送逻辑（~50 行）
 * - 使用 MCPSessionManager 管理会话
 * - 保留了统计和监控功能
 */

import type { MCPServiceManager } from "@/lib/mcp/manager.js";
import { MCPSessionManager } from "@/lib/mcp/session-manager.js";
import { logger } from "@root/Logger.js";
import type { Context } from "hono";

/**
 * MCP 路由处理器配置接口
 */
export interface MCPRouteHandlerConfig {
  /** 最大并发连接数 */
  maxClients?: number;
  /** 连接超时时间（毫秒） */
  connectionTimeout?: number;
  /** 心跳间隔（毫秒） */
  heartbeatInterval?: number;
  /** 最大消息大小（字节） */
  maxMessageSize?: number;
  /** 是否启用统计 */
  enableMetrics?: boolean;
}

/**
 * 连接统计信息
 */
export interface ConnectionMetrics {
  /** 总连接数 */
  totalConnections: number;
  /** 当前活跃连接数 */
  activeConnections: number;
  /** 总消息数 */
  totalMessages: number;
  /** 错误计数 */
  errorCount: number;
  /** 平均响应时间（毫秒） */
  averageResponseTime: number;
  /** 运行时长（毫秒） */
  uptime: number;
}

/**
 * 处理器状态
 */
export interface RouteHandlerStatus {
  /** 当前连接的客户端数 */
  connectedClients: number;
  /** 最大客户端数 */
  maxClients: number;
  /** 是否已初始化 */
  isInitialized: boolean;
  /** 统计信息（如果启用） */
  metrics?: ConnectionMetrics;
  /** 配置信息 */
  config: {
    maxClients: number;
    connectionTimeout: number;
    heartbeatInterval: number;
    maxMessageSize: number;
  };
}

/**
 * MCP 路由处理器
 * 实现符合 MCP Streamable HTTP 规范的单一端点处理
 */
export class MCPRouteHandler {
  private sessionManager: MCPSessionManager;
  private config: Required<MCPRouteHandlerConfig>;
  private metrics: ConnectionMetrics;
  private startTime: Date;

  constructor(config: MCPRouteHandlerConfig = {}) {
    this.config = {
      maxClients: config.maxClients ?? 100,
      connectionTimeout: config.connectionTimeout ?? 300000, // 5分钟
      heartbeatInterval: config.heartbeatInterval ?? 30000, // 30秒
      maxMessageSize: config.maxMessageSize ?? 1024 * 1024, // 1MB
      enableMetrics: config.enableMetrics ?? true,
    };

    this.sessionManager = new MCPSessionManager(this.config.maxClients);
    this.metrics = {
      totalConnections: 0,
      activeConnections: 0,
      totalMessages: 0,
      errorCount: 0,
      averageResponseTime: 0,
      uptime: 0,
    };

    this.startTime = new Date();

    logger.debug("MCPRouteHandler 初始化完成", {
      maxClients: this.config.maxClients,
      connectionTimeout: this.config.connectionTimeout,
      heartbeatInterval: this.config.heartbeatInterval,
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
    logger.debug(
      "MCPServiceManager 从 WebServer 获取（Context 中未找到）"
    );

    return mcpServiceManager;
  }

  /**
   * 处理 GET 请求（SSE 连接）
   * 符合 MCP Streamable HTTP 规范
   */
  async handleGet(c: Context): Promise<Response> {
    const startTime = Date.now();

    try {
      logger.debug("处理 MCP GET 请求（SSE 连接）");

      const serviceManager = this.getMCPServiceManager(c);

      // 创建新会话（SSE 模式）
      const sessionId = await this.sessionManager.createSession(serviceManager);

      // 更新统计
      this.metrics.totalConnections++;
      this.metrics.activeConnections = this.sessionManager.getStatus().totalSessions;

      logger.debug(`SSE 会话创建成功: ${sessionId}`);

      // 使用 SDK Transport 处理请求
      const response = await this.sessionManager.handleRequest(sessionId, c.req.raw);

      const responseTime = Date.now() - startTime;
      logger.debug("MCP GET 请求处理成功", {
        sessionId,
        responseTime,
      });

      return response;
    } catch (error) {
      this.metrics.errorCount++;
      const responseTime = Date.now() - startTime;

      logger.error("处理 MCP GET 请求时出错:", {
        error: error instanceof Error ? error.message : String(error),
        responseTime,
        stack: error instanceof Error ? error.stack : undefined,
      });

      return new Response(
        JSON.stringify({
          jsonrpc: "2.0",
          error: {
            code: -32603,
            message: error instanceof Error ? error.message : "Internal error",
          },
          id: null,
        }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }
  }

  /**
   * 处理 POST 请求（JSON-RPC 消息）
   * 符合 MCP Streamable HTTP 规范
   * 支持直接 JSON-RPC 调用和 SSE 会话消息
   */
  async handlePost(c: Context): Promise<Response> {
    const startTime = Date.now();

    try {
      logger.debug("处理 MCP POST 请求");

      // 检查是否是 SSE 会话消息（通过 sessionId 查询参数）
      const sessionId = c.req.query("sessionId");

      if (sessionId) {
        // SSE 会话消息：使用现有会话
        if (!this.sessionManager.hasSession(sessionId)) {
          this.metrics.errorCount++;
          return new Response(
            JSON.stringify({
              jsonrpc: "2.0",
              error: {
                code: -32000,
                message: "Invalid session ID",
              },
              id: null,
            }),
            { status: 404, headers: { "Content-Type": "application/json" } }
          );
        }

        const response = await this.sessionManager.handleRequest(
          sessionId,
          c.req.raw
        );

        this.metrics.totalMessages++;
        const responseTime = Date.now() - startTime;
        this.updateAverageResponseTime(responseTime);

        return response;
      }

      // 直接 JSON-RPC 调用：创建临时会话
      const serviceManager = this.getMCPServiceManager(c);
      const tempSessionId = await this.sessionManager.createSession(serviceManager);

      const response = await this.sessionManager.handleRequest(
        tempSessionId,
        c.req.raw
      );

      // 清理临时会话
      await this.sessionManager.closeSession(tempSessionId);

      // 更新统计
      this.metrics.totalMessages++;
      const responseTime = Date.now() - startTime;
      this.updateAverageResponseTime(responseTime);

      logger.debug("MCP POST 请求处理成功", {
        tempSessionId,
        responseTime,
      });

      return response;
    } catch (error) {
      this.metrics.errorCount++;
      const responseTime = Date.now() - startTime;

      logger.error("处理 MCP POST 请求时出错:", {
        error: error instanceof Error ? error.message : String(error),
        responseTime,
        stack: error instanceof Error ? error.stack : undefined,
      });

      return new Response(
        JSON.stringify({
          jsonrpc: "2.0",
          error: {
            code: -32603,
            message: error instanceof Error ? error.message : "Internal error",
          },
          id: null,
        }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }
  }

  /**
   * 处理 DELETE 请求（关闭会话）
   * 符合 MCP Streamable HTTP 规范
   */
  async handleDelete(c: Context): Promise<Response> {
    try {
      logger.debug("处理 MCP DELETE 请求");

      const sessionId = c.req.query("sessionId");

      if (sessionId) {
        await this.sessionManager.closeSession(sessionId);
        logger.debug(`会话已关闭: ${sessionId}`);
      }

      return new Response(null, { status: 204 });
    } catch (error) {
      logger.error("处理 MCP DELETE 请求时出错:", {
        error: error instanceof Error ? error.message : String(error),
      });

      return new Response(
        JSON.stringify({
          jsonrpc: "2.0",
          error: {
            code: -32603,
            message: "Failed to close session",
          },
          id: null,
        }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }
  }

  /**
   * 更新平均响应时间
   */
  private updateAverageResponseTime(responseTime: number): void {
    if (!this.config.enableMetrics) return;

    this.metrics.averageResponseTime =
      (this.metrics.averageResponseTime * (this.metrics.totalMessages - 1) +
        responseTime) /
      this.metrics.totalMessages;
  }

  /**
   * 获取连接状态
   */
  getStatus(): RouteHandlerStatus {
    const sessionStats = this.sessionManager.getStatus();

    return {
      connectedClients: sessionStats.totalSessions,
      maxClients: this.config.maxClients,
      isInitialized: true,
      metrics: this.config.enableMetrics
        ? {
            ...this.metrics,
            activeConnections: sessionStats.totalSessions,
            uptime: Date.now() - this.startTime.getTime(),
          }
        : undefined,
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
    const sessionStats = this.sessionManager.getStatus();

    return {
      ...this.getStatus(),
      sessions: sessionStats.sessions,
      startTime: this.startTime.toISOString(),
    };
  }

  /**
   * 销毁处理器，清理所有资源
   */
  destroy(): void {
    logger.info("正在销毁 MCPRouteHandler");

    this.sessionManager.destroy();

    logger.info("MCPRouteHandler 销毁完成");
  }
}

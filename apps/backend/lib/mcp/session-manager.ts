/**
 * MCP 会话管理器
 * 管理多个 MCP 服务端会话，每个会话使用 SDK 的 Server 和 Transport
 */

import { randomUUID } from "node:crypto";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { CallToolRequestSchema, CompatibilityCallToolResult, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import type { MCPServiceManager } from "./manager.js";
import type { EnhancedToolInfo } from "./types.js";
import { logger } from "@root/Logger.js";

/**
 * MCP 会话接口
 */
export interface MCPSession {
  /** 会话唯一标识符 */
  sessionId: string;
  /** SDK Transport 实例 */
  transport: WebStandardStreamableHTTPServerTransport;
  /** SDK Server 实例 */
  server: McpServer;
  /** 连接时间 */
  connectedAt: Date;
  /** 最后活动时间 */
  lastActivity: Date;
  /** 消息计数 */
  messageCount: number;
  /** 是否存活 */
  isAlive: boolean;
}

/**
 * 会话状态统计
 */
export interface SessionStats {
  /** 总会话数 */
  totalSessions: number;
  /** 最大会话数 */
  maxSessions: number;
  /** 会话详情列表 */
  sessions: Array<{
    sessionId: string;
    connectedAt: string;
    messageCount: number;
  }>;
}

/**
 * MCP 会话管理器
 * 负责创建、管理和清理 MCP 服务端会话
 */
export class MCPSessionManager {
  private sessions: Map<string, MCPSession> = new Map();
  private maxSessions: number;
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor(maxSessions: number = 100) {
    this.maxSessions = maxSessions;
    this.startCleanupTask();
    logger.debug("MCPSessionManager 初始化", { maxSessions });
  }

  /**
   * 创建新会话
   * @param serviceManager MCP 服务管理器
   * @returns 会话 ID
   */
  async createSession(serviceManager: MCPServiceManager): Promise<string> {
    // 检查会话限制
    if (this.sessions.size >= this.maxSessions) {
      throw new Error(`Maximum sessions limit reached: ${this.maxSessions}`);
    }

    const sessionId = randomUUID();
    logger.debug(`创建 MCP 会话: ${sessionId}`);

    // 创建 Transport
    const transport = new WebStandardStreamableHTTPServerTransport({
      sessionIdGenerator: () => sessionId,
      onsessioninitialized: (id) => {
        logger.debug(`会话初始化: ${id}`);
      },
      onsessionclosed: (id) => {
        logger.debug(`会话关闭: ${id}`);
        this.sessions.delete(id);
      },
    });

    // 创建 Server
    const server = new McpServer(
      {
        name: "xiaozhi-mcp-server",
        version: "1.0.0",
      },
      {
        capabilities: {
          tools: {},
          logging: {},
        },
      }
    );

    // 注册 tools/list 处理器
    server.server.setRequestHandler(ListToolsRequestSchema, async () => {
      const tools: EnhancedToolInfo[] = serviceManager.getAllTools();
      return {
        tools: tools.map((tool) => ({
          name: tool.name,
          description: tool.description,
          inputSchema: tool.inputSchema,
        })),
      };
    });

    // 注册 tools/call 处理器
    server.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const result = await serviceManager.callTool(
        request.params.name,
        request.params.arguments ?? {}
      );
      // ToolCallResult 与 CompatibilityCallToolResult 结构兼容
      // 使用类型断言避免复杂的类型转换
      return result as CompatibilityCallToolResult;
    });

    // 连接 Transport 和 Server
    await server.connect(transport);

    // 保存会话
    this.sessions.set(sessionId, {
      sessionId,
      transport,
      server,
      connectedAt: new Date(),
      lastActivity: new Date(),
      messageCount: 0,
      isAlive: true,
    });

    logger.debug(`MCP 会话创建成功: ${sessionId}`);
    return sessionId;
  }

  /**
   * 处理请求
   * @param sessionId 会话 ID
   * @param req Web 标准 Request 对象
   * @returns Web 标准 Response 对象
   */
  async handleRequest(sessionId: string, req: Request): Promise<Response> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      logger.warn(`会话不存在: ${sessionId}`);
      return new Response("Session not found", { status: 404 });
    }

    session.lastActivity = new Date();
    session.messageCount++;

    return session.transport.handleRequest(req);
  }

  /**
   * 关闭会话
   * @param sessionId 会话 ID
   */
  async closeSession(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return;
    }

    logger.debug(`关闭 MCP 会话: ${sessionId}`, {
      messageCount: session.messageCount,
      duration: Date.now() - session.connectedAt.getTime(),
    });

    try {
      await session.server.close();
    } catch (error) {
      logger.warn(`关闭 Server 时出错: ${sessionId}`, error);
    }

    this.sessions.delete(sessionId);
  }

  /**
   * 获取会话状态
   * @returns 会话统计信息
   */
  getStatus(): SessionStats {
    return {
      totalSessions: this.sessions.size,
      maxSessions: this.maxSessions,
      sessions: Array.from(this.sessions.values()).map((s) => ({
        sessionId: s.sessionId,
        connectedAt: s.connectedAt.toISOString(),
        messageCount: s.messageCount,
      })),
    };
  }

  /**
   * 检查会话是否存在
   * @param sessionId 会话 ID
   * @returns 是否存在
   */
  hasSession(sessionId: string): boolean {
    return this.sessions.has(sessionId);
  }

  /**
   * 启动清理任务
   */
  private startCleanupTask(): void {
    this.cleanupInterval = setInterval(() => {
      this.cleanupStaleSessions();
    }, 60000); // 每分钟执行一次
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
   * 清理过期会话
   */
  private cleanupStaleSessions(): void {
    const now = Date.now();
    const staleSessions: string[] = [];

    for (const [sessionId, session] of this.sessions.entries()) {
      const inactiveTime = now - session.lastActivity.getTime();
      // 5分钟无活动则清理
      if (inactiveTime > 300000) {
        staleSessions.push(sessionId);
      }
    }

    for (const sessionId of staleSessions) {
      logger.debug(`清理过期会话: ${sessionId}`);
      this.closeSession(sessionId);
    }

    if (staleSessions.length > 0) {
      logger.info(`清理了 ${staleSessions.length} 个过期会话`);
    }
  }

  /**
   * 销毁管理器，清理所有资源
   */
  destroy(): void {
    logger.info("正在销毁 MCPSessionManager");

    this.stopCleanupTask();

    for (const sessionId of this.sessions.keys()) {
      this.closeSession(sessionId);
    }

    logger.info("MCPSessionManager 销毁完成");
  }
}

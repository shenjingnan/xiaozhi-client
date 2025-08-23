/**
 * 状态相关路由处理器
 * 处理服务状态查询操作
 */

import type { Hono } from "hono";
import { logger } from "../../Logger.js";
import type { RouteHandler } from "../../types/WebServerTypes.js";

/**
 * 客户端信息接口
 * 从 WebServer.ts 迁移的接口定义
 */
export interface ClientInfo {
  status: "connected" | "disconnected";
  mcpEndpoint: string;
  activeMCPServers: string[];
  lastHeartbeat?: number;
}

/**
 * MCP 连接状态接口
 */
export interface MCPConnectionStatus {
  connected: boolean;
  endpoint?: string;
  error?: string;
}

/**
 * 状态路由处理器
 * 负责处理 /api/status 相关的路由
 */
export class StatusRoutes implements RouteHandler {
  private clientInfo: ClientInfo = {
    status: "disconnected",
    mcpEndpoint: "",
    activeMCPServers: [],
  };

  private getMCPStatus?: () => MCPConnectionStatus | undefined;

  /**
   * 注册状态相关路由
   * @param app Hono 应用实例
   */
  register(app: Hono): void {
    // GET /api/status - 获取服务状态
    app.get("/api/status", async (c) => {
      try {
        const mcpStatus = this.getMCPStatus?.();

        const statusResponse = {
          ...this.clientInfo,
          mcpConnection: mcpStatus,
        };

        logger.debug("获取状态成功:", statusResponse);
        return c.json(statusResponse);
      } catch (error) {
        logger.error("获取状态失败:", error);
        return c.json(
          {
            error: error instanceof Error ? error.message : String(error),
          },
          500
        );
      }
    });
  }

  /**
   * 更新客户端信息
   * @param info 部分客户端信息
   */
  updateClientInfo(info: Partial<ClientInfo>): void {
    this.clientInfo = { ...this.clientInfo, ...info };
    if (info.lastHeartbeat) {
      this.clientInfo.lastHeartbeat = Date.now();
    }
    logger.debug("客户端信息已更新:", this.clientInfo);
  }

  /**
   * 获取当前客户端信息
   * @returns 客户端信息
   */
  getClientInfo(): ClientInfo {
    return { ...this.clientInfo };
  }

  /**
   * 设置 MCP 状态获取回调
   * @param callback MCP 状态获取函数
   */
  setMCPStatusCallback(callback: () => MCPConnectionStatus | undefined): void {
    this.getMCPStatus = callback;
  }

  /**
   * 重置客户端状态为断开连接
   */
  resetClientStatus(): void {
    this.updateClientInfo({
      status: "disconnected",
      lastHeartbeat: undefined,
    });
  }

  /**
   * 设置客户端为连接状态
   * @param endpoint MCP 端点
   * @param servers 活跃的 MCP 服务器列表
   */
  setClientConnected(endpoint: string, servers: string[] = []): void {
    this.updateClientInfo({
      status: "connected",
      mcpEndpoint: endpoint,
      activeMCPServers: servers,
      lastHeartbeat: Date.now(),
    });
  }

  /**
   * 设置客户端为断开连接状态
   */
  setClientDisconnected(): void {
    this.updateClientInfo({
      status: "disconnected",
    });
  }
}

import type { Context } from "hono";
import type { Logger } from "../Logger.js";
import { logger } from "../Logger.js";
import type { StatusService } from "../services/StatusService.js";

/**
 * 统一响应格式接口
 */
interface ApiErrorResponse {
  error: {
    code: string;
    message: string;
    details?: any;
  };
}

interface ApiSuccessResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
}

/**
 * 状态 API 处理器
 */
export class StatusApiHandler {
  private logger: Logger;
  private statusService: StatusService;

  constructor(statusService: StatusService) {
    this.logger = logger.withTag("StatusApiHandler");
    this.statusService = statusService;
  }

  /**
   * 创建统一的错误响应
   */
  private createErrorResponse(
    code: string,
    message: string,
    details?: any
  ): ApiErrorResponse {
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
  private createSuccessResponse<T>(
    data?: T,
    message?: string
  ): ApiSuccessResponse<T> {
    return {
      success: true,
      data,
      message,
    };
  }

  /**
   * 获取完整状态
   * GET /api/status
   */
  async getStatus(c: Context): Promise<Response> {
    try {
      this.logger.debug("处理获取状态请求");
      const status = this.statusService.getFullStatus();
      this.logger.debug("获取状态成功");
      return c.json(this.createSuccessResponse(status));
    } catch (error) {
      this.logger.error("获取状态失败:", error);
      const errorResponse = this.createErrorResponse(
        "STATUS_READ_ERROR",
        error instanceof Error ? error.message : "获取状态失败"
      );
      return c.json(errorResponse, 500);
    }
  }

  /**
   * 获取客户端状态
   * GET /api/status/client
   */
  async getClientStatus(c: Context): Promise<Response> {
    try {
      this.logger.debug("处理获取客户端状态请求");
      const clientStatus = this.statusService.getClientStatus();
      this.logger.debug("获取客户端状态成功");
      return c.json(this.createSuccessResponse(clientStatus));
    } catch (error) {
      this.logger.error("获取客户端状态失败:", error);
      const errorResponse = this.createErrorResponse(
        "CLIENT_STATUS_READ_ERROR",
        error instanceof Error ? error.message : "获取客户端状态失败"
      );
      return c.json(errorResponse, 500);
    }
  }

  /**
   * 获取重启状态
   * GET /api/status/restart
   */
  async getRestartStatus(c: Context): Promise<Response> {
    try {
      this.logger.debug("处理获取重启状态请求");
      const restartStatus = this.statusService.getRestartStatus();
      this.logger.debug("获取重启状态成功");
      return c.json(this.createSuccessResponse(restartStatus));
    } catch (error) {
      this.logger.error("获取重启状态失败:", error);
      const errorResponse = this.createErrorResponse(
        "RESTART_STATUS_READ_ERROR",
        error instanceof Error ? error.message : "获取重启状态失败"
      );
      return c.json(errorResponse, 500);
    }
  }

  /**
   * 检查客户端是否连接
   * GET /api/status/connected
   */
  async checkClientConnected(c: Context): Promise<Response> {
    try {
      this.logger.debug("处理检查客户端连接请求");
      const connected = this.statusService.isClientConnected();
      this.logger.debug(`客户端连接状态: ${connected}`);
      return c.json(this.createSuccessResponse({ connected }));
    } catch (error) {
      this.logger.error("检查客户端连接失败:", error);
      const errorResponse = this.createErrorResponse(
        "CLIENT_CONNECTION_CHECK_ERROR",
        error instanceof Error ? error.message : "检查客户端连接失败"
      );
      return c.json(errorResponse, 500);
    }
  }

  /**
   * 获取最后心跳时间
   * GET /api/status/heartbeat
   */
  async getLastHeartbeat(c: Context): Promise<Response> {
    try {
      this.logger.debug("处理获取最后心跳时间请求");
      const lastHeartbeat = this.statusService.getLastHeartbeat();
      this.logger.debug("获取最后心跳时间成功");
      return c.json(this.createSuccessResponse({ lastHeartbeat }));
    } catch (error) {
      this.logger.error("获取最后心跳时间失败:", error);
      const errorResponse = this.createErrorResponse(
        "HEARTBEAT_READ_ERROR",
        error instanceof Error ? error.message : "获取最后心跳时间失败"
      );
      return c.json(errorResponse, 500);
    }
  }

  /**
   * 获取活跃的 MCP 服务器列表
   * GET /api/status/mcp-servers
   */
  async getActiveMCPServers(c: Context): Promise<Response> {
    try {
      this.logger.debug("处理获取活跃 MCP 服务器请求");
      const servers = this.statusService.getActiveMCPServers();
      this.logger.debug("获取活跃 MCP 服务器成功");
      return c.json(this.createSuccessResponse({ servers }));
    } catch (error) {
      this.logger.error("获取活跃 MCP 服务器失败:", error);
      const errorResponse = this.createErrorResponse(
        "ACTIVE_MCP_SERVERS_READ_ERROR",
        error instanceof Error ? error.message : "获取活跃 MCP 服务器失败"
      );
      return c.json(errorResponse, 500);
    }
  }

  /**
   * 更新客户端状态
   * PUT /api/status/client
   */
  async updateClientStatus(c: Context): Promise<Response> {
    try {
      this.logger.debug("处理更新客户端状态请求");
      const statusUpdate = await c.req.json();

      // 验证请求体
      if (!statusUpdate || typeof statusUpdate !== "object") {
        const errorResponse = this.createErrorResponse(
          "INVALID_REQUEST_BODY",
          "请求体必须是有效的状态对象"
        );
        return c.json(errorResponse, 400);
      }

      this.statusService.updateClientInfo(statusUpdate, "http-api");
      this.logger.info("客户端状态更新成功");

      return c.json(this.createSuccessResponse(null, "客户端状态更新成功"));
    } catch (error) {
      this.logger.error("更新客户端状态失败:", error);
      const errorResponse = this.createErrorResponse(
        "CLIENT_STATUS_UPDATE_ERROR",
        error instanceof Error ? error.message : "更新客户端状态失败"
      );
      return c.json(errorResponse, 400);
    }
  }

  /**
   * 设置活跃的 MCP 服务器列表
   * PUT /api/status/mcp-servers
   */
  async setActiveMCPServers(c: Context): Promise<Response> {
    try {
      this.logger.debug("处理设置活跃 MCP 服务器请求");
      const { servers } = await c.req.json();

      // 验证请求体
      if (!Array.isArray(servers)) {
        const errorResponse = this.createErrorResponse(
          "INVALID_REQUEST_BODY",
          "servers 必须是字符串数组"
        );
        return c.json(errorResponse, 400);
      }

      this.statusService.setActiveMCPServers(servers);
      this.logger.info("活跃 MCP 服务器设置成功");

      return c.json(
        this.createSuccessResponse(null, "活跃 MCP 服务器设置成功")
      );
    } catch (error) {
      this.logger.error("设置活跃 MCP 服务器失败:", error);
      const errorResponse = this.createErrorResponse(
        "ACTIVE_MCP_SERVERS_UPDATE_ERROR",
        error instanceof Error ? error.message : "设置活跃 MCP 服务器失败"
      );
      return c.json(errorResponse, 400);
    }
  }

  /**
   * 重置状态
   * POST /api/status/reset
   */
  async resetStatus(c: Context): Promise<Response> {
    try {
      this.logger.info("处理重置状态请求");
      this.statusService.reset();
      this.logger.info("状态重置成功");
      return c.json(this.createSuccessResponse(null, "状态重置成功"));
    } catch (error) {
      this.logger.error("重置状态失败:", error);
      const errorResponse = this.createErrorResponse(
        "STATUS_RESET_ERROR",
        error instanceof Error ? error.message : "重置状态失败"
      );
      return c.json(errorResponse, 500);
    }
  }
}

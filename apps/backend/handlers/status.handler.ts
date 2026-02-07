import type { Context } from "hono";
import type { StatusService } from "@/services/status.service.js";
import type { AppContext } from "@/types/hono.context.js";
import { BaseHandler } from "./base.handler.js";

/**
 * 状态 API 处理器
 */
export class StatusApiHandler extends BaseHandler {
  private statusService: StatusService;

  constructor(statusService: StatusService) {
    super();
    this.statusService = statusService;
  }

  /**
   * 获取完整状态
   * GET /api/status
   */
  async getStatus(c: Context<AppContext>): Promise<Response> {
    try {
      c.get("logger").debug("处理获取状态请求");
      const status = this.statusService.getFullStatus();
      c.get("logger").debug("获取状态成功");
      return c.success(status);
    } catch (error) {
      return this.handleError(c, error, "获取状态", "STATUS_READ_ERROR");
    }
  }

  /**
   * 获取客户端状态
   * GET /api/status/client
   */
  async getClientStatus(c: Context<AppContext>): Promise<Response> {
    try {
      c.get("logger").debug("处理获取客户端状态请求");
      const clientStatus = this.statusService.getClientStatus();
      c.get("logger").debug("获取客户端状态成功");
      return c.success(clientStatus);
    } catch (error) {
      return this.handleError(
        c,
        error,
        "获取客户端状态",
        "CLIENT_STATUS_READ_ERROR"
      );
    }
  }

  /**
   * 获取重启状态
   * GET /api/status/restart
   */
  async getRestartStatus(c: Context<AppContext>): Promise<Response> {
    try {
      c.get("logger").debug("处理获取重启状态请求");
      const restartStatus = this.statusService.getRestartStatus();
      c.get("logger").debug("获取重启状态成功");
      return c.success(restartStatus);
    } catch (error) {
      return this.handleError(
        c,
        error,
        "获取重启状态",
        "RESTART_STATUS_READ_ERROR"
      );
    }
  }

  /**
   * 检查客户端是否连接
   * GET /api/status/connected
   */
  async checkClientConnected(c: Context<AppContext>): Promise<Response> {
    try {
      c.get("logger").debug("处理检查客户端连接请求");
      const connected = this.statusService.isClientConnected();
      c.get("logger").debug(`客户端连接状态: ${connected}`);
      return c.success({ connected });
    } catch (error) {
      return this.handleError(
        c,
        error,
        "检查客户端连接",
        "CLIENT_CONNECTION_CHECK_ERROR"
      );
    }
  }

  /**
   * 获取最后心跳时间
   * GET /api/status/heartbeat
   */
  async getLastHeartbeat(c: Context<AppContext>): Promise<Response> {
    try {
      c.get("logger").debug("处理获取最后心跳时间请求");
      const lastHeartbeat = this.statusService.getLastHeartbeat();
      c.get("logger").debug("获取最后心跳时间成功");
      return c.success({ lastHeartbeat });
    } catch (error) {
      return this.handleError(
        c,
        error,
        "获取最后心跳时间",
        "HEARTBEAT_READ_ERROR"
      );
    }
  }

  /**
   * 获取活跃的 MCP 服务器列表
   * GET /api/status/mcp-servers
   */
  async getActiveMCPServers(c: Context<AppContext>): Promise<Response> {
    try {
      c.get("logger").debug("处理获取活跃 MCP 服务器请求");
      const servers = this.statusService.getActiveMCPServers();
      c.get("logger").debug("获取活跃 MCP 服务器成功");
      return c.success({ servers });
    } catch (error) {
      return this.handleError(
        c,
        error,
        "获取活跃 MCP 服务器",
        "ACTIVE_MCP_SERVERS_READ_ERROR"
      );
    }
  }

  /**
   * 更新客户端状态
   * PUT /api/status/client
   */
  async updateClientStatus(c: Context<AppContext>): Promise<Response> {
    try {
      c.get("logger").debug("处理更新客户端状态请求");
      const statusUpdate = await this.parseJsonBody<Record<string, unknown>>(
        c,
        "请求体必须是有效的状态对象"
      );

      // 验证请求体
      if (!statusUpdate || typeof statusUpdate !== "object") {
        return c.fail(
          "INVALID_REQUEST_BODY",
          "请求体必须是有效的状态对象",
          undefined,
          400
        );
      }

      this.statusService.updateClientInfo(statusUpdate, "http-api");
      c.get("logger").info("客户端状态更新成功");

      return c.success(undefined, "客户端状态更新成功");
    } catch (error) {
      return this.handleError(
        c,
        error,
        "更新客户端状态",
        "CLIENT_STATUS_UPDATE_ERROR",
        "更新客户端状态失败",
        400
      );
    }
  }

  /**
   * 设置活跃的 MCP 服务器列表
   * PUT /api/status/mcp-servers
   */
  async setActiveMCPServers(c: Context<AppContext>): Promise<Response> {
    try {
      c.get("logger").debug("处理设置活跃 MCP 服务器请求");
      const { servers } = await this.parseJsonBody<{ servers: string[] }>(
        c,
        "请求体格式错误"
      );

      // 验证请求体
      if (!Array.isArray(servers)) {
        return c.fail(
          "INVALID_REQUEST_BODY",
          "servers 必须是字符串数组",
          undefined,
          400
        );
      }

      this.statusService.setActiveMCPServers(servers);
      c.get("logger").info("活跃 MCP 服务器设置成功");

      return c.success(undefined, "活跃 MCP 服务器设置成功");
    } catch (error) {
      return this.handleError(
        c,
        error,
        "设置活跃 MCP 服务器",
        "ACTIVE_MCP_SERVERS_UPDATE_ERROR",
        "设置活跃 MCP 服务器失败",
        400
      );
    }
  }

  /**
   * 重置状态
   * POST /api/status/reset
   */
  async resetStatus(c: Context<AppContext>): Promise<Response> {
    try {
      c.get("logger").info("处理重置状态请求");
      this.statusService.reset();
      c.get("logger").info("状态重置成功");
      return c.success(undefined, "状态重置成功");
    } catch (error) {
      return this.handleError(c, error, "重置状态", "STATUS_RESET_ERROR");
    }
  }
}

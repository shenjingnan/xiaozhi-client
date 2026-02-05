import type { Logger } from "@/Logger.js";
import { logger } from "@/Logger.js";
import { MCPErrorCode } from "@/errors/mcp-errors.js";
import type { MCPServiceManager } from "@/lib/mcp";
import type { AppContext } from "@/types/hono.context.js";
import type { ConfigManager } from "@xiaozhi-client/config";
import type { Context } from "hono";

import {
  BaseMCPServerHandler,
  type MCPServerStatus,
} from "./mcp-server.handler.js";
import { MCPServerConfigValidator } from "./validators/mcp-server-config.validator.js";

/**
 * MCP 服务列表响应接口
 */
export interface MCPServerListResponse {
  servers: MCPServerStatus[];
  total: number;
}

/**
 * MCP 服务状态处理器
 * 负责获取 MCP 服务器状态和列表
 */
export class MCPServerStatusHandler extends BaseMCPServerHandler {
  protected override logger: Logger;

  constructor(
    mcpServiceManager: MCPServiceManager,
    configManager: ConfigManager
  ) {
    super(mcpServiceManager, configManager);
    this.logger = logger;
  }

  /**
   * 处理获取 MCP 服务状态请求
   * GET /api/mcp-servers/:serverName/status
   */
  async handleStatus(c: Context<AppContext>): Promise<Response> {
    try {
      // 1. 从路径参数获取服务名称
      const serverName = c.req.param("serverName");

      // 2. 验证服务名称
      const nameValidation =
        MCPServerConfigValidator.validateServiceName(serverName);
      if (!nameValidation.isValid) {
        return c.fail(
          MCPErrorCode.INVALID_SERVICE_NAME,
          nameValidation.errors.join(", "),
          { serverName },
          400
        );
      }

      // 3. 检查服务是否存在
      if (
        !MCPServerConfigValidator.checkServiceExists(
          serverName,
          this.configManager
        )
      ) {
        return c.fail(
          MCPErrorCode.SERVER_NOT_FOUND,
          "MCP 服务不存在",
          { serverName },
          404
        );
      }

      // 4. 获取服务状态
      const serviceStatus = this.getServiceStatus(serverName);

      // 5. 返回成功响应
      return c.success(serviceStatus, "MCP 服务状态获取成功");
    } catch (error) {
      this.logger.error("获取 MCP 服务状态失败:", error);

      // 处理不同类型的错误
      if (error instanceof Error) {
        if (error.message.includes("服务不存在")) {
          return c.fail(
            MCPErrorCode.SERVER_NOT_FOUND,
            error.message,
            undefined,
            404
          );
        }
      }

      // 其他未知错误
      return c.fail(
        MCPErrorCode.INTERNAL_ERROR,
        "获取 MCP 服务状态时发生内部错误",
        { error: error instanceof Error ? error.message : String(error) },
        500
      );
    }
  }

  /**
   * 处理列出所有 MCP 服务请求
   * GET /api/mcp-servers
   */
  async handleList(c: Context<AppContext>): Promise<Response> {
    try {
      // 1. 获取所有配置的 MCP 服务
      const config = this.configManager.getConfig();
      const mcpServers = config.mcpServers || {};

      // 2. 构建服务列表
      const servers: MCPServerStatus[] = [];

      for (const [serverName, serverConfig] of Object.entries(mcpServers)) {
        const serviceStatus = this.getServiceStatus(serverName);
        servers.push(serviceStatus);
      }

      // 3. 构建响应数据
      const listResponse: MCPServerListResponse = {
        servers,
        total: servers.length,
      };

      // 4. 返回成功响应
      return c.success(listResponse, "MCP 服务列表获取成功");
    } catch (error) {
      this.logger.error("列出 MCP 服务失败:", error);

      // 其他未知错误
      return c.fail(
        MCPErrorCode.INTERNAL_ERROR,
        "列出 MCP 服务时发生内部错误",
        { error: error instanceof Error ? error.message : String(error) },
        500
      );
    }
  }
}

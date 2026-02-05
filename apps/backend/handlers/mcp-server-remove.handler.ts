import type { Logger } from "@/Logger.js";
import { logger } from "@/Logger.js";
import { MCPErrorCode } from "@/errors/mcp-errors.js";
import type { MCPServiceManager } from "@/lib/mcp";
import { getEventBus } from "@/services/event-bus.service.js";
import type { AppContext } from "@/types/hono.context.js";
import type { ConfigManager } from "@xiaozhi-client/config";
import type { Context } from "hono";

import { BaseMCPServerHandler } from "./mcp-server.handler.js";
import { MCPServerConfigValidator } from "./validators/mcp-server-config.validator.js";

/**
 * MCP 服务移除处理器
 * 负责移除 MCP 服务器
 */
export class MCPServerRemoveHandler extends BaseMCPServerHandler {
  protected override logger: Logger;

  constructor(
    mcpServiceManager: MCPServiceManager,
    configManager: ConfigManager
  ) {
    super(mcpServiceManager, configManager);
    this.logger = logger;
  }

  /**
   * 处理移除 MCP 服务请求
   * DELETE /api/mcp-servers/:serverName
   */
  async handle(c: Context<AppContext>): Promise<Response> {
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

      // 4. 获取服务当前的工具列表（用于事件通知）
      const currentTools = this.getServiceTools(serverName).map(
        (tool) => tool.name
      );

      // 5. 停止服务并清理资源
      try {
        await this.mcpServiceManager.stopService(serverName);
      } catch (error) {
        this.logger.warn(`停止服务 ${serverName} 失败:`, error);
        // 即使停止失败，也继续执行配置移除
      }

      // 6. 移除服务配置
      this.mcpServiceManager.removeServiceConfig(serverName);
      this.configManager.removeMcpServer(serverName);

      // 7. 发送事件通知
      getEventBus().emitEvent("mcp:server:removed", {
        serverName,
        affectedTools: currentTools,
        timestamp: new Date(),
      });

      // 8. 返回成功响应
      return c.success(
        {
          name: serverName,
          operation: "removed",
          affectedTools: currentTools,
        },
        "MCP 服务移除成功"
      );
    } catch (error) {
      this.logger.error("移除 MCP 服务失败:", error);

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

        if (error.message.includes("配置更新")) {
          return c.fail(
            MCPErrorCode.CONFIG_UPDATE_FAILED,
            error.message,
            undefined,
            500
          );
        }
      }

      // 其他未知错误
      return c.fail(
        MCPErrorCode.REMOVE_FAILED,
        "移除 MCP 服务时发生错误",
        { error: error instanceof Error ? error.message : String(error) },
        500
      );
    }
  }
}

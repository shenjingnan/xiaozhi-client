/**
 * MCP 处理器基类
 *
 * 提供所有 MCP 处理器的共享功能：
 * - 错误处理
 * - 日志记录
 * - 服务管理器访问
 * - 配置管理器访问
 */

import type { Logger } from "@/Logger.js";
import { logger } from "@/Logger.js";
import { MCPError, MCPErrorCode } from "@/errors/mcp-errors.js";
import type { MCPServiceManager } from "@/lib/mcp/index.js";
import type { ConfigManager } from "@xiaozhi-client/config";

/**
 * MCP 处理器基类
 * 提供共享的功能和错误处理
 */
export abstract class MCPBaseHandler {
  protected logger: Logger;
  protected mcpServiceManager: MCPServiceManager;
  protected configManager: ConfigManager;

  constructor(
    mcpServiceManager: MCPServiceManager,
    configManager: ConfigManager
  ) {
    this.logger = logger;
    this.mcpServiceManager = mcpServiceManager;
    this.configManager = configManager;
  }

  /**
   * 处理错误并返回 MCPError
   */
  protected handleError(
    error: unknown,
    operation: string,
    context?: Record<string, unknown>
  ): MCPError {
    if (error instanceof MCPError) {
      this.logger.error("MCPError", { error, operation, context });
      return error;
    }

    if (error instanceof Error) {
      let mcpError: MCPError;

      // 根据错误消息和操作类型确定错误类型
      if (
        error.message.includes("服务不存在") ||
        error.message.includes("not found")
      ) {
        mcpError = MCPError.configError(
          MCPErrorCode.SERVER_NOT_FOUND,
          error.message,
          { operation, context }
        );
      } else if (
        error.message.includes("已存在") ||
        error.message.includes("already exists")
      ) {
        mcpError = MCPError.configError(
          MCPErrorCode.SERVER_ALREADY_EXISTS,
          error.message,
          { operation, context }
        );
      } else if (
        error.message.includes("配置") ||
        error.message.includes("config")
      ) {
        mcpError = MCPError.configError(
          MCPErrorCode.INVALID_CONFIG,
          error.message,
          { operation, context }
        );
      } else if (
        error.message.includes("连接") ||
        error.message.includes("connection")
      ) {
        mcpError = MCPError.connectionError(
          MCPErrorCode.CONNECTION_FAILED,
          error.message,
          { operation, context }
        );
      } else {
        mcpError = MCPError.systemError(
          MCPErrorCode.INTERNAL_ERROR,
          error.message,
          { operation, context, stack: error.stack }
        );
      }

      this.logger.error("MCPError", { error: mcpError, operation, context });
      return mcpError;
    }

    // 处理未知错误类型
    const mcpError = MCPError.systemError(
      MCPErrorCode.INTERNAL_ERROR,
      String(error),
      { operation, context }
    );
    this.logger.error("MCPError", { error: mcpError, operation, context });
    return mcpError;
  }
}

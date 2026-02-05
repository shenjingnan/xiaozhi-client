import type { Logger } from "@/Logger.js";
import { logger } from "@/Logger.js";
import { MCPError, MCPErrorCode } from "@/errors/mcp-errors.js";
import type { MCPServiceManager } from "@/lib/mcp";
import type { MCPService } from "@/lib/mcp";
import type { Tool } from "@modelcontextprotocol/sdk/types.js";
import type { ConfigManager, MCPServerConfig } from "@xiaozhi-client/config";

/**
 * MCPServiceManager 扩展接口，用于访问私有属性
 * 这个接口定义了我们需要访问但实际上是私有的属性
 */
interface MCPServiceManagerAccess {
  services: Map<string, MCPService>;
}

/**
 * MCP 服务状态接口
 */
export interface MCPServerStatus {
  name: string;
  status: "connected" | "disconnected" | "connecting" | "error";
  connected: boolean;
  tools: string[];
  lastUpdated?: string;
  config: MCPServerConfig;
}

/**
 * MCP 服务器处理器基类
 * 提供共享的实用方法和错误处理
 */
export abstract class BaseMCPServerHandler {
  protected logger: Logger;
  protected mcpServiceManager: MCPServiceManager;
  protected configManager: ConfigManager;
  protected statusCache: Map<string, MCPServerStatus>;

  constructor(
    mcpServiceManager: MCPServiceManager,
    configManager: ConfigManager
  ) {
    this.logger = logger;
    this.mcpServiceManager = mcpServiceManager;
    this.configManager = configManager;
    this.statusCache = new Map();
  }

  /**
   * 处理错误并返回MCPError
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

  /**
   * 获取服务状态信息
   */
  protected getServiceStatus(serverName: string): MCPServerStatus {
    const config = this.configManager.getConfig();
    const serverConfig = config.mcpServers[serverName];

    if (!serverConfig) {
      return {
        name: serverName,
        status: "disconnected",
        connected: false,
        tools: [],
        config: {} as MCPServerConfig,
      };
    }

    // 尝试从 MCPServiceManager 获取实际状态
    try {
      const managerAccess = this
        .mcpServiceManager as unknown as MCPServiceManagerAccess;
      const service = managerAccess.services.get(serverName);

      if (service?.isConnected?.()) {
        const currentTools = service.getTools().map((tool: Tool) => tool.name);
        const status = {
          name: serverName,
          status: "connected" as const,
          connected: true,
          tools: currentTools,
          lastUpdated: new Date().toISOString(),
          config: serverConfig,
        };

        // 检查状态变化并发出事件
        this.checkAndEmitStatusChange(serverName, status);
        return status;
      }
    } catch (error) {
      this.logger.debug(`获取服务 ${serverName} 状态时出错:`, error);
    }

    const status = {
      name: serverName,
      status: "disconnected" as const,
      connected: false,
      tools: [],
      config: serverConfig,
    };

    // 检查状态变化并发出事件
    this.checkAndEmitStatusChange(serverName, status);
    return status;
  }

  /**
   * 获取服务工具列表
   */
  protected getServiceTools(serverName: string): Tool[] {
    try {
      const managerAccess = this
        .mcpServiceManager as unknown as MCPServiceManagerAccess;
      const service = managerAccess.services.get(serverName);

      if (service?.getTools) {
        return service.getTools();
      }
    } catch (error) {
      this.logger.debug(`获取服务 ${serverName} 工具列表时出错:`, error);
    }

    return [];
  }

  /**
   * 检查状态变化并发出事件
   */
  protected checkAndEmitStatusChange(
    serverName: string,
    newStatus: MCPServerStatus
  ): void {
    // 获取之前的状态（简单的内存缓存）
    const previousStatus = this.getPreviousStatus(serverName);

    if (previousStatus && previousStatus.status !== newStatus.status) {
      this.logger.info(
        `服务 ${serverName} 状态变化: ${previousStatus.status} -> ${newStatus.status}`
      );

      // 发射状态变化事件
      const { getEventBus } = require("@/services/event-bus.service.js");
      getEventBus().emitEvent("mcp:server:status_changed", {
        serverName,
        oldStatus: previousStatus.status,
        newStatus: newStatus.status,
        timestamp: new Date(),
        reason:
          newStatus.status === "connected"
            ? "connection_established"
            : "connection_lost",
      });

      // 如果工具列表发生变化，发出工具更新事件
      if (previousStatus.tools !== newStatus.tools) {
        const addedTools = newStatus.tools.filter(
          (tool) => !previousStatus.tools.includes(tool)
        );
        const removedTools = previousStatus.tools.filter(
          (tool) => !newStatus.tools.includes(tool)
        );

        if (addedTools.length > 0 || removedTools.length > 0) {
          getEventBus().emitEvent("mcp:server:tools:updated", {
            serverName,
            tools: newStatus.tools,
            addedTools,
            removedTools,
            timestamp: new Date(),
          });
        }
      }
    }

    // 更新状态缓存
    this.updateStatusCache(serverName, newStatus);
  }

  /**
   * 获取之前的状态（简化实现）
   */
  private getPreviousStatus(serverName: string): MCPServerStatus | null {
    // 这里使用一个简单的Map来缓存状态
    // 在实际生产环境中，可能需要更持久化的缓存方案
    return this.statusCache.get(serverName) || null;
  }

  /**
   * 更新状态缓存
   */
  private updateStatusCache(serverName: string, status: MCPServerStatus): void {
    this.statusCache.set(serverName, status);
  }
}

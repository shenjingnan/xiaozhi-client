/**
 * MCP 服务状态管理工具
 *
 * 提供服务状态查询和状态变化监控功能
 */

import type { Logger } from "@/Logger.js";
import type { MCPServiceManager } from "@/lib/mcp/index.js";
import type { MCPService } from "@/lib/mcp/index.js";
import { getEventBus } from "@/services/event-bus.service.js";
import type { Tool } from "@modelcontextprotocol/sdk/types.js";
import type { ConfigManager } from "@xiaozhi-client/config";
import type { MCPServerConfig } from "@xiaozhi-client/config";

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
 * MCPServiceManager 扩展接口，用于访问私有属性
 */
interface MCPServiceManagerAccess {
  services: Map<string, MCPService>;
}

/**
 * MCP 服务状态管理器
 */
export class MCPStatusManager {
  private statusCache: Map<string, MCPServerStatus>;

  constructor(
    private logger: Logger,
    private mcpServiceManager: MCPServiceManager,
    private configManager: ConfigManager
  ) {
    this.statusCache = new Map();
  }

  /**
   * 获取服务状态信息
   */
  getServiceStatus(serverName: string): MCPServerStatus {
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
  getServiceTools(serverName: string): Tool[] {
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
  private checkAndEmitStatusChange(
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

/**
 * MCP 状态报告器
 * 负责 MCP 服务状态的聚合和报告
 */

import { logger } from "@/Logger.js";
import { MCPService } from "@/lib/mcp";
import type { CustomMCPHandler } from "@/lib/mcp";
import {
  ConnectionState,
  type ManagerStatus,
  type MCPServiceConnectionStatus,
  type ToolInfo,
  type UnifiedServerConfig,
  type UnifiedServerStatus,
} from "@/lib/mcp/types";
import type { RetryStats } from "./retry-handler";

/**
 * 统计更新监控信息接口
 */
export interface StatsUpdateInfo {
  /** 活跃的锁列表 */
  activeLocks: string[];
  /** 锁总数 */
  totalLocks: number;
}

/**
 * 连接信息接口
 */
export interface ConnectionInfo {
  /** 连接 ID */
  id: string;
  /** 连接名称 */
  name: string;
  /** 连接状态 */
  state: ConnectionState;
}

/**
 * 状态报告器依赖接口
 */
export interface StatusReporterDependencies {
  /** 获取所有服务实例 */
  getAllServices: () => Map<string, MCPService>;
  /** 获取工具缓存 */
  getToolsCache: () => Map<string, ToolInfo>;
  /** 获取 CustomMCP 处理器 */
  getCustomMCPHandler: () => CustomMCPHandler;
  /** 获取重试统计 */
  getRetryStats: () => RetryStats;
  /** 获取统计更新监控信息 */
  getStatsUpdateInfo: () => StatsUpdateInfo;
}

/**
 * MCP 状态报告器类
 * 负责聚合和报告 MCP 服务的各种状态信息
 */
export class StatusReporter {
  private dependencies: StatusReporterDependencies;

  constructor(deps: StatusReporterDependencies) {
    this.dependencies = deps;
  }

  /**
   * 获取管理器状态
   * @returns 管理器状态
   */
  getServiceManagerStatus(): ManagerStatus {
    // 计算总工具数量（包括 customMCP 工具，添加异常处理）
    let customMCPToolCount = 0;
    let customToolNames: string[] = [];

    try {
      customMCPToolCount =
        this.dependencies.getCustomMCPHandler().getToolCount();
      customToolNames =
        this.dependencies.getCustomMCPHandler().getToolNames();
      logger.debug(
        `[StatusReporter] 成功获取 customMCP 状态: ${customMCPToolCount} 个工具`
      );
    } catch (error) {
      logger.warn(
        "[StatusReporter] 获取 CustomMCP 状态失败，将只包含标准 MCP 工具",
        { error }
      );
      // 异常情况下，customMCP 工具数量为0，不影响标准 MCP 工具
      customMCPToolCount = 0;
      customToolNames = [];
    }

    const totalTools =
      this.dependencies.getToolsCache().size + customMCPToolCount;

    // 获取所有可用工具名称
    const standardToolNames = Array.from(
      this.dependencies.getToolsCache().keys()
    );
    const availableTools = [...standardToolNames, ...customToolNames];

    const status: ManagerStatus = {
      services: {},
      totalTools,
      availableTools,
    };

    // 添加标准 MCP 服务状态
    for (const [serviceName, service] of this.dependencies.getAllServices()) {
      const serviceStatus = service.getStatus();
      status.services[serviceName] = {
        connected: serviceStatus.connected,
        clientName: `xiaozhi-${serviceName}-client`,
      };
    }

    // 添加 CustomMCP 服务状态
    if (customMCPToolCount > 0) {
      status.services.customMCP = {
        connected: true, // CustomMCP 工具总是可用的
        clientName: "xiaozhi-customMCP-handler",
      };
    }

    return status;
  }

  /**
   * 获取统一服务器状态
   * @param isRunning 服务器是否正在运行
   * @param config 服务器配置
   * @returns 统一服务器状态
   */
  getUnifiedStatus(
    isRunning: boolean,
    config: UnifiedServerConfig
  ): UnifiedServerStatus {
    const serviceStatus = this.getServiceManagerStatus();
    return {
      isRunning,
      serviceStatus,
      activeConnections: this.getActiveConnectionCount(),
      config,
      // 便捷访问属性
      services: serviceStatus.services,
      totalTools: serviceStatus.totalTools,
      availableTools: serviceStatus.availableTools,
    };
  }

  /**
   * 获取统计更新监控信息
   * @returns 统计更新监控信息
   */
  getStatsUpdateInfo(): StatsUpdateInfo {
    return this.dependencies.getStatsUpdateInfo();
  }

  /**
   * 获取所有连接信息
   * @returns 连接信息列表
   */
  getAllConnections(): ConnectionInfo[] {
    const connections: ConnectionInfo[] = [];

    // 收集服务连接
    for (const [serviceName, service] of this.dependencies.getAllServices()) {
      if (service.isConnected()) {
        connections.push({
          id: `service-${serviceName}`,
          name: serviceName,
          state: ConnectionState.CONNECTED,
        });
      }
    }

    return connections;
  }

  /**
   * 获取活跃连接数
   * @returns 活跃连接数量
   */
  getActiveConnectionCount(): number {
    return this.getAllConnections().filter(
      (conn) => conn.state === ConnectionState.CONNECTED
    ).length;
  }

  /**
   * 获取失败服务列表
   * @returns 失败的服务名称数组
   */
  getFailedServices(): string[] {
    return this.dependencies.getRetryStats().failedServices;
  }

  /**
   * 检查服务是否失败
   * @param serviceName 服务名称
   * @returns 如果服务失败返回true
   */
  isServiceFailed(serviceName: string): boolean {
    return this.dependencies
      .getRetryStats()
      .failedServices.includes(serviceName);
  }

  /**
   * 获取重试统计信息
   * @returns 重试统计信息
   */
  getRetryStats(): RetryStats {
    return this.dependencies.getRetryStats();
  }
}

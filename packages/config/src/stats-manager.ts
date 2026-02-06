/**
 * 配置统计管理器
 * 负责工具使用统计的收集和更新
 */

import type { CustomMCPTool, MCPToolConfig } from "./types.js";
import type { AppConfig } from "./types.js";

/**
 * 工具使用统计信息
 */
export interface ToolUsageStats {
  usageCount?: number;
  lastUsedTime?: string;
}

/**
 * 配置统计管理器
 * 负责管理工具使用统计的更新和查询
 */
export class ConfigStatsManager {
  private statsUpdateLocks: Map<string, Promise<void>> = new Map();
  private statsUpdateLockTimeouts: Map<string, NodeJS.Timeout> = new Map();
  private readonly STATS_UPDATE_TIMEOUT = 5000; // 5秒超时

  /**
   * 更新 MCP 服务工具统计信息
   * @param config 配置对象（会被修改）
   * @param serverName 服务名称
   * @param toolName 工具名称
   * @param callTime 调用时间（ISO 8601 格式）
   * @param incrementUsageCount 是否增加使用计数
   */
  public updateMCPServerToolStats(
    config: AppConfig,
    serverName: string,
    toolName: string,
    callTime: string,
    incrementUsageCount = true
  ): void {
    // 确保 mcpServerConfig 存在
    if (!config.mcpServerConfig) {
      config.mcpServerConfig = {};
    }

    // 确保服务配置存在
    if (!config.mcpServerConfig[serverName]) {
      config.mcpServerConfig[serverName] = { tools: {} };
    }

    // 确保工具配置存在
    if (!config.mcpServerConfig[serverName].tools[toolName]) {
      config.mcpServerConfig[serverName].tools[toolName] = {
        enable: true, // 默认启用
      };
    }

    const toolConfig = config.mcpServerConfig[serverName].tools[toolName];
    const currentUsageCount = toolConfig.usageCount || 0;
    const currentLastUsedTime = toolConfig.lastUsedTime;

    // 根据参数决定是否更新使用次数
    if (incrementUsageCount) {
      toolConfig.usageCount = currentUsageCount + 1;
    }

    // 时间校验：只有新时间晚于现有时间才更新 lastUsedTime
    if (
      !currentLastUsedTime ||
      new Date(callTime) > new Date(currentLastUsedTime)
    ) {
      // 使用 dayjs 格式化时间为更易读的格式
      toolConfig.lastUsedTime = callTime;
    }
  }

  /**
   * 更新 CustomMCP 工具统计信息
   * @param tools CustomMCP 工具数组（会被修改）
   * @param toolName 工具名称
   * @param callTime 调用时间（ISO 8601 格式）
   * @param incrementUsageCount 是否增加使用计数
   */
  public updateCustomMCPToolStats(
    tools: CustomMCPTool[],
    toolName: string,
    callTime: string,
    incrementUsageCount = true
  ): void {
    const toolIndex = tools.findIndex((tool) => tool.name === toolName);

    if (toolIndex === -1) {
      // 如果 customMCP 中没有对应的工具，跳过更新
      return;
    }

    const tool = tools[toolIndex];

    // 确保 stats 对象存在
    if (!tool.stats) {
      tool.stats = {};
    }

    const currentUsageCount = tool.stats.usageCount || 0;
    const currentLastUsedTime = tool.stats.lastUsedTime;

    // 根据参数决定是否更新使用次数
    if (incrementUsageCount) {
      tool.stats.usageCount = currentUsageCount + 1;
    }

    // 时间校验：只有新时间晚于现有时间才更新 lastUsedTime
    if (
      !currentLastUsedTime ||
      new Date(callTime) > new Date(currentLastUsedTime)
    ) {
      tool.stats.lastUsedTime = callTime;
    }
  }

  /**
   * 获取统计更新锁（确保同一工具的统计更新串行执行）
   * @param toolKey 工具键
   */
  public async acquireStatsUpdateLock(toolKey: string): Promise<boolean> {
    if (this.statsUpdateLocks.has(toolKey)) {
      console.log("工具统计更新正在进行中，跳过本次更新", { toolKey });
      return false;
    }

    const updatePromise = new Promise<void>((resolve) => {
      // 锁定逻辑在调用者中实现
    });

    this.statsUpdateLocks.set(toolKey, updatePromise);

    // 设置超时自动释放锁
    const timeout = setTimeout(() => {
      this.releaseStatsUpdateLock(toolKey);
    }, this.STATS_UPDATE_TIMEOUT);

    this.statsUpdateLockTimeouts.set(toolKey, timeout);

    return true;
  }

  /**
   * 释放统计更新锁
   * @param toolKey 工具键
   */
  public releaseStatsUpdateLock(toolKey: string): void {
    this.statsUpdateLocks.delete(toolKey);

    const timeout = this.statsUpdateLockTimeouts.get(toolKey);
    if (timeout) {
      clearTimeout(timeout);
      this.statsUpdateLockTimeouts.delete(toolKey);
    }

    console.log("已释放工具的统计更新锁", { toolKey });
  }

  /**
   * 清理所有统计更新锁（用于异常恢复）
   */
  public clearAllStatsUpdateLocks(): void {
    const lockCount = this.statsUpdateLocks.size;
    this.statsUpdateLocks.clear();

    // 清理所有超时定时器
    for (const timeout of this.statsUpdateLockTimeouts.values()) {
      clearTimeout(timeout);
    }
    this.statsUpdateLockTimeouts.clear();

    if (lockCount > 0) {
      console.log("已清理统计更新锁", { count: lockCount });
    }
  }

  /**
   * 获取统计更新锁状态（用于调试和监控）
   */
  public getStatsUpdateLocks(): string[] {
    return Array.from(this.statsUpdateLocks.keys());
  }
}

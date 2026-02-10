/**
 * 配置统计管理模块
 * 负责工具使用统计信息的管理和并发控制
 */

import { configTools } from "./tools.js";

/**
 * 配置统计管理器
 * 负责工具使用统计信息的管理和并发控制
 */
export class ConfigStats {
  // 统计更新并发控制
  private statsUpdateLocks: Map<string, Promise<void>> = new Map();
  private statsUpdateLockTimeouts: Map<string, NodeJS.Timeout> = new Map();
  private readonly STATS_UPDATE_TIMEOUT = 5000; // 5秒超时

  /**
   * 更新工具使用统计信息（MCP 服务工具）
   * @param serverName 服务名称
   * @param toolName 工具名称
   * @param callTime 调用时间（ISO 8601 格式）
   */
  public async updateToolUsageStats(
    serverName: string,
    toolName: string,
    callTime: string
  ): Promise<void>;

  /**
   * 更新工具使用统计信息（CustomMCP 工具）
   * @param toolName 工具名称（customMCP 工具名称）
   * @param incrementUsageCount 是否增加使用计数，默认为 true
   */
  public async updateToolUsageStats(
    toolName: string,
    incrementUsageCount?: boolean
  ): Promise<void>;

  /**
   * 更新工具使用统计信息的实现
   */
  public async updateToolUsageStats(
    arg1: string,
    arg2: string | boolean | undefined,
    arg3?: string
  ): Promise<void> {
    try {
      // 判断参数类型来区分不同的重载
      if (typeof arg2 === "string" && arg3) {
        // 三个参数的情况：updateToolUsageStats(serverName, toolName, callTime)
        const serverName = arg1;
        const toolName = arg2;
        const callTime = arg3;

        // 双写机制：同时更新 mcpServerConfig 和 customMCP 中的统计信息
        await Promise.all([
          configTools.updateMCPServerToolStats(serverName, toolName, callTime),
          configTools.updateCustomMCPToolStats(serverName, toolName, callTime),
        ]);

        console.log("工具使用统计已更新", { serverName, toolName });
      } else {
        // 两个参数的情况：updateToolUsageStats(toolName, incrementUsageCount)
        const toolName = arg1;
        const incrementUsageCount = arg2 as boolean;
        const callTime = new Date().toISOString();

        // 只更新 customMCP 中的统计信息
        await configTools.updateCustomMCPToolStats(
          toolName,
          callTime,
          incrementUsageCount
        );

        console.log("CustomMCP 工具使用统计已更新", { toolName });
      }
    } catch (error) {
      // 错误不应该影响主要的工具调用流程
      if (typeof arg2 === "string" && arg3) {
        const serverName = arg1;
        const toolName = arg2;
        console.error("更新工具使用统计失败", { serverName, toolName, error });
      } else {
        const toolName = arg1;
        console.error("更新 CustomMCP 工具使用统计失败", {
          toolName,
          error,
        });
      }
    }
  }

  /**
   * 更新 MCP 服务工具统计信息（重载方法）
   * @param serviceName 服务名称
   * @param toolName 工具名称
   * @param callTime 调用时间（ISO 8601 格式）
   * @param incrementUsageCount 是否增加使用计数，默认为 true
   */
  public async updateMCPServerToolStats(
    serviceName: string,
    toolName: string,
    callTime: string,
    incrementUsageCount = true
  ): Promise<void> {
    await configTools.updateMCPServerToolStats(
      serviceName,
      toolName,
      callTime,
      incrementUsageCount
    );
  }

  /**
   * 获取统计更新锁（确保同一工具的统计更新串行执行）
   * @param toolKey 工具键
   * @returns 是否成功获取锁
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
   * 带并发控制的工具统计更新（CustomMCP 工具）
   * @param toolName 工具名称
   * @param incrementUsageCount 是否增加使用计数
   */
  public async updateToolUsageStatsWithLock(
    toolName: string,
    incrementUsageCount = true
  ): Promise<void> {
    const toolKey = `custommcp_${toolName}`;

    if (!(await this.acquireStatsUpdateLock(toolKey))) {
      return; // 已有其他更新在进行
    }

    try {
      await this.updateToolUsageStats(toolName, incrementUsageCount);
      console.log("工具统计更新完成", { toolName });
    } catch (error) {
      console.error("工具统计更新失败", { toolName, error });
      throw error;
    } finally {
      this.releaseStatsUpdateLock(toolKey);
    }
  }

  /**
   * 带并发控制的工具统计更新（MCP 服务工具）
   * @param serviceName 服务名称
   * @param toolName 工具名称
   * @param callTime 调用时间
   * @param incrementUsageCount 是否增加使用计数
   */
  public async updateMCPServerToolStatsWithLock(
    serviceName: string,
    toolName: string,
    callTime: string,
    incrementUsageCount = true
  ): Promise<void> {
    const toolKey = `mcpserver_${serviceName}_${toolName}`;

    if (!(await this.acquireStatsUpdateLock(toolKey))) {
      return; // 已有其他更新在进行
    }

    try {
      await this.updateMCPServerToolStats(
        serviceName,
        toolName,
        callTime,
        incrementUsageCount
      );
      console.log("MCP 服务工具统计更新完成", { serviceName, toolName });
    } catch (error) {
      console.error("MCP 服务工具统计更新失败", {
        serviceName,
        toolName,
        error,
      });
      throw error;
    } finally {
      this.releaseStatsUpdateLock(toolKey);
    }
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
   * @returns 当前锁定的工具键列表
   */
  public getStatsUpdateLocks(): string[] {
    return Array.from(this.statsUpdateLocks.keys());
  }
}

// 导出单例实例
export const configStats = new ConfigStats();

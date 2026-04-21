/**
 * 工具统计管理器
 *
 * 负责工具使用统计信息的更新和管理。
 */

import dayjs from "dayjs";
import type { CoreConfigManager } from "./core-config-manager.js";
import type { CustomMCPToolManager } from "./custom-mcp-tool-manager.js";

/**
 * 工具统计管理类
 * 负责工具使用统计信息的更新和管理
 */
export class ToolStatsManager {
  private coreConfig: CoreConfigManager;
  private customMCPToolManager: CustomMCPToolManager;

  // 统计更新并发控制
  private statsUpdateLocks: Map<string, Promise<void>> = new Map();
  private statsUpdateLockTimeouts: Map<string, NodeJS.Timeout> = new Map();
  private readonly STATS_UPDATE_TIMEOUT = 5000;

  constructor(
    coreConfig: CoreConfigManager,
    customMCPToolManager: CustomMCPToolManager
  ) {
    this.coreConfig = coreConfig;
    this.customMCPToolManager = customMCPToolManager;
  }

  /**
   * 更新工具使用统计信息（MCP 服务工具）
   */
  public async updateToolUsageStats(
    serverName: string,
    toolName: string,
    callTime: string
  ): Promise<void>;

  /**
   * 更新工具使用统计信息（CustomMCP 工具）
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
      if (typeof arg2 === "string" && arg3) {
        const serverName = arg1;
        const toolName = arg2;
        const callTime = arg3;

        await Promise.all([
          this.updateMCPServerToolStatsInternal(serverName, toolName, callTime),
          this.updateCustomMCPToolStatsInternal(serverName, toolName, callTime),
        ]);

        console.log("工具使用统计已更新", { serverName, toolName });
      } else {
        const toolName = arg1;
        const incrementUsageCount = arg2 as boolean;
        const callTime = new Date().toISOString();

        await this.updateCustomMCPToolStatsInternal(
          toolName,
          callTime,
          incrementUsageCount
        );

        console.log("CustomMCP 工具使用统计已更新", { toolName });
      }
    } catch (error) {
      if (typeof arg2 === "string" && arg3) {
        const serverName = arg1;
        const toolName = arg2;
        console.error("更新工具使用统计失败", { serverName, toolName, error });
      } else {
        const toolName = arg1;
        console.error("更新 CustomMCP 工具使用统计失败", { toolName, error });
      }
    }
  }

  /**
   * 更新 MCP 服务工具统计信息
   */
  public async updateMCPServerToolStats(
    serviceName: string,
    toolName: string,
    callTime: string,
    incrementUsageCount = true
  ): Promise<void> {
    await this.updateMCPServerToolStatsInternal(
      serviceName,
      toolName,
      callTime,
      incrementUsageCount
    );
  }

  /**
   * 更新 mcpServerConfig 中的工具使用统计信息（内部实现）
   */
  private async updateMCPServerToolStatsInternal(
    serverName: string,
    toolName: string,
    callTime: string,
    incrementUsageCount = true
  ): Promise<void> {
    const config = this.coreConfig.getMutableConfig();

    if (!config.mcpServerConfig) {
      config.mcpServerConfig = {};
    }

    if (!config.mcpServerConfig[serverName]) {
      config.mcpServerConfig[serverName] = { tools: {} };
    }

    if (!config.mcpServerConfig[serverName].tools[toolName]) {
      config.mcpServerConfig[serverName].tools[toolName] = {
        enable: true,
      };
    }

    const toolConfig = config.mcpServerConfig[serverName].tools[toolName];
    const currentUsageCount = toolConfig.usageCount || 0;
    const currentLastUsedTime = toolConfig.lastUsedTime;

    if (incrementUsageCount) {
      toolConfig.usageCount = currentUsageCount + 1;
    }

    if (
      !currentLastUsedTime ||
      new Date(callTime) > new Date(currentLastUsedTime)
    ) {
      toolConfig.lastUsedTime = dayjs(callTime).format("YYYY-MM-DD HH:mm:ss");
    }

    this.coreConfig.saveConfig(config);
  }

  /**
   * 更新 customMCP 中的工具使用统计信息（服务名+工具名版本）
   */
  private async updateCustomMCPToolStatsInternal(
    serverName: string,
    toolName: string,
    callTime: string
  ): Promise<void>;

  /**
   * 更新 customMCP 中的工具使用统计信息（工具名版本）
   */
  private async updateCustomMCPToolStatsInternal(
    toolName: string,
    callTime: string,
    incrementUsageCount?: boolean
  ): Promise<void>;

  /**
   * 更新 customMCP 工具使用统计信息的实现
   */
  private async updateCustomMCPToolStatsInternal(
    arg1: string,
    arg2: string,
    arg3?: string | boolean
  ): Promise<void> {
    try {
      let toolName: string;
      let callTime: string;
      let incrementUsageCount = true;
      let logPrefix: string;

      if (typeof arg3 === "string") {
        const serverName = arg1;
        toolName = `${serverName}__${arg2}`;
        callTime = arg3;
        logPrefix = `${serverName}/${arg2}`;
      } else {
        toolName = arg1;
        callTime = arg2;
        incrementUsageCount = (arg3 as boolean) ?? true;
        logPrefix = toolName;
      }

      const customTools = this.customMCPToolManager.getCustomMCPTools();
      const toolIndex = customTools.findIndex((tool) => tool.name === toolName);

      if (toolIndex === -1) {
        return;
      }

      const updatedTools = [...customTools];
      const tool = updatedTools[toolIndex];

      if (!tool.stats) {
        tool.stats = {};
      }

      const currentUsageCount = tool.stats.usageCount || 0;
      const currentLastUsedTime = tool.stats.lastUsedTime;

      if (incrementUsageCount) {
        tool.stats.usageCount = currentUsageCount + 1;
      }

      if (
        !currentLastUsedTime ||
        new Date(callTime) > new Date(currentLastUsedTime)
      ) {
        tool.stats.lastUsedTime = dayjs(callTime).format("YYYY-MM-DD HH:mm:ss");
      }

      await this.customMCPToolManager.updateCustomMCPTools(updatedTools);
    } catch (error) {
      if (typeof arg3 === "string") {
        const serverName = arg1;
        const toolName = arg2;
        console.error("更新 customMCP 工具统计信息失败", {
          serverName,
          toolName,
          error,
        });
      } else {
        const toolName = arg1;
        console.error("更新 customMCP 工具统计信息失败", { toolName, error });
      }
    }
  }

  /**
   * 获取统计更新锁
   */
  private async acquireStatsUpdateLock(toolKey: string): Promise<boolean> {
    if (this.statsUpdateLocks.has(toolKey)) {
      console.log("工具统计更新正在进行中，跳过本次更新", { toolKey });
      return false;
    }

    const updatePromise = new Promise<void>(() => {
      // 锁定逻辑在调用者中实现
    });

    this.statsUpdateLocks.set(toolKey, updatePromise);

    const timeout = setTimeout(() => {
      this.releaseStatsUpdateLock(toolKey);
    }, this.STATS_UPDATE_TIMEOUT);

    this.statsUpdateLockTimeouts.set(toolKey, timeout);

    return true;
  }

  /**
   * 释放统计更新锁
   */
  private releaseStatsUpdateLock(toolKey: string): void {
    this.statsUpdateLocks.delete(toolKey);

    const timeout = this.statsUpdateLockTimeouts.get(toolKey);
    if (timeout) {
      clearTimeout(timeout);
    }
    this.statsUpdateLockTimeouts.delete(toolKey);

    console.log("已释放工具的统计更新锁", { toolKey });
  }

  /**
   * 带并发控制的工具统计更新（CustomMCP 工具）
   */
  public async updateToolUsageStatsWithLock(
    toolName: string,
    incrementUsageCount = true
  ): Promise<void> {
    const toolKey = `custommcp_${toolName}`;

    if (!(await this.acquireStatsUpdateLock(toolKey))) {
      return;
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
   */
  public async updateMCPServerToolStatsWithLock(
    serviceName: string,
    toolName: string,
    callTime: string,
    incrementUsageCount = true
  ): Promise<void> {
    const toolKey = `mcpserver_${serviceName}_${toolName}`;

    if (!(await this.acquireStatsUpdateLock(toolKey))) {
      return;
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
   * 清理所有统计更新锁
   */
  public clearAllStatsUpdateLocks(): void {
    const lockCount = this.statsUpdateLocks.size;
    this.statsUpdateLocks.clear();

    for (const timeout of this.statsUpdateLockTimeouts.values()) {
      clearTimeout(timeout);
    }
    this.statsUpdateLockTimeouts.clear();

    if (lockCount > 0) {
      console.log("已清理统计更新锁", { count: lockCount });
    }
  }

  /**
   * 获取统计更新锁状态
   */
  public getStatsUpdateLocks(): string[] {
    return Array.from(this.statsUpdateLocks.keys());
  }
}

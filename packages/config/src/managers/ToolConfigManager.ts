/**
 * 工具配置管理器
 *
 * 负责工具配置和统计信息的管理：
 * - 工具启用/禁用状态管理
 * - 工具使用统计更新
 * - 统计更新并发控制
 */

import dayjs from "dayjs";
import type { AppConfig, MCPToolConfig } from "../types.js";
import { ConfigStore } from "./ConfigStore.js";

/**
 * 工具配置管理器
 */
export class ToolConfigManager {
  private readonly STATS_UPDATE_TIMEOUT = 5000;
  private statsUpdateLocks: Map<string, Promise<void>> = new Map();
  private statsUpdateLockTimeouts: Map<string, NodeJS.Timeout> = new Map();

  constructor(private readonly store: ConfigStore) {}

  /**
   * 检查工具是否启用
   */
  public isToolEnabled(serverName: string, toolName: string): boolean {
    const toolsConfig = this.getServerToolsConfig(serverName);
    const toolConfig = toolsConfig[toolName];
    return toolConfig?.enable !== false;
  }

  /**
   * 设置工具启用状态
   */
  public setToolEnabled(
    serverName: string,
    toolName: string,
    enabled: boolean,
    description?: string
  ): void {
    const config = this.getMutableConfig();

    if (!config.mcpServerConfig) {
      config.mcpServerConfig = {};
    }

    if (!config.mcpServerConfig[serverName]) {
      config.mcpServerConfig[serverName] = { tools: {} };
    }

    config.mcpServerConfig[serverName].tools[toolName] = {
      ...config.mcpServerConfig[serverName].tools[toolName],
      enable: enabled,
      ...(description && { description }),
    };

    this.store.saveConfig(config);
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
          this._updateMCPServerToolStats(serverName, toolName, callTime),
          this.updateCustomMCPToolStats(serverName, toolName, callTime),
        ]);

        console.log("工具使用统计已更新", { serverName, toolName });
      } else {
        const toolName = arg1;
        const incrementUsageCount = arg2 as boolean;
        const callTime = new Date().toISOString();

        await this.updateCustomMCPToolStats(
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
    await this._updateMCPServerToolStats(
      serviceName,
      toolName,
      callTime,
      incrementUsageCount
    );
  }

  /**
   * 更新 MCP 服务工具统计信息（内部实现）
   */
  private async _updateMCPServerToolStats(
    serverName: string,
    toolName: string,
    callTime: string,
    incrementUsageCount = true
  ): Promise<void> {
    const config = this.getMutableConfig();

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

    this.store.saveConfig(config);
  }

  /**
   * 更新 customMCP 中的工具使用统计信息（服务名+工具名版本）
   */
  private async updateCustomMCPToolStats(
    serverName: string,
    toolName: string,
    callTime: string
  ): Promise<void>;

  /**
   * 更新 customMCP 中的工具使用统计信息（工具名版本）
   */
  private async updateCustomMCPToolStats(
    toolName: string,
    callTime: string,
    incrementUsageCount?: boolean
  ): Promise<void>;

  /**
   * 更新 customMCP 工具使用统计信息的实现
   */
  private async updateCustomMCPToolStats(
    arg1: string,
    arg2: string,
    arg3?: string | boolean
  ): Promise<void> {
    try {
      let toolName: string;
      let callTime: string;
      let incrementUsageCount = true;

      if (typeof arg3 === "string") {
        const serverName = arg1;
        toolName = `${serverName}__${arg2}`;
        callTime = arg3;
      } else {
        toolName = arg1;
        callTime = arg2;
        incrementUsageCount = (arg3 as boolean) || true;
      }

      const customTools = this.getCustomMCPTools();
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

      await this.updateCustomMCPTools(updatedTools);
    } catch (error) {
      console.error("更新 customMCP 工具统计信息失败", { error });
    }
  }

  /**
   * 获取统计更新锁状态（用于调试和监控）
   */
  public getStatsUpdateLocks(): string[] {
    return Array.from(this.statsUpdateLocks.keys());
  }

  private getMutableConfig(): AppConfig {
    return (this.store as any).getMutableConfig();
  }

  private getServerToolsConfig(serverName: string): Record<string, MCPToolConfig> {
    const config = this.store.getConfig() as AppConfig;
    return config.mcpServerConfig?.[serverName]?.tools || {};
  }

  private getCustomMCPTools(): Array<{ name: string; stats?: { usageCount?: number; lastUsedTime?: string } }> {
    const config = this.store.getConfig() as AppConfig;
    if (!config.customMCP || !config.customMCP.tools) {
      return [];
    }
    return config.customMCP.tools;
  }

  private async updateCustomMCPTools(tools: Array<{ name: string; stats?: { usageCount?: number; lastUsedTime?: string } }>): Promise<void> {
    const manager = this as unknown as { updateCustomMCPTools: (tools: unknown[]) => Promise<void> };
    if (typeof manager.updateCustomMCPTools === "function") {
      await manager.updateCustomMCPTools(tools);
    }
  }
}

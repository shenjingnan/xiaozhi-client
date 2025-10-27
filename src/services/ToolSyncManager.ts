#!/usr/bin/env node

/**
 * 工具同步管理器
 * 负责 MCP 服务连接完成后将启用的工具同步到 customMCP 配置中
 */

import type { Tool } from "@modelcontextprotocol/sdk/types.js";
import { type Logger, logger } from "../Logger.js";
import type {
  ConfigManager,
  CustomMCPTool,
  MCPToolConfig,
} from "../configManager.js";
import { getEventBus } from "./EventBus.js";

/**
 * 工具同步管理器
 * 实现从 mcpServerConfig 到 customMCP 的自动工具同步
 */
export class ToolSyncManager {
  private configManager: ConfigManager;
  private logger: Logger;
  private syncLocks: Map<string, Promise<void>> = new Map();
  private eventBus = getEventBus();

  constructor(configManager: ConfigManager, customLogger: Logger = logger) {
    this.configManager = configManager;
    this.logger = customLogger.withTag("ToolSync");

    // 设置事件监听器
    this.setupEventListeners();
  }

  /**
   * 设置事件监听器
   */
  private setupEventListeners(): void {
    // 监听配置更新事件
    this.eventBus.onEvent("config:updated", async (data) => {
      await this.handleConfigUpdated(data);
    });

    // 监听MCP服务添加事件
    this.eventBus.onEvent("mcp:server:added", async (data) => {
      await this.handleMCPServerAdded(data);
    });

    // 监听MCP服务移除事件
    this.eventBus.onEvent("mcp:server:removed", async (data) => {
      await this.handleMCPServerRemoved(data);
    });
  }

  /**
   * 处理配置更新事件
   */
  private async handleConfigUpdated(data: {
    type: string;
    serviceName?: string;
    timestamp: Date;
  }): Promise<void> {
    this.logger.debug("检测到配置更新，检查工具同步状态");

    try {
      // 根据更新类型处理不同的同步逻辑
      if (data.type === "customMCP") {
        // customMCP配置更新，通常不需要额外处理，因为CustomMCPHandler会自己处理
        this.logger.debug("customMCP配置已更新，CustomMCPHandler将自动处理");
      } else if (data.type === "serverTools" && data.serviceName) {
        // 特定服务的serverTools配置更新
        await this.handleServerToolsConfigUpdated(data.serviceName);
      } else {
        // 通用配置更新，检查所有已连接的服务
        await this.handleGeneralConfigUpdated();
      }
    } catch (error) {
      this.logger.error("配置更新后的工具同步失败:", error);
    }
  }

  /**
   * 处理serverTools配置更新
   */
  private async handleServerToolsConfigUpdated(
    serviceName: string
  ): Promise<void> {
    this.logger.info(`处理服务 ${serviceName} 的serverTools配置更新`);

    try {
      // 发射事件，让MCPServiceManager处理特定服务的同步检查
      this.eventBus.emitEvent("tool-sync:server-tools-updated", {
        serviceName,
        timestamp: new Date(),
      });
    } catch (error) {
      this.logger.error(`处理服务 ${serviceName} 配置更新失败:`, error);
    }
  }

  /**
   * 处理通用配置更新
   */
  private async handleGeneralConfigUpdated(): Promise<void> {
    this.logger.info("处理通用配置更新，检查所有服务同步状态");

    try {
      // 发射事件，让MCPServiceManager处理所有服务的同步检查
      this.eventBus.emitEvent("tool-sync:general-config-updated", {
        timestamp: new Date(),
      });
    } catch (error) {
      this.logger.error("处理通用配置更新失败:", error);
    }
  }

  /**
   * 处理MCP服务添加事件
   */
  private async handleMCPServerAdded(data: {
    serverName: string;
    config: any;
    tools: string[];
    timestamp: Date;
  }): Promise<void> {
    this.logger.info(`处理MCP服务添加事件: ${data.serverName}`);

    try {
      // 等待服务完全启动并获取工具列表
      setTimeout(async () => {
        await this.triggerServiceToolSync(data.serverName);
      }, 1000); // 给服务1秒时间启动
    } catch (error) {
      this.logger.error(`处理服务 ${data.serverName} 添加事件失败:`, error);
    }
  }

  /**
   * 触发服务工具同步（用于事件驱动的同步）
   * @param serviceName 服务名称
   */
  private async triggerServiceToolSync(serviceName: string): Promise<void> {
    this.logger.info(`触发服务 ${serviceName} 的工具同步`);

    try {
      // 发射事件，请求MCPServiceManager提供该服务的工具列表
      this.eventBus.emitEvent("tool-sync:request-service-tools", {
        serviceName,
        timestamp: new Date(),
      });
    } catch (error) {
      this.logger.error(`触发服务 ${serviceName} 工具同步失败:`, error);
    }
  }

  /**
   * 处理MCP服务移除事件
   */
  private async handleMCPServerRemoved(data: {
    serverName: string;
    affectedTools: string[];
    timestamp: Date;
  }): Promise<void> {
    this.logger.info(`处理MCP服务移除事件: ${data.serverName}`);

    try {
      // 从customMCP中移除该服务的所有工具
      await this.removeServiceToolsFromCustomMCP(
        data.serverName,
        data.affectedTools
      );
    } catch (error) {
      this.logger.error(`处理服务 ${data.serverName} 移除事件失败:`, error);
    }
  }

  /**
   * 从customMCP中移除指定服务的工具
   * @param serviceName 服务名称
   * @param affectedTools 受影响的工具列表
   */
  private async removeServiceToolsFromCustomMCP(
    serviceName: string,
    affectedTools: string[]
  ): Promise<void> {
    this.logger.info(`从customMCP中移除服务 ${serviceName} 的工具`);

    try {
      const existingCustomTools = this.configManager.getCustomMCPTools();

      // 过滤出需要保留的工具（不属于该服务的工具）
      const toolsToKeep = existingCustomTools.filter((tool) => {
        return !tool.name.startsWith(`${serviceName}__`);
      });

      if (toolsToKeep.length === existingCustomTools.length) {
        this.logger.debug(
          `服务 ${serviceName} 的工具不在customMCP中，无需移除`
        );
        return;
      }

      // 更新配置文件
      await this.configManager.updateCustomMCPTools(toolsToKeep);

      const removedCount = existingCustomTools.length - toolsToKeep.length;
      this.logger.info(
        `成功从customMCP中移除服务 ${serviceName} 的 ${removedCount} 个工具`
      );

      // 发射工具移除完成事件
      this.eventBus.emitEvent("tool-sync:service-tools-removed", {
        serviceName,
        removedCount,
        timestamp: new Date(),
      });
    } catch (error) {
      this.logger.error(`移除服务 ${serviceName} 工具失败:`, error);
      throw error;
    }
  }

  /**
   * MCP 服务连接完成后触发工具同步
   * @param serviceName 服务名称
   * @param tools 服务提供的工具列表
   */
  async syncToolsAfterConnection(
    serviceName: string,
    tools: Tool[]
  ): Promise<void> {
    // 防止同一服务的重复同步
    if (this.syncLocks.has(serviceName)) {
      this.logger.debug(`服务 ${serviceName} 正在同步中，跳过`);
      return;
    }

    const syncPromise = this.doSyncTools(serviceName, tools).finally(() => {
      this.syncLocks.delete(serviceName);
    });

    this.syncLocks.set(serviceName, syncPromise);
    await syncPromise;
  }

  /**
   * 实际执行工具同步逻辑
   */
  private async doSyncTools(serviceName: string, tools: Tool[]): Promise<void> {
    try {
      this.logger.info(`开始同步服务 ${serviceName} 的工具`);

      // 1. 检查是否存在对应的 mcpServerConfig 配置
      const serverConfig = this.configManager.getServerToolsConfig(serviceName);
      if (!serverConfig) {
        this.logger.debug(
          `服务 ${serviceName} 无 mcpServerConfig 配置，跳过同步`
        );
        return;
      }

      // 2. 找出需要同步的启用工具
      const enabledTools = this.getEnabledTools(serverConfig, tools);
      if (enabledTools.length === 0) {
        this.logger.debug(`服务 ${serviceName} 无启用工具，跳过同步`);
        return;
      }

      // 3. 检查 customMCP 中的现有工具
      const existingCustomTools = this.configManager.getCustomMCPTools();
      const existingToolNames = new Set(
        existingCustomTools.map((tool) => tool.name)
      );

      // 4. 过滤出需要新增的工具
      const toolsToAdd = enabledTools.filter(
        (tool) => !existingToolNames.has(`${serviceName}__${tool.name}`)
      );

      if (toolsToAdd.length === 0) {
        this.logger.info(
          `服务 ${serviceName} 的启用工具已存在于 customMCP 中，跳过同步`
        );
        return;
      }

      // 5. 添加工具到 customMCP
      await this.addToolsToCustomMCP(serviceName, toolsToAdd);

      this.logger.info(
        `成功同步服务 ${serviceName} 的 ${toolsToAdd.length} 个工具到 customMCP`
      );
    } catch (error) {
      this.logger.error(`同步服务 ${serviceName} 工具失败:`, error);
      // 同步失败不影响正常服务运行，仅记录错误
      this.recordSyncError(serviceName, error);
    }
  }

  /**
   * 获取启用的工具
   */
  private getEnabledTools(
    serverConfig: Record<string, MCPToolConfig>,
    serviceTools: Tool[]
  ): Tool[] {
    const enabledTools: Tool[] = [];

    for (const tool of serviceTools) {
      const toolConfig = serverConfig[tool.name];
      if (toolConfig && toolConfig.enable !== false) {
        enabledTools.push(tool);
      }
    }

    return enabledTools;
  }

  /**
   * 添加工具到 customMCP
   */
  private async addToolsToCustomMCP(
    serviceName: string,
    tools: Tool[]
  ): Promise<void> {
    const customTools: CustomMCPTool[] = tools.map((tool) => ({
      name: `${serviceName}__${tool.name}`,
      description: tool.description || "",
      inputSchema: tool.inputSchema || {},
      handler: {
        type: "mcp",
        config: {
          serviceName,
          toolName: tool.name,
        },
      },
    }));

    // 更新配置文件
    await this.configManager.addCustomMCPTools(customTools);

    // 同步统计信息
    await this.syncToolStats(serviceName, tools);
  }

  /**
   * 记录同步错误
   */
  private recordSyncError(serviceName: string, error: unknown): void {
    const errorInfo = {
      serviceName,
      error: error instanceof Error ? error.message : String(error),
      timestamp: new Date().toISOString(),
      type: error instanceof Error ? error.constructor.name : "UnknownError",
    };

    this.logger.error("同步错误记录:", errorInfo);
  }

  /**
   * 获取同步锁状态（用于调试和监控）
   */
  getSyncLocks(): string[] {
    return Array.from(this.syncLocks.keys());
  }

  /**
   * 清理所有同步锁（用于异常恢复）
   */
  clearSyncLocks(): void {
    this.syncLocks.clear();
    this.logger.debug("已清理所有同步锁");
  }

  /**
   * 同步工具使用统计信息
   * 仅当 customMCP 工具没有统计信息时才从 mcpServerConfig 同步
   * @param serviceName 服务名称
   * @param tools 工具列表
   */
  private async syncToolStats(
    serviceName: string,
    tools: Tool[]
  ): Promise<void> {
    try {
      // 获取 mcpServerConfig 中的工具配置
      const serverConfig = this.configManager.getServerToolsConfig(serviceName);
      if (!serverConfig) {
        this.logger.debug(
          `服务 ${serviceName} 无 mcpServerConfig 配置，跳过统计信息同步`
        );
        return;
      }

      // 获取 customMCP 中的现有工具
      const existingCustomTools = this.configManager.getCustomMCPTools();
      const customToolMap = new Map(
        existingCustomTools.map((tool) => [tool.name, tool])
      );

      // 遍历工具，同步统计信息
      for (const tool of tools) {
        const customToolName = `${serviceName}__${tool.name}`;
        const customTool = customToolMap.get(customToolName);
        const serverToolConfig = serverConfig[tool.name];

        if (customTool && serverToolConfig) {
          // 仅当 customMCP 工具没有统计信息时才同步
          if (
            !customTool.stats ||
            (!customTool.stats.usageCount && !customTool.stats.lastUsedTime)
          ) {
            // 从 mcpServerConfig 获取统计信息
            const stats: any = {};

            if (serverToolConfig.usageCount !== undefined) {
              stats.usageCount = serverToolConfig.usageCount;
            }

            if (serverToolConfig.lastUsedTime) {
              stats.lastUsedTime = serverToolConfig.lastUsedTime;
            }

            if (Object.keys(stats).length > 0) {
              // 更新 customMCP 工具的统计信息
              await this.updateCustomMCPToolStats(customToolName, stats);
              this.logger.debug(
                `已同步工具 ${customToolName} 的统计信息: ${JSON.stringify(
                  stats
                )}`
              );
            }
          }
        }
      }
    } catch (error) {
      this.logger.error(
        `同步服务 ${serviceName} 工具统计信息失败:`,
        error instanceof Error ? error.message : String(error)
      );
      // 统计信息同步失败不应该影响主要的同步流程
    }
  }

  /**
   * 更新 customMCP 工具的统计信息
   * @param toolName 工具名称
   * @param stats 统计信息
   */
  private async updateCustomMCPToolStats(
    toolName: string,
    stats: { usageCount?: number; lastUsedTime?: string }
  ): Promise<void> {
    try {
      const customTools = this.configManager.getCustomMCPTools();
      const toolIndex = customTools.findIndex((tool) => tool.name === toolName);

      if (toolIndex === -1) {
        this.logger.warn(`工具 ${toolName} 不存在于 customMCP 中`);
        return;
      }

      // 更新工具的统计信息
      const updatedTools = [...customTools];
      const tool = updatedTools[toolIndex];

      // 确保 stats 对象存在
      if (!tool.stats) {
        tool.stats = {};
      }

      // 更新统计信息
      if (stats.usageCount !== undefined) {
        tool.stats.usageCount = stats.usageCount;
      }

      if (stats.lastUsedTime !== undefined) {
        tool.stats.lastUsedTime = stats.lastUsedTime;
      }

      // 保存更新后的工具配置
      await this.configManager.updateCustomMCPTools(updatedTools);
    } catch (error) {
      this.logger.error(
        `更新工具 ${toolName} 统计信息失败:`,
        error instanceof Error ? error.message : String(error)
      );
      throw error;
    }
  }
}

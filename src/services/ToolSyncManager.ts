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

/**
 * 工具同步管理器
 * 实现从 mcpServerConfig 到 customMCP 的自动工具同步
 */
export class ToolSyncManager {
  private configManager: ConfigManager;
  private logger: Logger;
  private syncLocks: Map<string, Promise<void>> = new Map();

  constructor(configManager: ConfigManager, customLogger: Logger = logger) {
    this.configManager = configManager;
    this.logger = customLogger.withTag("ToolSync");
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
}

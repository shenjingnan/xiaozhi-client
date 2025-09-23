#!/usr/bin/env node

/**
 * MCP 服务管理器
 * 使用 MCPService 实例管理多个 MCP 服务
 * 专注于实例管理、工具聚合和路由调用
 */

import type { Tool } from "@modelcontextprotocol/sdk/types.js";
import { type Logger, logger } from "../Logger.js";
import { type MCPToolConfig, configManager } from "../configManager.js";
import { CustomMCPHandler } from "./CustomMCPHandler.js";
import { getEventBus } from "./EventBus.js";
import { MCPCacheManager } from "./MCPCacheManager.js";
import {
  MCPService,
  type MCPServiceConfig,
  MCPTransportType,
} from "./MCPService.js";
import { ToolSyncManager } from "./ToolSyncManager.js";

// 工具信息接口（保持向后兼容）
interface ToolInfo {
  serviceName: string;
  originalName: string;
  tool: Tool;
}

// 服务状态接口（保持向后兼容）
interface ServiceStatus {
  connected: boolean;
  clientName: string;
}

// 管理器状态接口（保持向后兼容）
interface ManagerStatus {
  services: Record<string, ServiceStatus>;
  totalTools: number;
  availableTools: string[];
}

// 工具调用结果接口（保持向后兼容）
interface ToolCallResult {
  content: Array<{
    type: string;
    text: string;
  }>;
  isError?: boolean;
}

export class MCPServiceManager {
  private services: Map<string, MCPService> = new Map();
  private configs: Record<string, MCPServiceConfig> = {};
  private logger: Logger;
  private tools: Map<string, ToolInfo> = new Map(); // 缓存工具信息，保持向后兼容
  private customMCPHandler: CustomMCPHandler; // CustomMCP 工具处理器
  private cacheManager: MCPCacheManager; // 缓存管理器
  private toolSyncManager: ToolSyncManager; // 工具同步管理器
  private eventBus = getEventBus(); // 事件总线

  // 防抖相关属性
  private reconnectDebounceTimer: NodeJS.Timeout | null = null;
  private isReconnecting = false;

  /**
   * 创建 MCPServiceManager 实例
   * @param configs 可选的初始服务配置
   */
  constructor(configs?: Record<string, MCPServiceConfig>) {
    this.logger = logger;
    this.configs = configs || {};

    // 在测试环境中使用临时目录，避免在项目根目录创建缓存文件
    const isTestEnv =
      process.env.NODE_ENV === "test" || process.env.VITEST === "true";
    const cachePath = isTestEnv
      ? `/tmp/xiaozhi-test-${Date.now()}-${Math.random().toString(36).substring(2, 11)}/xiaozhi.cache.json`
      : undefined;

    this.cacheManager = new MCPCacheManager(cachePath);
    this.customMCPHandler = new CustomMCPHandler();
    this.toolSyncManager = new ToolSyncManager(configManager, this.logger);

    // 设置事件监听器
    this.setupEventListeners();
  }

  /**
   * 设置事件监听器
   */
  private setupEventListeners(): void {
    // 监听MCP服务连接成功事件
    this.eventBus.onEvent("mcp:service:connected", async (data) => {
      await this.handleServiceConnected(data);
    });

    // 监听MCP服务断开连接事件
    this.eventBus.onEvent("mcp:service:disconnected", async (data) => {
      await this.handleServiceDisconnected(data);
    });

    // 监听MCP服务连接失败事件
    this.eventBus.onEvent("mcp:service:connection:failed", async (data) => {
      await this.handleServiceConnectionFailed(data);
    });

    // 监听工具同步相关事件
    this.eventBus.onEvent("tool-sync:server-tools-updated", async (data) => {
      await this.handleServerToolsUpdated(data);
    });

    this.eventBus.onEvent("tool-sync:general-config-updated", async (data) => {
      await this.handleGeneralConfigUpdated(data);
    });
  }

  /**
   * 处理MCP服务连接成功事件
   */
  private async handleServiceConnected(data: {
    serviceName: string;
    tools: Tool[];
    connectionTime: Date;
  }): Promise<void> {
    this.logger.info(`服务 ${data.serviceName} 连接成功，开始工具同步`);

    try {
      // 获取最新的工具列表
      const service = this.services.get(data.serviceName);
      if (service) {
        const tools = service.getTools();

        // 触发工具同步
        if (this.toolSyncManager) {
          await this.toolSyncManager.syncToolsAfterConnection(
            data.serviceName,
            tools
          );
        }

        // 重新初始化CustomMCPHandler
        await this.refreshCustomMCPHandlerPublic();

        // 触发小智接入点重连，确保新服务的工具能被正确获取
        await this.scheduleReconnect();

        this.logger.info(`服务 ${data.serviceName} 工具同步完成`);
      }
    } catch (error) {
      this.logger.error(`同步服务 ${data.serviceName} 工具失败:`, error);
    }
  }

  /**
   * 处理MCP服务断开连接事件
   */
  private async handleServiceDisconnected(data: {
    serviceName: string;
    reason?: string;
    disconnectionTime: Date;
  }): Promise<void> {
    this.logger.info(
      `服务 ${data.serviceName} 断开连接，原因: ${data.reason || "未知"}`
    );

    try {
      // 更新工具缓存
      await this.refreshToolsCache();

      // 重新初始化CustomMCPHandler
      await this.refreshCustomMCPHandlerPublic();

      this.logger.info(`服务 ${data.serviceName} 断开连接处理完成`);
    } catch (error) {
      this.logger.error(`服务 ${data.serviceName} 断开连接处理失败:`, error);
    }
  }

  /**
   * 处理MCP服务连接失败事件
   */
  private async handleServiceConnectionFailed(data: {
    serviceName: string;
    error: Error;
    attempt: number;
  }): Promise<void> {
    this.logger.warn(
      `服务 ${data.serviceName} 连接失败 (尝试 ${data.attempt})，错误: ${data.error.message}`
    );

    // 连接失败时，确保CustomMCPHandler仍然使用最新的可用工具
    try {
      await this.refreshCustomMCPHandlerPublic();
    } catch (error) {
      this.logger.error("刷新CustomMCPHandler失败:", error);
    }
  }

  /**
   * 处理serverTools配置更新事件
   */
  private async handleServerToolsUpdated(data: {
    serviceName: string;
    timestamp: Date;
  }): Promise<void> {
    this.logger.info(`处理服务 ${data.serviceName} 的serverTools配置更新`);

    try {
      const service = this.services.get(data.serviceName);
      if (service?.isConnected()) {
        const tools = service.getTools();

        // 重新同步该服务的工具
        if (this.toolSyncManager) {
          await this.toolSyncManager.syncToolsAfterConnection(
            data.serviceName,
            tools
          );
        }

        // 刷新CustomMCPHandler
        await this.refreshCustomMCPHandlerPublic();

        this.logger.info(`服务 ${data.serviceName} 配置更新同步完成`);
      }
    } catch (error) {
      this.logger.error(`处理服务 ${data.serviceName} 配置更新失败:`, error);
    }
  }

  /**
   * 处理通用配置更新事件
   */
  private async handleGeneralConfigUpdated(data: {
    timestamp: Date;
  }): Promise<void> {
    this.logger.info("处理通用配置更新，检查所有已连接服务");

    try {
      // 检查所有已连接的服务
      for (const [serviceName, service] of this.services) {
        if (service.isConnected()) {
          const tools = service.getTools();

          // 重新同步每个服务的工具
          if (this.toolSyncManager) {
            await this.toolSyncManager.syncToolsAfterConnection(
              serviceName,
              tools
            );
          }
        }
      }

      // 刷新CustomMCPHandler
      await this.refreshCustomMCPHandlerPublic();

      this.logger.info("通用配置更新同步完成");
    } catch (error) {
      this.logger.error("处理通用配置更新失败:", error);
    }
  }

  /**
   * 启动所有 MCP 服务
   */
  async startAllServices(): Promise<void> {
    this.logger.info("[MCPManager] 正在启动所有 MCP 服务...");

    // 初始化 CustomMCP 处理器
    try {
      this.customMCPHandler.initialize();
      this.logger.info("[MCPManager] CustomMCP 处理器初始化完成");
    } catch (error) {
      this.logger.error("[MCPManager] CustomMCP 处理器初始化失败:", error);
      // CustomMCP 初始化失败不应该阻止标准 MCP 服务启动
    }

    const configEntries = Object.entries(this.configs);
    if (configEntries.length === 0) {
      this.logger.warn(
        "[MCPManager] 没有配置任何 MCP 服务，请使用 addServiceConfig() 添加服务配置"
      );
      // 即使没有标准 MCP 服务，也可能有 CustomMCP 工具
      return;
    }

    for (const [serviceName] of configEntries) {
      await this.startService(serviceName);
    }

    this.logger.info("[MCPManager] 所有 MCP 服务启动完成");
  }

  /**
   * 启动单个 MCP 服务
   */
  async startService(serviceName: string): Promise<void> {
    this.logger.info(`[MCPManager] 启动 MCP 服务: ${serviceName}`);

    const config = this.configs[serviceName];
    if (!config) {
      throw new Error(`未找到服务配置: ${serviceName}`);
    }

    try {
      // 如果服务已存在，先停止它
      if (this.services.has(serviceName)) {
        await this.stopService(serviceName);
      }

      // 创建 MCPService 实例
      const service = new MCPService(config);

      // 连接到服务
      await service.connect();

      // 存储服务实例
      this.services.set(serviceName, service);

      // 更新工具缓存
      await this.refreshToolsCache();

      // 注意：工具同步现在通过事件监听器自动处理，不需要在这里手动调用
      // MCPService.connect() 成功后会发射 mcp:service:connected 事件
      // 事件监听器会自动触发工具同步和CustomMCPHandler刷新

      const tools = service.getTools();
      this.logger.info(
        `[MCPManager] ${serviceName} 服务启动成功，加载了 ${tools.length} 个工具:`,
        tools.map((t) => t.name).join(", ")
      );
    } catch (error) {
      this.logger.error(
        `[MCPManager] 启动 ${serviceName} 服务失败:`,
        (error as Error).message
      );
      throw error;
    }
  }

  /**
   * 停止单个服务
   */
  async stopService(serviceName: string): Promise<void> {
    this.logger.info(`[MCPManager] 停止 MCP 服务: ${serviceName}`);

    const service = this.services.get(serviceName);
    if (!service) {
      this.logger.warn(`[MCPManager] 服务 ${serviceName} 不存在或未启动`);
      return;
    }

    try {
      await service.disconnect();
      this.services.delete(serviceName);

      // 更新工具缓存
      await this.refreshToolsCache();

      this.logger.info(`[MCPManager] ${serviceName} 服务已停止`);
    } catch (error) {
      this.logger.error(
        `[MCPManager] 停止 ${serviceName} 服务失败:`,
        (error as Error).message
      );
      throw error;
    }
  }

  /**
   * 刷新工具缓存
   */
  private async refreshToolsCache(): Promise<void> {
    this.tools.clear();

    for (const [serviceName, service] of this.services) {
      if (service.isConnected()) {
        const tools = service.getTools();
        const config = this.configs[serviceName];

        // 异步写入缓存（不阻塞主流程）
        if (config) {
          this.cacheManager
            .writeCacheEntry(serviceName, tools, config)
            .then(() => {
              this.logger.debug(
                `[MCPManager] 已将 ${serviceName} 工具列表写入缓存`
              );
            })
            .catch((error) => {
              this.logger.warn(
                `[MCPManager] 写入缓存失败: ${serviceName}, 错误: ${
                  error instanceof Error ? error.message : String(error)
                }`
              );
            });
        }

        // 原有逻辑保持不变
        for (const tool of tools) {
          const toolKey = `${serviceName}__${tool.name}`;
          this.tools.set(toolKey, {
            serviceName,
            originalName: tool.name,
            tool,
          });
        }
      }
    }

    // 同步工具配置到配置文件
    await this.syncToolsConfigToFile();
  }

  /**
   * 获取所有可用工具（优化版本，移除阻塞逻辑，添加工具启用状态过滤）
   */
  getAllTools(): Array<{
    name: string;
    description: string;
    inputSchema: any;
    serviceName: string;
    originalName: string;
  }> {
    const allTools: Array<{
      name: string;
      description: string;
      inputSchema: any;
      serviceName: string;
      originalName: string;
    }> = [];

    // 1. 收集所有已连接服务的工具（包含启用状态过滤）
    for (const [serviceName, service] of this.services) {
      if (service.isConnected()) {
        const serviceTools = service.getTools();
        for (const tool of serviceTools) {
          // 检查工具启用状态 - 这个调用可能会抛出异常
          const isEnabled = configManager.isToolEnabled(serviceName, tool.name);
          if (!isEnabled) {
            continue; // 跳过禁用的工具
          }

          const toolKey = `${serviceName}__${tool.name}`;
          allTools.push({
            name: toolKey,
            description: tool.description || "",
            inputSchema: tool.inputSchema,
            serviceName,
            originalName: tool.name,
          });
        }
      }
    }

    // 2. 添加CustomMCP工具（添加异常处理确保优雅降级）
    let customTools: any[] = [];
    try {
      customTools = this.customMCPHandler.getTools();
      this.logger.debug(
        `[MCPManager] 成功获取 ${customTools.length} 个 customMCP 工具`
      );
    } catch (error) {
      this.logger.warn(
        "[MCPManager] 获取 CustomMCP 工具失败，将只返回标准 MCP 工具:",
        error
      );
      // 根据技术方案要求，CustomMCP 工具获取失败时不应该影响标准 MCP 工具的返回
      customTools = [];
    }

    for (const tool of customTools) {
      allTools.push({
        name: tool.name,
        description: tool.description || "",
        inputSchema: tool.inputSchema,
        serviceName: this.getServiceNameForTool(tool),
        originalName: tool.name,
      });
    }

    this.logger.info(
      `[MCPManager] 返回 ${allTools.length} 个工具 (服务工具: ${allTools.length - customTools.length}, customMCP工具: ${customTools.length})`
    );

    return allTools;
  }

  /**
   * 根据工具配置确定服务名称
   * @param tool 工具对象
   * @returns 服务名称
   */
  private getServiceNameForTool(tool: any): string {
    if (tool.handler?.type === "mcp") {
      // 如果是从 MCP 同步的工具，返回原始服务名称
      return tool.handler.config.serviceName;
    }
    return "customMCP";
  }

  /**
   * 调用 MCP 工具（支持标准 MCP 工具和 customMCP 工具）
   */
  async callTool(toolName: string, arguments_: any): Promise<ToolCallResult> {
    this.logger.info(`[MCPManager] 调用工具: ${toolName}，参数:`, arguments_);

    // 检查是否是 customMCP 工具
    if (this.customMCPHandler.hasTool(toolName)) {
      // 检查是否是从 MCP 同步的工具（mcp 类型 handler）
      const customTool = this.customMCPHandler.getToolInfo(toolName);
      if (customTool?.handler?.type === "mcp") {
        // 对于 mcp 类型的工具，直接路由到对应的 MCP 服务
        try {
          const result = await this.callMCPTool(
            toolName,
            customTool.handler.config,
            arguments_
          );

          // 异步更新工具调用统计（成功调用）
          this.updateToolStats(
            toolName,
            customTool.handler.config.serviceName,
            customTool.handler.config.toolName,
            true
          ).catch((error) => {
            this.logger.warn(
              `[MCPManager] 更新工具 ${toolName} 统计信息失败:`,
              error
            );
          });

          return result;
        } catch (error) {
          // 异步更新工具调用统计（失败调用）
          this.updateToolStatsForFailedCall(
            toolName,
            customTool.handler.config.serviceName,
            customTool.handler.config.toolName,
            error
          ).catch((updateError) => {
            this.logger.warn(
              `[MCPManager] 更新工具 ${toolName} 失败统计信息失败:`,
              updateError
            );
          });
          throw error;
        }
      }

      // 其他类型的 customMCP 工具正常处理
      try {
        const result = await this.customMCPHandler.callTool(
          toolName,
          arguments_
        );

        // 异步更新工具调用统计（成功调用）
        this.updateToolStats(toolName, "customMCP", toolName, true).catch(
          (error) => {
            this.logger.warn(
              `[MCPManager] 更新 customMCP 工具 ${toolName} 统计信息失败:`,
              error
            );
          }
        );

        this.logger.info(`[MCPManager] CustomMCP 工具 ${toolName} 调用成功`);
        return result;
      } catch (error) {
        // 异步更新工具调用统计（失败调用）
        this.updateToolStatsForFailedCall(
          toolName,
          "customMCP",
          toolName,
          error
        ).catch((updateError) => {
          this.logger.warn(
            `[MCPManager] 更新 customMCP 工具 ${toolName} 失败统计信息失败:`,
            updateError
          );
        });

        this.logger.error(
          `[MCPManager] CustomMCP 工具 ${toolName} 调用失败:`,
          (error as Error).message
        );
        throw error;
      }
    }

    // 如果不是 customMCP 工具，则查找标准 MCP 工具
    const toolInfo = this.tools.get(toolName);
    if (!toolInfo) {
      throw new Error(`未找到工具: ${toolName}`);
    }

    const service = this.services.get(toolInfo.serviceName);
    if (!service) {
      throw new Error(`服务 ${toolInfo.serviceName} 不可用`);
    }

    if (!service.isConnected()) {
      throw new Error(`服务 ${toolInfo.serviceName} 未连接`);
    }

    try {
      const result = await service.callTool(
        toolInfo.originalName,
        arguments_ || {}
      );

      // 异步更新工具调用统计（成功调用）
      this.updateToolStats(
        toolName,
        toolInfo.serviceName,
        toolInfo.originalName,
        true
      ).catch((error) => {
        this.logger.warn(
          `[MCPManager] 更新工具 ${toolName} 统计信息失败:`,
          error
        );
      });

      this.logger.info(`[MCPManager] 工具 ${toolName} 调用成功，结果:`, result);
      return result as ToolCallResult;
    } catch (error) {
      // 异步更新工具调用统计（失败调用）
      this.updateToolStatsForFailedCall(
        toolName,
        toolInfo.serviceName,
        toolInfo.originalName,
        error
      ).catch((updateError) => {
        this.logger.warn(
          `[MCPManager] 更新工具 ${toolName} 失败统计信息失败:`,
          updateError
        );
      });

      this.logger.error(
        `[MCPManager] 工具 ${toolName} 调用失败:`,
        (error as Error).message
      );
      throw error;
    }
  }

  /**
   * 更新工具调用统计信息（成功调用）
   * @param toolName 工具名称
   * @param serviceName 服务名称
   * @param originalToolName 原始工具名称
   * @param isSuccess 是否调用成功
   * @private
   */
  private async updateToolStats(
    toolName: string,
    serviceName: string,
    originalToolName: string,
    isSuccess: boolean
  ): Promise<void> {
    try {
      if (!isSuccess) {
        return; // 失败调用由 updateToolStatsForFailedCall 处理
      }

      const currentTime = new Date().toISOString();

      // 更新 customMCP 配置中的统计信息
      await this.updateCustomMCPToolStats(toolName, currentTime);

      // 如果是 MCP 服务工具，同时更新 mcpServerConfig 配置（双写机制）
      if (serviceName !== "customMCP") {
        await this.updateMCPServerToolStats(
          serviceName,
          originalToolName,
          currentTime
        );
      }

      this.logger.debug(`[MCPManager] 已更新工具 ${toolName} 的统计信息`);
    } catch (error) {
      this.logger.error(
        `[MCPManager] 更新工具 ${toolName} 统计信息失败:`,
        error
      );
      throw error;
    }
  }

  /**
   * 更新工具调用统计信息（失败调用）
   * @param toolName 工具名称
   * @param serviceName 服务名称
   * @param originalToolName 原始工具名称
   * @param error 调用错误
   * @private
   */
  private async updateToolStatsForFailedCall(
    toolName: string,
    serviceName: string,
    originalToolName: string,
    error: unknown
  ): Promise<void> {
    try {
      // 对于失败的调用，我们只更新最后使用时间，不增加使用次数
      const currentTime = new Date().toISOString();

      // 更新 customMCP 配置中的最后使用时间
      await this.updateCustomMCPToolLastUsedTime(toolName, currentTime);

      // 如果是 MCP 服务工具，同时更新 mcpServerConfig 配置（双写机制）
      if (serviceName !== "customMCP") {
        await this.updateMCPServerToolLastUsedTime(
          serviceName,
          originalToolName,
          currentTime
        );
      }

      this.logger.debug(
        `[MCPManager] 已更新工具 ${toolName} 的失败调用统计信息`
      );
    } catch (updateError) {
      this.logger.error(
        `[MCPManager] 更新工具 ${toolName} 失败调用统计信息失败:`,
        updateError
      );
      throw updateError;
    }
  }

  /**
   * 更新 customMCP 工具统计信息
   * @param toolName 工具名称
   * @param currentTime 当前时间
   * @private
   */
  private async updateCustomMCPToolStats(
    toolName: string,
    currentTime: string
  ): Promise<void> {
    try {
      await configManager.updateToolUsageStatsWithLock(toolName, true);
      this.logger.debug(
        `[MCPManager] 已更新 customMCP 工具 ${toolName} 使用统计`
      );
    } catch (error) {
      this.logger.error(
        `[MCPManager] 更新 customMCP 工具 ${toolName} 统计失败:`,
        error
      );
      throw error;
    }
  }

  /**
   * 更新 customMCP 工具最后使用时间
   * @param toolName 工具名称
   * @param currentTime 当前时间
   * @private
   */
  private async updateCustomMCPToolLastUsedTime(
    toolName: string,
    currentTime: string
  ): Promise<void> {
    try {
      await configManager.updateToolUsageStatsWithLock(toolName, false); // 只更新时间，不增加计数
      this.logger.debug(
        `[MCPManager] 已更新 customMCP 工具 ${toolName} 最后使用时间`
      );
    } catch (error) {
      this.logger.error(
        `[MCPManager] 更新 customMCP 工具 ${toolName} 最后使用时间失败:`,
        error
      );
      throw error;
    }
  }

  /**
   * 更新 MCP 服务工具统计信息
   * @param serviceName 服务名称
   * @param toolName 工具名称
   * @param currentTime 当前时间
   * @private
   */
  private async updateMCPServerToolStats(
    serviceName: string,
    toolName: string,
    currentTime: string
  ): Promise<void> {
    try {
      await configManager.updateMCPServerToolStatsWithLock(
        serviceName,
        toolName,
        currentTime,
        true
      );
      this.logger.debug(
        `[MCPManager] 已更新 MCP 服务工具 ${serviceName}/${toolName} 统计`
      );
    } catch (error) {
      this.logger.error(
        `[MCPManager] 更新 MCP 服务工具 ${serviceName}/${toolName} 统计失败:`,
        error
      );
      throw error;
    }
  }

  /**
   * 更新 MCP 服务工具最后使用时间
   * @param serviceName 服务名称
   * @param toolName 工具名称
   * @param currentTime 当前时间
   * @private
   */
  private async updateMCPServerToolLastUsedTime(
    serviceName: string,
    toolName: string,
    currentTime: string
  ): Promise<void> {
    try {
      await configManager.updateMCPServerToolStatsWithLock(
        serviceName,
        toolName,
        currentTime,
        false
      ); // 只更新时间，不增加计数
      this.logger.debug(
        `[MCPManager] 已更新 MCP 服务工具 ${serviceName}/${toolName} 最后使用时间`
      );
    } catch (error) {
      this.logger.error(
        `[MCPManager] 更新 MCP 服务工具 ${serviceName}/${toolName} 最后使用时间失败:`,
        error
      );
      throw error;
    }
  }

  /**
   * 调用 MCP 工具（用于从 mcpServerConfig 同步的工具）
   * @param toolName 工具名称
   * @param config MCP handler 配置
   * @param arguments_ 工具参数
   */
  private async callMCPTool(
    toolName: string,
    config: { serviceName: string; toolName: string },
    arguments_: any
  ): Promise<ToolCallResult> {
    const { serviceName, toolName: originalToolName } = config;

    this.logger.info(
      `[MCPManager] 调用 MCP 同步工具 ${toolName} -> ${serviceName}.${originalToolName}`
    );

    const service = this.services.get(serviceName);
    if (!service) {
      throw new Error(`服务 ${serviceName} 不可用`);
    }

    if (!service.isConnected()) {
      throw new Error(`服务 ${serviceName} 未连接`);
    }

    try {
      const result = await service.callTool(originalToolName, arguments_ || {});
      this.logger.info(`[MCPManager] MCP 同步工具 ${toolName} 调用成功`);
      return result as ToolCallResult;
    } catch (error) {
      this.logger.error(
        `[MCPManager] MCP 同步工具 ${toolName} 调用失败:`,
        (error as Error).message
      );
      throw error;
    }
  }

  /**
   * 检查是否存在指定工具（包括标准 MCP 工具和 customMCP 工具）
   */
  hasTool(toolName: string): boolean {
    // 检查是否是 customMCP 工具
    if (this.customMCPHandler.hasTool(toolName)) {
      return true;
    }

    // 检查是否是标准 MCP 工具
    return this.tools.has(toolName);
  }

  /**
   * 停止所有服务
   */
  async stopAllServices(): Promise<void> {
    this.logger.info("[MCPManager] 正在停止所有 MCP 服务...");

    // 停止所有服务实例
    for (const [serviceName, service] of this.services) {
      try {
        await service.disconnect();
        this.logger.info(`[MCPManager] ${serviceName} 服务已停止`);
      } catch (error) {
        this.logger.error(
          `[MCPManager] 停止 ${serviceName} 服务失败:`,
          (error as Error).message
        );
      }
    }

    // 清理 CustomMCP 处理器
    try {
      this.customMCPHandler.cleanup();
      this.logger.info("[MCPManager] CustomMCP 处理器已清理");
    } catch (error) {
      this.logger.error("[MCPManager] CustomMCP 处理器清理失败:", error);
    }

    // 清理统计更新锁
    try {
      configManager.clearAllStatsUpdateLocks();
      this.logger.info("[MCPManager] 统计更新锁已清理");
    } catch (error) {
      this.logger.error("[MCPManager] 清理统计更新锁失败:", error);
    }

    // 清理防抖定时器
    if (this.reconnectDebounceTimer) {
      clearTimeout(this.reconnectDebounceTimer);
      this.reconnectDebounceTimer = null;
      this.logger.info("[MCPManager] 防抖定时器已清理");
    }

    this.services.clear();
    this.tools.clear();

    this.logger.info("[MCPManager] 所有 MCP 服务已停止");
  }

  /**
   * 获取服务状态
   */
  getStatus(): ManagerStatus {
    // 计算总工具数量（包括 customMCP 工具，添加异常处理）
    let customMCPToolCount = 0;
    let customToolNames: string[] = [];

    try {
      customMCPToolCount = this.customMCPHandler.getToolCount();
      customToolNames = this.customMCPHandler.getToolNames();
      this.logger.debug(
        `[MCPManager] 成功获取 customMCP 状态: ${customMCPToolCount} 个工具`
      );
    } catch (error) {
      this.logger.warn(
        "[MCPManager] 获取 CustomMCP 状态失败，将只包含标准 MCP 工具:",
        error
      );
      // 异常情况下，customMCP 工具数量为0，不影响标准 MCP 工具
      customMCPToolCount = 0;
      customToolNames = [];
    }

    const totalTools = this.tools.size + customMCPToolCount;

    // 获取所有可用工具名称
    const standardToolNames = Array.from(this.tools.keys());
    const availableTools = [...standardToolNames, ...customToolNames];

    const status: ManagerStatus = {
      services: {},
      totalTools,
      availableTools,
    };

    // 添加标准 MCP 服务状态
    for (const [serviceName, service] of this.services) {
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
   * 获取统计更新监控信息
   */
  getStatsUpdateInfo(): {
    activeLocks: string[];
    totalLocks: number;
  } {
    try {
      const activeLocks = configManager.getStatsUpdateLocks();
      return {
        activeLocks,
        totalLocks: activeLocks.length,
      };
    } catch (error) {
      this.logger.warn("[MCPManager] 获取统计更新监控信息失败:", error);
      return {
        activeLocks: [],
        totalLocks: 0,
      };
    }
  }

  /**
   * 获取指定服务实例
   */
  getService(name: string): MCPService | undefined {
    return this.services.get(name);
  }

  /**
   * 获取所有已连接的服务名称
   */
  getConnectedServices(): string[] {
    const connectedServices: string[] = [];
    for (const [serviceName, service] of this.services) {
      if (service.isConnected()) {
        connectedServices.push(serviceName);
      }
    }
    return connectedServices;
  }

  /**
   * 刷新CustomMCPHandler的私有方法
   */
  private async refreshCustomMCPHandler(): Promise<void> {
    try {
      this.logger.info("重新初始化CustomMCPHandler");
      await this.customMCPHandler.reinitialize();
      this.logger.info("CustomMCPHandler重新初始化完成");
    } catch (error) {
      this.logger.error("CustomMCPHandler重新初始化失败:", error);
      throw error;
    }
  }

  /**
   * 公开的CustomMCPHandler刷新方法，供外部调用
   */
  async refreshCustomMCPHandlerPublic(): Promise<void> {
    return this.refreshCustomMCPHandler();
  }

  /**
   * 获取所有服务实例
   */
  getAllServices(): Map<string, MCPService> {
    return new Map(this.services);
  }

  /**
   * 获取 CustomMCP 处理器实例
   */
  getCustomMCPHandler(): CustomMCPHandler {
    return this.customMCPHandler;
  }

  /**
   * 检查指定的 customMCP 工具是否存在
   * @param toolName 工具名称
   * @returns 如果工具存在返回 true，否则返回 false
   */
  hasCustomMCPTool(toolName: string): boolean {
    try {
      return this.customMCPHandler.hasTool(toolName);
    } catch (error) {
      this.logger.warn(
        `[MCPManager] 检查 CustomMCP 工具 ${toolName} 是否存在失败:`,
        error
      );
      // 异常情况下返回 false，表示工具不存在
      return false;
    }
  }

  /**
   * 获取所有 customMCP 工具列表
   * @returns customMCP 工具数组
   */
  getCustomMCPTools(): Tool[] {
    try {
      return this.customMCPHandler.getTools();
    } catch (error) {
      this.logger.warn(
        "[MCPManager] 获取 CustomMCP 工具列表失败，返回空数组:",
        error
      );
      // 异常情况下返回空数组，避免影响调用方
      return [];
    }
  }

  /**
   * 增强服务配置
   * 根据服务类型添加必要的全局配置
   */
  private enhanceServiceConfig(config: MCPServiceConfig): MCPServiceConfig {
    const enhancedConfig = { ...config };

    try {
      // 处理 ModelScope SSE 服务
      if (
        config.type === MCPTransportType.SSE &&
        config.url &&
        config.url.includes("modelscope")
      ) {
        const modelScopeApiKey = configManager.getModelScopeApiKey();
        if (modelScopeApiKey) {
          enhancedConfig.apiKey = modelScopeApiKey;
          this.logger.info(
            `[MCPManager] 为 ${config.name} 服务添加 ModelScope API Key`
          );
        } else {
          this.logger.warn(
            `[MCPManager] ${config.name} 服务需要 ModelScope API Key，但未在配置中找到`
          );
          throw new Error(
            `ModelScope SSE 服务 ${config.name} 需要 API Key，请在配置文件中设置 modelscope.apiKey`
          );
        }
      }

      return enhancedConfig;
    } catch (error) {
      this.logger.error(`[MCPManager] 配置增强失败: ${config.name}`, error);
      throw error;
    }
  }

  /**
   * 添加服务配置（重载方法以支持两种调用方式）
   */
  addServiceConfig(name: string, config: MCPServiceConfig): void;
  addServiceConfig(config: MCPServiceConfig): void;
  addServiceConfig(
    nameOrConfig: string | MCPServiceConfig,
    config?: MCPServiceConfig
  ): void {
    let finalConfig: MCPServiceConfig;
    let serviceName: string;

    if (typeof nameOrConfig === "string" && config) {
      // 两参数版本
      serviceName = nameOrConfig;
      finalConfig = config;
    } else if (typeof nameOrConfig === "object") {
      // 单参数版本
      serviceName = nameOrConfig.name;
      finalConfig = nameOrConfig;
    } else {
      throw new Error("Invalid arguments for addServiceConfig");
    }

    // 增强配置
    const enhancedConfig = this.enhanceServiceConfig(finalConfig);

    // 存储增强后的配置
    this.configs[serviceName] = enhancedConfig;
    this.logger.info(`[MCPManager] 已添加服务配置: ${serviceName}`);
  }

  /**
   * 移除服务配置
   */
  removeServiceConfig(name: string): void {
    delete this.configs[name];
    this.logger.info(`[MCPManager] 已移除服务配置: ${name}`);
  }

  /**
   * 添加并启动服务 (新增方法)
   * 动态添加服务配置并立即启动服务
   */
  async addAndStartService(
    serviceName: string,
    config: MCPServiceConfig
  ): Promise<void> {
    this.logger.info(`[MCPManager] 添加并启动服务: ${serviceName}`);

    // 添加服务配置
    this.addServiceConfig(serviceName, config);

    try {
      // 启动服务
      await this.startService(serviceName);
      this.logger.info(`[MCPManager] 服务 ${serviceName} 添加并启动成功`);
    } catch (error) {
      // 启动失败，清理配置
      this.removeServiceConfig(serviceName);
      throw error;
    }
  }

  /**
   * 移除服务 (新增方法)
   * 完整移除服务，包括配置清理和工具同步
   */
  async removeService(
    serviceName: string,
    graceful = true,
    cleanupConfig = true
  ): Promise<void> {
    this.logger.info(`[MCPManager] 移除服务: ${serviceName}`);

    try {
      // 1. 停止服务
      if (this.services.has(serviceName)) {
        await this.stopService(serviceName);
      }

      // 2. 清理缓存
      await this.cacheManager.clearServiceCache(serviceName);

      // 3. 移除工具配置
      await configManager.removeServerToolsConfig(serviceName);

      // 4. 移除 customMCP 工具
      await configManager.removeCustomMCPTools(serviceName);

      // 5. 移除 mcpServers 配置
      if (cleanupConfig) {
        await configManager.removeMcpServer(serviceName);
        this.removeServiceConfig(serviceName);
      }

      // 6. 重新建立连接
      await this.scheduleReconnect();

      this.logger.info(`[MCPManager] 服务 ${serviceName} 移除成功`);
    } catch (error) {
      this.logger.error(`[MCPManager] 移除服务 ${serviceName} 失败:`, error);
      throw error;
    }
  }

  /**
   * 测试服务连接 (新增方法)
   * 测试服务配置是否可以正常连接
   */
  async testServiceConnection(config: MCPServiceConfig): Promise<any> {
    this.logger.info("[MCPManager] 测试服务连接");

    try {
      // 创建临时服务实例进行连接测试
      const tempService = new MCPService(config);
      const startTime = Date.now();

      await tempService.connect();
      const responseTime = Date.now() - startTime;

      // 测试成功，断开连接
      await tempService.disconnect();

      return {
        success: true,
        message: "连接测试成功",
        responseTime,
      };
    } catch (error) {
      return {
        success: false,
        message: "连接测试失败",
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * 获取服务状态 (新增方法)
   * 获取服务的详细状态信息
   */
  async getServiceStatus(serviceName: string): Promise<any> {
    const service = this.services.get(serviceName);
    const config = this.configs[serviceName];

    if (!config) {
      return {
        serviceName,
        status: "unknown",
      };
    }

    if (!service) {
      return {
        serviceName,
        status: "stopped",
        configExists: true,
      };
    }

    try {
      const isConnected = service.isConnected();
      const tools = service.getTools();

      return {
        serviceName,
        status: isConnected ? "running" : "connecting",
        toolsCount: tools.length,
        memoryUsage: process.memoryUsage
          ? process.memoryUsage().heapUsed
          : undefined,
        lastConnected: isConnected ? new Date().toISOString() : undefined,
      };
    } catch (error) {
      return {
        serviceName,
        status: "error",
        lastError: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * 获取服务工具列表 (新增方法)
   * 获取指定服务的工具列表
   */
  async getServiceTools(serviceName: string): Promise<any[]> {
    const service = this.services.get(serviceName);

    if (!service || !service.isConnected()) {
      return [];
    }

    try {
      return service.getTools();
    } catch (error) {
      this.logger.error(
        `[MCPManager] 获取服务 ${serviceName} 工具列表失败:`,
        error
      );
      return [];
    }
  }

  /**
   * 更新服务配置 (新增方法)
   * 更新服务配置并重启服务
   */
  async updateServiceConfig(
    serviceName: string,
    config: MCPServiceConfig
  ): Promise<void> {
    this.logger.info(`[MCPManager] 更新服务配置: ${serviceName}`);

    const wasRunning = this.services.has(serviceName);

    // 如果服务正在运行，先停止
    if (wasRunning) {
      await this.stopService(serviceName);
    }

    // 更新配置
    this.configs[serviceName] = config;
    this.logger.info(`[MCPManager] 服务 ${serviceName} 配置已更新`);

    // 如果之前在运行，重新启动
    if (wasRunning) {
      await this.startService(serviceName);
    }
  }

  /**
   * 获取服务配置 (新增方法)
   * 获取指定服务的配置
   */
  getServiceConfig(serviceName: string): MCPServiceConfig | undefined {
    return this.configs[serviceName];
  }

  /**
   * 重新建立小智端点连接 (新增方法)
   * 在服务变更后重新建立连接
   */
  private async reconnectXiaozhiEndpoints(): Promise<void> {
    if (this.isReconnecting) {
      this.logger.debug("小智接入点正在重连中，跳过本次请求");
      return;
    }

    this.isReconnecting = true;
    try {
      // 发射事件，通知小智连接管理器重新建立连接
      this.eventBus.emitEvent("mcp:services:updated", {
        timestamp: new Date(),
      });
      this.logger.info("已触发小智接入点重连事件");
    } catch (error) {
      this.logger.warn("[MCPManager] 重新建立小智端点连接失败:", error);
    } finally {
      this.isReconnecting = false;
    }
  }

  /**
   * 安排重连（防抖机制）
   * 避免频繁添加/移除服务时导致的重连风暴
   */
  private async scheduleReconnect(): Promise<void> {
    if (this.reconnectDebounceTimer) {
      clearTimeout(this.reconnectDebounceTimer);
    }

    this.logger.debug("安排小智接入点重连（1秒防抖延迟）");

    this.reconnectDebounceTimer = setTimeout(async () => {
      try {
        await this.reconnectXiaozhiEndpoints();
      } catch (error) {
        this.logger.error("防抖重连执行失败:", error);
      } finally {
        this.reconnectDebounceTimer = null;
      }
    }, 1000); // 1秒防抖延迟
  }

  /**
   * 同步工具配置到配置文件
   * 实现自动同步 MCP 服务工具配置到 xiaozhi.config.json
   */
  private async syncToolsConfigToFile(): Promise<void> {
    try {
      this.logger.debug("[MCPManager] 开始同步工具配置到配置文件");

      // 获取当前配置文件中的 mcpServerConfig
      const currentServerConfigs = configManager.getMcpServerConfig();

      // 遍历所有已连接的服务
      for (const [serviceName, service] of this.services) {
        if (!service.isConnected()) {
          continue;
        }

        const tools = service.getTools();
        if (tools.length === 0) {
          continue;
        }

        // 获取当前服务在配置文件中的工具配置
        const currentToolsConfig =
          currentServerConfigs[serviceName]?.tools || {};

        // 构建新的工具配置
        const newToolsConfig: Record<string, MCPToolConfig> = {};

        for (const tool of tools) {
          const currentToolConfig = currentToolsConfig[tool.name];

          // 如果工具已存在，保留用户设置的 enable 状态，但更新描述
          if (currentToolConfig) {
            newToolsConfig[tool.name] = {
              ...currentToolConfig,
              description:
                tool.description || currentToolConfig.description || "",
            };
          } else {
            // 新工具，默认启用
            newToolsConfig[tool.name] = {
              description: tool.description || "",
              enable: true,
            };
          }
        }

        // 检查是否有工具被移除（在配置文件中存在但在当前工具列表中不存在）
        const currentToolNames = tools.map((t) => t.name);
        const configToolNames = Object.keys(currentToolsConfig);
        const removedTools = configToolNames.filter(
          (name) => !currentToolNames.includes(name)
        );

        if (removedTools.length > 0) {
          this.logger.info(
            `[MCPManager] 检测到服务 ${serviceName} 移除了 ${removedTools.length} 个工具: ${removedTools.join(", ")}`
          );
        }

        // 检查配置是否有变化
        const hasChanges = this.hasToolsConfigChanged(
          currentToolsConfig,
          newToolsConfig
        );

        if (hasChanges) {
          // 更新配置文件
          configManager.updateServerToolsConfig(serviceName, newToolsConfig);

          const addedTools = Object.keys(newToolsConfig).filter(
            (name) => !currentToolsConfig[name]
          );
          const updatedTools = Object.keys(newToolsConfig).filter((name) => {
            const current = currentToolsConfig[name];
            const updated = newToolsConfig[name];
            return current && current.description !== updated.description;
          });

          this.logger.info(
            `[MCPManager] 已同步服务 ${serviceName} 的工具配置:`
          );
          if (addedTools.length > 0) {
            this.logger.info(`  - 新增工具: ${addedTools.join(", ")}`);
          }
          if (updatedTools.length > 0) {
            this.logger.info(`  - 更新工具: ${updatedTools.join(", ")}`);
          }
          if (removedTools.length > 0) {
            this.logger.info(`  - 移除工具: ${removedTools.join(", ")}`);
          }
        }
      }

      this.logger.debug("[MCPManager] 工具配置同步完成");
    } catch (error) {
      this.logger.error("[MCPManager] 同步工具配置到配置文件失败:", error);
      // 不抛出错误，避免影响服务正常运行
    }
  }

  /**
   * 检查工具配置是否有变化
   */
  private hasToolsConfigChanged(
    currentConfig: Record<string, MCPToolConfig>,
    newConfig: Record<string, MCPToolConfig>
  ): boolean {
    const currentKeys = Object.keys(currentConfig);
    const newKeys = Object.keys(newConfig);

    // 检查工具数量是否变化
    if (currentKeys.length !== newKeys.length) {
      return true;
    }

    // 检查是否有新增或删除的工具
    const addedTools = newKeys.filter((key) => !currentKeys.includes(key));
    const removedTools = currentKeys.filter((key) => !newKeys.includes(key));

    if (addedTools.length > 0 || removedTools.length > 0) {
      return true;
    }

    // 检查现有工具的描述是否有变化
    for (const toolName of currentKeys) {
      const currentTool = currentConfig[toolName];
      const newTool = newConfig[toolName];

      if (currentTool.description !== newTool.description) {
        return true;
      }
    }

    return false;
  }
}

export default MCPServiceManager;

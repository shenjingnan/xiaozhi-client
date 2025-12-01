#!/usr/bin/env node

/**
 * MCP 服务管理器
 * 使用 MCPService 实例管理多个 MCP 服务
 * 专注于实例管理、工具聚合和路由调用
 */

import { EventEmitter } from "node:events";
import { MCPService } from "@/lib/mcp";
import type {
  CustomMCPTool,
  JSONSchema,
  MCPServiceConfig,
  ManagerStatus,
  ToolCallResult,
  ToolInfo,
  UnifiedServerConfig,
  UnifiedServerStatus,
} from "@/lib/mcp/types";
import { MCPTransportType } from "@/lib/mcp/types";
import type { Tool } from "@modelcontextprotocol/sdk/types.js";
import type { MCPToolConfig } from "@root/configManager.js";
import { configManager } from "@root/configManager.js";
import { CustomMCPHandler } from "@root/services/CustomMCPHandler.js";
import { getEventBus } from "@root/services/EventBus.js";
import { MCPCacheManager } from "@root/services/MCPCacheManager.js";
import { ToolSyncManager } from "@root/services/ToolSyncManager.js";
import type { MCPMessage } from "@root/types/mcp.js";
import { ToolCallLogger } from "@utils/ToolCallLogger.js";
import { MCPMessageHandler } from "./MCPMessageHandler.js";
import { ConnectionState, type TransportAdapter } from "./transports/index.js";

export class MCPServiceManager extends EventEmitter {
  private services: Map<string, MCPService> = new Map();
  private configs: Record<string, MCPServiceConfig> = {};
  private tools: Map<string, ToolInfo> = new Map(); // 缓存工具信息，保持向后兼容
  private customMCPHandler: CustomMCPHandler; // CustomMCP 工具处理器
  private cacheManager: MCPCacheManager; // 缓存管理器
  private toolSyncManager: ToolSyncManager; // 工具同步管理器
  private eventBus = getEventBus(); // 事件总线
  private toolCallLogger: ToolCallLogger; // 工具调用记录器
  private retryTimers: Map<string, NodeJS.Timeout> = new Map(); // 重试定时器
  private failedServices: Set<string> = new Set(); // 失败的服务集合

  // 新增：传输适配器管理
  private transportAdapters: Map<string, TransportAdapter> = new Map();
  private messageHandler: MCPMessageHandler;

  // 新增：服务器状态管理（从 UnifiedMCPServer 移入）
  private isRunning = false;
  private config: UnifiedServerConfig;

  /**
   * 创建 MCPServiceManager 实例
   * @param configs 可选的初始服务配置或服务器配置
   */
  constructor(
    configs?: Record<string, MCPServiceConfig> | UnifiedServerConfig
  ) {
    super();

    // 处理参数，支持 UnifiedServerConfig 格式
    if (configs && this.isUnifiedServerConfig(configs)) {
      // UnifiedServerConfig 格式
      this.config = {
        name: "MCPServiceManager",
        enableLogging: true,
        logLevel: "info",
        ...configs,
      };
      this.configs = configs.configs || {};
    } else {
      // 原有的 configs 格式
      this.config = {
        name: "MCPServiceManager",
        enableLogging: true,
        logLevel: "info",
      };
      this.configs = configs || {};
    }

    // 在测试环境中使用临时目录，避免在项目根目录创建缓存文件
    const isTestEnv =
      process.env.NODE_ENV === "test" || process.env.VITEST === "true";
    const cachePath = isTestEnv
      ? `/tmp/xiaozhi-test-${Date.now()}-${Math.random()
          .toString(36)
          .substring(2, 11)}/xiaozhi.cache.json`
      : undefined;

    this.cacheManager = new MCPCacheManager(cachePath);
    this.customMCPHandler = new CustomMCPHandler();
    this.toolSyncManager = new ToolSyncManager(configManager);

    // 初始化工具调用记录器
    const toolCallLogConfig = configManager.getToolCallLogConfig();
    const configDir = configManager.getConfigDir();
    this.toolCallLogger = new ToolCallLogger(toolCallLogConfig, configDir);

    // 设置事件监听器
    this.setupEventListeners();

    // 初始化消息处理器（确保在其他组件初始化完成后）
    this.messageHandler = new MCPMessageHandler(this);
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
    console.debug(`服务 ${data.serviceName} 连接成功，开始工具同步`);

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

        console.info(`服务 ${data.serviceName} 工具同步完成`);
      }
    } catch (error) {
      console.error(`同步服务 ${data.serviceName} 工具失败:`, error);
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
    console.info(
      `服务 ${data.serviceName} 断开连接，原因: ${data.reason || "未知"}`
    );

    try {
      // 更新工具缓存
      await this.refreshToolsCache();

      // 重新初始化CustomMCPHandler
      await this.refreshCustomMCPHandlerPublic();

      console.info(`服务 ${data.serviceName} 断开连接处理完成`);
    } catch (error) {
      console.error(`服务 ${data.serviceName} 断开连接处理失败:`, error);
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
    try {
      await this.refreshCustomMCPHandlerPublic();
    } catch (error) {
      console.error("刷新CustomMCPHandler失败:", error);
    }
  }

  /**
   * 处理serverTools配置更新事件
   */
  private async handleServerToolsUpdated(data: {
    serviceName: string;
    timestamp: Date;
  }): Promise<void> {
    console.debug(`处理服务 ${data.serviceName} 的serverTools配置更新`);

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

        console.info(`服务 ${data.serviceName} 配置更新同步完成`);
      }
    } catch (error) {
      console.error(`处理服务 ${data.serviceName} 配置更新失败:`, error);
    }
  }

  /**
   * 处理通用配置更新事件
   */
  private async handleGeneralConfigUpdated(data: {
    timestamp: Date;
  }): Promise<void> {
    console.info("处理通用配置更新，检查所有已连接服务");

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

      console.info("通用配置更新同步完成");
    } catch (error) {
      console.error("处理通用配置更新失败:", error);
    }
  }

  /**
   * 启动所有 MCP 服务
   */
  async startAllServices(): Promise<void> {
    console.debug("[MCPManager] 正在启动所有 MCP 服务...");

    // 初始化 CustomMCP 处理器
    try {
      this.customMCPHandler.initialize();
      console.debug("[MCPManager] CustomMCP 处理器初始化完成");
    } catch (error) {
      console.error("[MCPManager] CustomMCP 处理器初始化失败:", error);
      // CustomMCP 初始化失败不应该阻止标准 MCP 服务启动
    }

    const configEntries = Object.entries(this.configs);
    if (configEntries.length === 0) {
      console.warn(
        "[MCPManager] 没有配置任何 MCP 服务，请使用 addServiceConfig() 添加服务配置"
      );
      // 即使没有标准 MCP 服务，也可能有 CustomMCP 工具
      return;
    }

    // 记录启动开始
    console.info(
      `[MCPManager] 开始并行启动 ${configEntries.length} 个 MCP 服务`
    );

    // 并行启动所有服务，实现服务隔离
    const startPromises = configEntries.map(async ([serviceName]) => {
      try {
        await this.startService(serviceName);
        return { serviceName, success: true, error: null };
      } catch (error) {
        return {
          serviceName,
          success: false,
          error: error instanceof Error ? error.message : String(error),
        };
      }
    });

    // 等待所有服务启动完成
    const results = await Promise.allSettled(startPromises);

    // 统计启动结果
    let successCount = 0;
    let failureCount = 0;
    const failedServices: string[] = [];

    for (const result of results) {
      if (result.status === "fulfilled") {
        if (result.value.success) {
          successCount++;
        } else {
          failureCount++;
          failedServices.push(result.value.serviceName);
        }
      } else {
        failureCount++;
      }
    }

    // 记录启动完成统计
    console.info(
      `[MCPManager] 服务启动完成 - 成功: ${successCount}, 失败: ${failureCount}`
    );

    // 记录失败的服务列表
    if (failedServices.length > 0) {
      console.warn(
        `[MCPManager] 以下服务启动失败: ${failedServices.join(", ")}`
      );

      // 如果所有服务都失败了，发出警告但系统继续运行以便重试
      if (failureCount === configEntries.length) {
        console.warn(
          "[MCPManager] 所有 MCP 服务启动失败，但系统将继续运行以便重试"
        );
      }
    }

    // 启动失败服务重试机制
    if (failedServices.length > 0) {
      this.scheduleFailedServicesRetry(failedServices);
    }
  }

  /**
   * 启动单个 MCP 服务
   */
  async startService(serviceName: string): Promise<void> {
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
      console.debug(
        `[MCPManager] ${serviceName} 服务启动成功，加载了 ${tools.length} 个工具:`,
        tools.map((t) => t.name).join(", ")
      );
    } catch (error) {
      console.error(
        `[MCPManager] 启动 ${serviceName} 服务失败:`,
        (error as Error).message
      );
      // 清理可能的部分状态
      this.services.delete(serviceName);
      throw error;
    }
  }

  /**
   * 停止单个服务
   */
  async stopService(serviceName: string): Promise<void> {
    console.info(`[MCPManager] 停止 MCP 服务: ${serviceName}`);

    const service = this.services.get(serviceName);
    if (!service) {
      console.warn(`[MCPManager] 服务 ${serviceName} 不存在或未启动`);
      return;
    }

    try {
      await service.disconnect();
      this.services.delete(serviceName);

      // 更新工具缓存
      await this.refreshToolsCache();

      console.info(`[MCPManager] ${serviceName} 服务已停止`);
    } catch (error) {
      console.error(
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
              console.debug(
                `[MCPManager] 已将 ${serviceName} 工具列表写入缓存`
              );
            })
            .catch((error) => {
              console.warn(
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
    inputSchema: JSONSchema;
    serviceName: string;
    originalName: string;
  }> {
    const allTools: Array<{
      name: string;
      description: string;
      inputSchema: JSONSchema;
      serviceName: string;
      originalName: string;
    }> = [];

    // 1. 收集所有已连接服务的工具（包含启用状态过滤）
    for (const [serviceName, service] of this.services) {
      try {
        if (service.isConnected()) {
          const serviceTools = service.getTools();
          for (const tool of serviceTools) {
            try {
              // 检查工具启用状态 - 这个调用可能会抛出异常
              const isEnabled = configManager.isToolEnabled(
                serviceName,
                tool.name
              );
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
            } catch (toolError) {
              console.warn(
                `[MCPManager] 检查工具 ${serviceName}.${tool.name} 启用状态失败，跳过该工具:`,
                toolError
              );
            }
          }
        }
      } catch (serviceError) {
        console.warn(
          `[MCPManager] 获取服务 ${serviceName} 的工具失败，跳过该服务:`,
          serviceError
        );
      }
    }

    // 2. 添加CustomMCP工具（添加异常处理确保优雅降级）
    let customTools: Tool[] = [];
    try {
      customTools = this.customMCPHandler.getTools();
      console.debug(
        `[MCPManager] 成功获取 ${customTools.length} 个 customMCP 工具`
      );
    } catch (error) {
      console.warn(
        "[MCPManager] 获取 CustomMCP 工具失败，将只返回标准 MCP 工具:",
        error
      );
      // 根据技术方案要求，CustomMCP 工具获取失败时不应该影响标准 MCP 工具的返回
      customTools = [];
    }

    for (const tool of customTools) {
      try {
        allTools.push({
          name: tool.name,
          description: tool.description || "",
          inputSchema: tool.inputSchema,
          serviceName: this.getServiceNameForTool(tool),
          originalName: tool.name,
        });
      } catch (toolError) {
        console.warn(
          `[MCPManager] 处理 CustomMCP 工具 ${tool.name} 失败，跳过该工具:`,
          toolError
        );
      }
    }

    console.debug(`[MCPManager] 成功获取 ${allTools.length} 个可用工具`);
    return allTools;
  }

  /**
   * 根据工具配置确定服务名称
   * @param tool 工具对象
   * @returns 服务名称
   */
  private getServiceNameForTool(tool: CustomMCPTool): string {
    if (tool.handler?.type === "mcp") {
      // 如果是从 MCP 同步的工具，返回原始服务名称
      const config = tool.handler.config as
        | { serviceName?: string; toolName?: string }
        | undefined;
      return config?.serviceName || "customMCP";
    }
    return "customMCP";
  }

  /**
   * 根据工具信息获取日志记录用的服务名称
   * @param customTool CustomMCP 工具信息
   * @returns 用于日志记录的服务名称
   */
  private getLogServerName(customTool: CustomMCPTool): string {
    if (!customTool?.handler) {
      return "custom";
    }

    switch (customTool.handler.type) {
      case "mcp": {
        const config = customTool.handler.config as
          | { serviceName?: string; toolName?: string }
          | undefined;
        return config?.serviceName || "customMCP";
      }
      case "coze":
        return "coze";
      case "dify":
        return "dify";
      case "n8n":
        return "n8n";
      default:
        return "custom";
    }
  }

  /**
   * 根据工具信息获取原始工具名称
   * @param toolName 格式化后的工具名称
   * @param customTool CustomMCP 工具信息
   * @param toolInfo 标准工具信息
   * @returns 原始工具名称
   */
  private getOriginalToolName(
    toolName: string,
    customTool: CustomMCPTool | undefined,
    toolInfo?: ToolInfo
  ): string {
    if (customTool) {
      // CustomMCP 工具
      if (customTool.handler?.type === "mcp") {
        const config = customTool.handler.config as
          | { serviceName?: string; toolName?: string }
          | undefined;
        return config?.toolName || toolName;
      }
      return toolName;
    }

    // 标准 MCP 工具
    return toolInfo?.originalName || toolName;
  }

  /**
   * 调用 MCP 工具（支持标准 MCP 工具和 customMCP 工具）
   */
  async callTool(
    toolName: string,
    arguments_: Record<string, unknown>
  ): Promise<ToolCallResult> {
    const startTime = Date.now();

    // 初始化日志信息
    let logServerName = "unknown";
    let originalToolName: string = toolName;

    try {
      let result: ToolCallResult;

      // 检查是否是 customMCP 工具
      if (this.customMCPHandler.hasTool(toolName)) {
        const customTool = this.customMCPHandler.getToolInfo(toolName);

        // 设置日志信息（添加空值检查）
        if (customTool) {
          logServerName = this.getLogServerName(customTool);
          originalToolName = this.getOriginalToolName(toolName, customTool);
        }

        if (customTool?.handler?.type === "mcp") {
          // 对于 mcp 类型的工具，直接路由到对应的 MCP 服务
          result = await this.callMCPTool(
            toolName,
            customTool.handler.config,
            arguments_
          );

          // 异步更新工具调用统计（成功调用）
          this.updateToolStatsSafe(
            toolName,
            customTool.handler.config.serviceName,
            customTool.handler.config.toolName,
            true
          );
        } else {
          // 其他类型的 customMCP 工具正常处理
          result = await this.customMCPHandler.callTool(toolName, arguments_);
          console.info(`[MCPManager] CustomMCP 工具 ${toolName} 调用成功`);

          // 异步更新工具调用统计（成功调用）
          this.updateToolStatsSafe(toolName, "customMCP", toolName, true);
        }
      } else {
        // 如果不是 customMCP 工具，则查找标准 MCP 工具
        const toolInfo = this.tools.get(toolName);
        if (!toolInfo) {
          throw new Error(`未找到工具: ${toolName}`);
        }

        // 设置日志信息
        logServerName = toolInfo.serviceName;
        originalToolName = toolInfo.originalName;

        const service = this.services.get(toolInfo.serviceName);
        if (!service) {
          throw new Error(`服务 ${toolInfo.serviceName} 不可用`);
        }

        if (!service.isConnected()) {
          throw new Error(`服务 ${toolInfo.serviceName} 未连接`);
        }

        result = await service.callTool(
          toolInfo.originalName,
          arguments_ || {}
        );

        console.debug("[MCPManager] 工具调用成功", {
          toolName: toolName,
          result: result,
        });

        // 异步更新工具调用统计（成功调用）
        this.updateToolStatsSafe(
          toolName,
          toolInfo.serviceName,
          toolInfo.originalName,
          true
        );
      }

      // 记录成功的工具调用
      this.toolCallLogger.recordToolCall({
        toolName: originalToolName,
        serverName: logServerName,
        arguments: arguments_,
        result: result,
        success: result.isError !== true,
        duration: Date.now() - startTime,
      });

      return result as ToolCallResult;
    } catch (error) {
      // 记录失败的工具调用
      this.toolCallLogger.recordToolCall({
        toolName: originalToolName,
        serverName: logServerName,
        arguments: arguments_,
        result: null,
        success: false,
        duration: Date.now() - startTime,
        error: error instanceof Error ? error.message : String(error),
      });

      // 更新失败统计
      if (this.customMCPHandler.hasTool(toolName)) {
        const customTool = this.customMCPHandler.getToolInfo(toolName);
        if (customTool?.handler?.type === "mcp") {
          this.updateToolStatsSafe(
            toolName,
            customTool.handler.config.serviceName,
            customTool.handler.config.toolName,
            false
          );
        } else {
          this.updateToolStatsSafe(toolName, "customMCP", toolName, false);
          console.error(
            `[MCPManager] CustomMCP 工具 ${toolName} 调用失败:`,
            (error as Error).message
          );
        }
      } else {
        const toolInfo = this.tools.get(toolName);
        if (toolInfo) {
          this.updateToolStatsSafe(
            toolName,
            toolInfo.serviceName,
            toolInfo.originalName,
            false
          );
          console.error(
            `[MCPManager] 工具 ${toolName} 调用失败:`,
            (error as Error).message
          );
        }
      }

      throw error;
    }
  }

  /**
   * 更新工具调用统计信息的通用方法
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
      const currentTime = new Date().toISOString();

      if (isSuccess) {
        // 成功调用：更新使用统计
        await this.updateCustomMCPToolStats(toolName, currentTime);

        // 如果是 MCP 服务工具，同时更新 mcpServerConfig 配置（双写机制）
        if (serviceName !== "customMCP") {
          await this.updateMCPServerToolStats(
            serviceName,
            originalToolName,
            currentTime
          );
        }

        console.debug(`[MCPManager] 已更新工具 ${toolName} 的统计信息`);
      } else {
        // 失败调用：只更新最后使用时间
        await this.updateCustomMCPToolLastUsedTime(toolName, currentTime);

        // 如果是 MCP 服务工具，同时更新 mcpServerConfig 配置（双写机制）
        if (serviceName !== "customMCP") {
          await this.updateMCPServerToolLastUsedTime(
            serviceName,
            originalToolName,
            currentTime
          );
        }

        console.debug("[MCPManager] 已更新工具的失败调用统计信息", {
          toolName,
        });
      }
    } catch (error) {
      console.error("[MCPManager] 更新工具统计信息失败:", { toolName, error });
      throw error;
    }
  }

  /**
   * 统一的统计更新处理方法（带错误处理）
   * @param toolName 工具名称
   * @param serviceName 服务名称
   * @param originalToolName 原始工具名称
   * @param isSuccess 是否调用成功
   * @private
   */
  private async updateToolStatsSafe(
    toolName: string,
    serviceName: string,
    originalToolName: string,
    isSuccess: boolean
  ): Promise<void> {
    try {
      await this.updateToolStats(
        toolName,
        serviceName,
        originalToolName,
        isSuccess
      );
    } catch (error) {
      const action = isSuccess ? "统计信息" : "失败统计信息";
      console.warn("[MCPManager] 更新工具统计信息失败:", {
        toolName,
        action,
        error,
      });
      // 统计更新失败不应该影响主流程，所以这里只记录警告
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
      console.debug(`[MCPManager] 已更新 customMCP 工具 ${toolName} 使用统计`);
    } catch (error) {
      console.error(
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
      console.debug(
        `[MCPManager] 已更新 customMCP 工具 ${toolName} 最后使用时间`
      );
    } catch (error) {
      console.error(
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
      console.debug(
        `[MCPManager] 已更新 MCP 服务工具 ${serviceName}/${toolName} 统计`
      );
    } catch (error) {
      console.error(
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
      console.debug(
        `[MCPManager] 已更新 MCP 服务工具 ${serviceName}/${toolName} 最后使用时间`
      );
    } catch (error) {
      console.error(
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
    arguments_: Record<string, unknown>
  ): Promise<ToolCallResult> {
    const { serviceName, toolName: originalToolName } = config;

    console.debug(
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
      console.debug(`[MCPManager] MCP 同步工具 ${toolName} 调用成功`);
      return result as ToolCallResult;
    } catch (error) {
      console.error(
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
    console.info("[MCPManager] 正在停止所有 MCP 服务...");

    // 停止所有服务重试
    this.stopAllServiceRetries();

    // 停止所有服务实例
    for (const [serviceName, service] of this.services) {
      try {
        await service.disconnect();
        console.info(`[MCPManager] ${serviceName} 服务已停止`);
      } catch (error) {
        console.error(
          `[MCPManager] 停止 ${serviceName} 服务失败:`,
          (error as Error).message
        );
      }
    }

    // 清理 CustomMCP 处理器
    try {
      this.customMCPHandler.cleanup();
      console.info("[MCPManager] CustomMCP 处理器已清理");
    } catch (error) {
      console.error("[MCPManager] CustomMCP 处理器清理失败:", error);
    }

    // 清理统计更新锁
    try {
      configManager.clearAllStatsUpdateLocks();
      console.info("[MCPManager] 统计更新锁已清理");
    } catch (error) {
      console.error("[MCPManager] 清理统计更新锁失败:", error);
    }

    this.services.clear();
    this.tools.clear();

    console.info("[MCPManager] 所有 MCP 服务已停止");
  }

  /**
   * 获取服务器状态（兼容 UnifiedServerStatus 格式）
   */
  getStatus(): UnifiedServerStatus {
    return this.getUnifiedStatus();
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
      console.warn("[MCPManager] 获取统计更新监控信息失败:", error);
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
      console.debug("重新初始化CustomMCPHandler");
      await this.customMCPHandler.reinitialize();
      console.debug("CustomMCPHandler重新初始化完成");
    } catch (error) {
      console.error("CustomMCPHandler重新初始化失败:", error);
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
      console.warn(
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
      console.warn(
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
          console.info(
            `[MCPManager] 为 ${config.name} 服务添加 ModelScope API Key`
          );
        } else {
          console.warn(
            `[MCPManager] ${config.name} 服务需要 ModelScope API Key，但未在配置中找到`
          );
          throw new Error(
            `ModelScope SSE 服务 ${config.name} 需要 API Key，请在配置文件中设置 modelscope.apiKey`
          );
        }
      }

      return enhancedConfig;
    } catch (error) {
      console.error(`[MCPManager] 配置增强失败: ${config.name}`, error);
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
    console.debug(`[MCPManager] 已添加服务配置: ${serviceName}`);
  }

  /**
   * 更新服务配置
   */
  updateServiceConfig(name: string, config: MCPServiceConfig): void {
    // 增强配置
    const enhancedConfig = this.enhanceServiceConfig(config);

    // 存储增强后的配置
    this.configs[name] = enhancedConfig;
    console.debug(`[MCPManager] 已更新并增强服务配置: ${name}`);
  }

  /**
   * 移除服务配置
   */
  removeServiceConfig(name: string): void {
    delete this.configs[name];
    console.debug(`[MCPManager] 已移除服务配置: ${name}`);
  }

  /**
   * 同步工具配置到配置文件
   * 实现自动同步 MCP 服务工具配置到 xiaozhi.config.json
   */
  private async syncToolsConfigToFile(): Promise<void> {
    try {
      console.debug("[MCPManager] 开始同步工具配置到配置文件");

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
          console.info(
            `[MCPManager] 检测到服务 ${serviceName} 移除了 ${
              removedTools.length
            } 个工具: ${removedTools.join(", ")}`
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

          console.debug(`[MCPManager] 已同步服务 ${serviceName} 的工具配置:`);
          if (addedTools.length > 0) {
            console.debug(`  - 新增工具: ${addedTools.join(", ")}`);
          }
          if (updatedTools.length > 0) {
            console.debug(`  - 更新工具: ${updatedTools.join(", ")}`);
          }
          if (removedTools.length > 0) {
            console.debug(`  - 移除工具: ${removedTools.join(", ")}`);
          }
        }
      }

      console.debug("[MCPManager] 工具配置同步完成");
    } catch (error) {
      console.error("[MCPManager] 同步工具配置到配置文件失败:", error);
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

  /**
   * 安排失败服务的重试
   * @param failedServices 失败的服务列表
   */
  private scheduleFailedServicesRetry(failedServices: string[]): void {
    if (failedServices.length === 0) return;

    // 记录重试安排
    console.info(`[MCPManager] 安排 ${failedServices.length} 个失败服务的重试`);

    // 初始重试延迟：30秒
    const initialDelay = 30000;

    for (const serviceName of failedServices) {
      this.failedServices.add(serviceName);
      this.scheduleServiceRetry(serviceName, initialDelay);
    }
  }

  /**
   * 安排单个服务的重试
   * @param serviceName 服务名称
   * @param delay 延迟时间（毫秒）
   */
  private scheduleServiceRetry(serviceName: string, delay: number): void {
    // 清除现有定时器
    const existingTimer = this.retryTimers.get(serviceName);
    if (existingTimer) {
      clearTimeout(existingTimer);
      this.retryTimers.delete(serviceName);
    }

    console.debug(`[MCPManager] 安排服务 ${serviceName} 在 ${delay}ms 后重试`);

    const timer = setTimeout(async () => {
      this.retryTimers.delete(serviceName);
      await this.retryFailedService(serviceName);
    }, delay);

    this.retryTimers.set(serviceName, timer);
  }

  /**
   * 重试失败的服务
   * @param serviceName 服务名称
   */
  private async retryFailedService(serviceName: string): Promise<void> {
    if (!this.failedServices.has(serviceName)) {
      return; // 服务已经成功启动或不再需要重试
    }

    try {
      await this.startService(serviceName);

      // 重试成功
      this.failedServices.delete(serviceName);
      console.info(`[MCPManager] 服务 ${serviceName} 重试启动成功`);

      // 重新初始化CustomMCPHandler以包含新启动的服务工具
      try {
        await this.refreshCustomMCPHandlerPublic();
      } catch (error) {
        console.error("[MCPManager] 刷新CustomMCPHandler失败:", error);
      }
    } catch (error) {
      console.error(
        `[MCPManager] 服务 ${serviceName} 重试启动失败:`,
        (error as Error).message
      );

      // 指数退避重试策略：延迟时间翻倍，最大不超过5分钟
      const currentDelay = this.getRetryDelay(serviceName);
      const nextDelay = Math.min(currentDelay * 2, 300000); // 最大5分钟

      console.debug(
        `[MCPManager] 服务 ${serviceName} 下次重试将在 ${nextDelay}ms 后进行`
      );

      this.scheduleServiceRetry(serviceName, nextDelay);
    }
  }

  /**
   * 获取当前重试延迟时间
   * @param serviceName 服务名称
   * @returns 当前延迟时间
   */
  private getRetryDelay(serviceName: string): number {
    // 这里可以实现更复杂的状态跟踪来计算准确的延迟
    // 简化实现：返回一个基于服务名称的哈希值的初始延迟
    const hash = serviceName
      .split("")
      .reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return 30000 + (hash % 60000); // 30-90秒之间的初始延迟
  }

  /**
   * 停止指定服务的重试
   * @param serviceName 服务名称
   */
  public stopServiceRetry(serviceName: string): void {
    const timer = this.retryTimers.get(serviceName);
    if (timer) {
      clearTimeout(timer);
      this.retryTimers.delete(serviceName);
      console.debug(`[MCPManager] 已停止服务 ${serviceName} 的重试`);
    }
    this.failedServices.delete(serviceName);
  }

  /**
   * 停止所有服务的重试
   */
  public stopAllServiceRetries(): void {
    console.info("[MCPManager] 停止所有服务重试");

    for (const [serviceName, timer] of this.retryTimers) {
      clearTimeout(timer);
      console.debug(`[MCPManager] 已停止服务 ${serviceName} 的重试`);
    }

    this.retryTimers.clear();
    this.failedServices.clear();
  }

  /**
   * 获取失败服务列表
   * @returns 失败的服务名称数组
   */
  public getFailedServices(): string[] {
    return Array.from(this.failedServices);
  }

  /**
   * 检查服务是否失败
   * @param serviceName 服务名称
   * @returns 如果服务失败返回true
   */
  public isServiceFailed(serviceName: string): boolean {
    return this.failedServices.has(serviceName);
  }

  /**
   * 获取重试统计信息
   * @returns 重试统计信息
   */
  public getRetryStats(): {
    failedServices: string[];
    activeRetries: string[];
    totalFailed: number;
    totalActiveRetries: number;
  } {
    return {
      failedServices: Array.from(this.failedServices),
      activeRetries: Array.from(this.retryTimers.keys()),
      totalFailed: this.failedServices.size,
      totalActiveRetries: this.retryTimers.size,
    };
  }

  // ===== 传输适配器管理方法（从 UnifiedMCPServer 移入） =====

  /**
   * 注册传输适配器
   * @param name 传输适配器名称
   * @param adapter 传输适配器实例
   */
  public async registerTransport(
    name: string,
    adapter: TransportAdapter
  ): Promise<void> {
    if (this.transportAdapters.has(name)) {
      throw new Error(`传输适配器 ${name} 已存在`);
    }

    console.info(`注册传输适配器: ${name}`);

    try {
      await adapter.initialize();
      this.transportAdapters.set(name, adapter);

      console.info(`传输适配器 ${name} 注册成功`);
      this.emit("transportRegistered", { name, adapter });
    } catch (error) {
      console.error(`注册传输适配器 ${name} 失败`, error);
      throw error;
    }
  }

  /**
   * 启动所有传输适配器
   *
   * 改进的错误处理策略：
   * - 单个适配器启动失败不会中断其他适配器的启动
   * - 记录失败的适配器，但继续启动其他适配器
   * - 如果所有适配器都失败，则抛出错误
   * - 如果部分适配器成功，则记录警告但继续运行
   */
  public async startTransports(): Promise<void> {
    console.info("启动所有传输适配器");

    const successfulAdapters: string[] = [];
    const failedAdapters: string[] = [];

    for (const [name, adapter] of this.transportAdapters) {
      try {
        await adapter.start();
        successfulAdapters.push(name);
        console.info(`传输适配器 ${name} 启动成功`);
      } catch (error) {
        failedAdapters.push(name);
        console.error(`传输适配器 ${name} 启动失败`, error);
        // 不立即抛出错误，继续尝试启动其他适配器
      }
    }

    // 评估启动结果
    if (successfulAdapters.length === 0 && failedAdapters.length > 0) {
      // 所有适配器都失败了
      const errorMessage = `所有传输适配器启动失败，失败的适配器: ${failedAdapters.join(
        ", "
      )}`;
      console.error(errorMessage);
      throw new Error(errorMessage);
    }

    if (failedAdapters.length > 0) {
      // 部分适配器失败
      console.warn(
        `部分传输适配器启动失败，成功: ${successfulAdapters.join(
          ", "
        )}, 失败: ${failedAdapters.join(", ")}`
      );
      // 继续运行，因为至少有一个适配器成功
    }

    console.info(
      `传输适配器启动完成，成功: ${successfulAdapters.length}, 失败: ${failedAdapters.length}`
    );
  }

  /**
   * 停止所有传输适配器
   */
  public async stopTransports(): Promise<void> {
    console.info("停止所有传输适配器");

    try {
      for (const [name, adapter] of this.transportAdapters) {
        try {
          await adapter.stop();
          console.info(`传输适配器 ${name} 停止成功`);
        } catch (error) {
          console.error(`传输适配器 ${name} 停止失败`, error);
        }
      }
    } catch (error) {
      console.error("传输适配器停止失败", error);
      throw error;
    }
  }

  /**
   * 获取所有传输适配器
   * @returns 传输适配器映射表
   */
  public getTransportAdapters(): Map<string, TransportAdapter> {
    return new Map(this.transportAdapters);
  }

  /**
   * 获取消息处理器（供外部使用）
   * @returns 消息处理器实例
   */
  public getMessageHandler(): MCPMessageHandler {
    return this.messageHandler;
  }

  /**
   * 启动管理器（包含服务和传输）
   */
  public async start(): Promise<void> {
    if (this.isRunning) {
      throw new Error("服务器已在运行");
    }

    console.info("启动 MCP 服务管理器");

    try {
      await this.startAllServices();
      await this.startTransports();
      this.isRunning = true;

      console.info("MCP 服务管理器启动成功");
      this.emit("started");
    } catch (error) {
      console.error("MCP 服务管理器启动失败", error);
      throw error;
    }
  }

  /**
   * 停止管理器（包含传输和服务）
   */
  public async stop(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    console.info("停止 MCP 服务管理器");

    try {
      await this.stopTransports();
      await this.stopAllServices();
      this.isRunning = false;

      console.info("MCP 服务管理器停止成功");
      this.emit("stopped");
    } catch (error) {
      console.error("MCP 服务管理器停止失败", error);
      throw error;
    }
  }

  /**
   * 获取所有连接信息
   * @returns 连接信息列表
   */
  public getAllConnections(): Array<{
    id: string;
    name: string;
    state: ConnectionState;
  }> {
    const connections: Array<{
      id: string;
      name: string;
      state: ConnectionState;
    }> = [];

    // 收集服务连接
    for (const [serviceName, service] of this.services) {
      if (service.isConnected()) {
        connections.push({
          id: `service-${serviceName}`,
          name: serviceName,
          state: ConnectionState.CONNECTED,
        });
      }
    }

    // 收集传输适配器连接
    for (const [adapterName, adapter] of this.transportAdapters) {
      connections.push({
        id: adapter.getConnectionId(),
        name: adapterName,
        state: adapter.getState(),
      });
    }

    return connections;
  }

  /**
   * 获取活跃连接数
   * @returns 活跃连接数量
   */
  public getActiveConnectionCount(): number {
    return this.getAllConnections().filter(
      (conn) => conn.state === ConnectionState.CONNECTED
    ).length;
  }

  // ===== 从 UnifiedMCPServer 移入的方法 =====

  /**
   * 获取服务器状态（从 UnifiedMCPServer 移入）
   */
  getUnifiedStatus(): UnifiedServerStatus {
    const serviceStatus = this.getServiceManagerStatus();
    return {
      isRunning: this.isRunning,
      serviceStatus,
      transportCount: this.getTransportAdapters().size,
      activeConnections: this.getActiveConnectionCount(),
      config: this.config,
      // 便捷访问属性
      services: serviceStatus.services,
      totalTools: serviceStatus.totalTools,
      availableTools: serviceStatus.availableTools,
    };
  }

  /**
   * 获取管理器状态（原有的 getStatus 方法重命名）
   */
  getServiceManagerStatus(): ManagerStatus {
    // 计算总工具数量（包括 customMCP 工具，添加异常处理）
    let customMCPToolCount = 0;
    let customToolNames: string[] = [];

    try {
      customMCPToolCount = this.customMCPHandler.getToolCount();
      customToolNames = this.customMCPHandler.getToolNames();
      console.debug(
        `[MCPManager] 成功获取 customMCP 状态: ${customMCPToolCount} 个工具`
      );
    } catch (error) {
      console.warn(
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
   * 检查服务器是否正在运行（从 UnifiedMCPServer 移入）
   */
  isServerRunning(): boolean {
    return this.isRunning;
  }

  /**
   * 类型守卫：检查是否为 UnifiedServerConfig
   */
  private isUnifiedServerConfig(
    configs: unknown
  ): configs is UnifiedServerConfig {
    return (
      configs !== null && typeof configs === "object" && "configs" in configs
    );
  }

  /**
   * 消息路由核心功能（从 UnifiedMCPServer 移入）
   */
  async routeMessage(message: MCPMessage): Promise<MCPMessage | null> {
    const response = await this.messageHandler.handleMessage(message);
    // 如果响应是 null，直接返回
    if (response === null) {
      return null;
    }
    // 将 MCPResponse 转换为 MCPMessage 格式
    return {
      jsonrpc: "2.0",
      method: "response", // 标识这是一个响应消息
      params: response,
      id: response.id, // 使用响应中的ID
    };
  }

  // ===== 向后兼容方法 =====

  /**
   * 初始化方法（向后兼容，实际调用 start）
   *
   * 注意：此方法仅为向后兼容而保留
   * 实际功能：调用 start() 方法并设置 isRunning 状态
   * 建议新代码直接使用 start() 方法
   */
  async initialize(): Promise<void> {
    // 为了向后兼容，初始化时调用 start
    // 会设置 isRunning 状态为 true
    await this.start();
  }

  /**
   * 获取工具注册表（向后兼容，返回自身）
   */
  getToolRegistry(): MCPServiceManager {
    return this;
  }

  /**
   * 获取连接管理器（向后兼容，返回自身）
   */
  getConnectionManager(): MCPServiceManager {
    return this;
  }
}

export default MCPServiceManager;

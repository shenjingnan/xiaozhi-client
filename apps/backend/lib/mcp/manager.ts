#!/usr/bin/env node

/**
 * MCP 服务管理器
 * 使用 MCPService 实例管理多个 MCP 服务
 * 专注于实例管理、工具聚合和路由调用
 *
 * 重构说明：
 * - 使用专职管理器分离不同职责
 * - MCPServiceLifecycleManager: 服务生命周期管理
 * - MCPToolInvoker: 工具调用和统计
 * - MCPRetryManager: 重试管理
 * - MCPConfigSyncManager: 配置同步和认证
 */

import { EventEmitter } from "node:events";
import { MCPCacheManager } from "@/lib/mcp";
import {
  MCPConfigSyncManager,
  MCPServiceLifecycleManager,
  MCPRetryManager,
  MCPToolInvoker,
} from "@/lib/mcp";
import { ConnectionState } from "@/lib/mcp/types";
import type {
  CustomMCPTool,
  EnhancedToolInfo,
  InternalMCPServiceConfig,
  MCPServiceConfig,
  ManagerStatus,
  ToolCallResult,
  ToolInfo,
  ToolStatusFilter,
  UnifiedServerConfig,
  UnifiedServerStatus,
} from "@/lib/mcp/types";
import { getEventBus } from "@/services/event-bus.service.js";
import type { MCPMessage } from "@/types/mcp.js";
import type { Tool } from "@modelcontextprotocol/sdk/types.js";
import { configManager } from "@xiaozhi-client/config";
import { CustomMCPHandler } from "./custom.js";
import { ToolCallLogger } from "./log.js";
import { MCPMessageHandler } from "./message.js";

export class MCPServiceManager extends EventEmitter {
  // 核心组件
  private lifecycleManager: MCPServiceLifecycleManager;
  private toolInvoker: MCPToolInvoker;
  private retryManager: MCPRetryManager;
  private configSyncManager: MCPConfigSyncManager;

  // 支持组件
  private customMCPHandler: CustomMCPHandler;
  private cacheManager: MCPCacheManager;
  private toolCallLogger: ToolCallLogger;
  private messageHandler: MCPMessageHandler;

  // 状态管理
  private isRunning = false;
  private config: UnifiedServerConfig;

  // 事件监听器引用（用于清理）
  private eventListeners: {
    serviceConnected: (data: {
      serviceName: string;
      tools: Tool[];
      connectionTime: Date;
    }) => void;
    serviceDisconnected: (data: {
      serviceName: string;
      reason?: string;
      disconnectionTime: Date;
    }) => void;
    serviceConnectionFailed: (data: {
      serviceName: string;
      error: Error;
      attempt: number;
    }) => void;
  };

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
      configs = configs.configs || {};
    } else {
      // 原有的 configs 格式
      this.config = {
        name: "MCPServiceManager",
        enableLogging: true,
        logLevel: "info",
      };
      configs = configs || {};
    }

    // 在测试环境中使用临时目录，避免在项目根目录创建缓存文件
    const isTestEnv =
      process.env.NODE_ENV === "test" || process.env.VITEST === "true";
    const cachePath = isTestEnv
      ? `/tmp/xiaozhi-test-${Date.now()}-${Math.random()
          .toString(36)
          .substring(2, 11)}/xiaozhi.cache.json`
      : undefined;

    // 初始化缓存管理器
    this.cacheManager = new MCPCacheManager(cachePath);
    this.customMCPHandler = new CustomMCPHandler(this.cacheManager, this);

    // 初始化工具调用记录器
    const toolCallLogConfig = configManager.getToolCallLogConfig();
    const configDir = configManager.getConfigDir();
    this.toolCallLogger = new ToolCallLogger(toolCallLogConfig, configDir);

    // 初始化配置同步管理器
    this.configSyncManager = new MCPConfigSyncManager();

    // 初始化生命周期管理器
    this.lifecycleManager = new MCPServiceLifecycleManager(this.customMCPHandler);

    // 初始化重试管理器
    this.retryManager = new MCPRetryManager((serviceName) =>
      this.lifecycleManager.startService(serviceName)
    );

    // 初始化工具调用管理器
    this.toolInvoker = new MCPToolInvoker(
      this.customMCPHandler,
      this.toolCallLogger,
      (name) => this.lifecycleManager.getService(name),
      () => this.getToolsMap()
    );

    // 设置生命周期管理器的回调
    this.lifecycleManager.setCustomMCPHandler(this.customMCPHandler);
    this.lifecycleManager.setToolsRefreshCallback(() =>
      this.refreshToolsCacheInternal()
    );

    // 初始化事件监听器引用
    this.eventListeners = {
      serviceConnected: async (data) => {
        await this.handleServiceConnected(data);
      },
      serviceDisconnected: async (data) => {
        await this.handleServiceDisconnected(data);
      },
      serviceConnectionFailed: async (data) => {
        await this.handleServiceConnectionFailed(data);
      },
    };

    // 设置事件监听器
    this.setupEventListeners();

    // 初始化消息处理器（确保在其他组件初始化完成后）
    this.messageHandler = new MCPMessageHandler(this);

    // 添加初始配置
    if (configs) {
      for (const [name, config] of Object.entries(configs)) {
        this.addServiceConfig(name, config);
      }
    }
  }

  /**
   * 设置事件监听器
   */
  private setupEventListeners(): void {
    const eventBus = getEventBus();

    // 监听MCP服务连接成功事件
    eventBus.onEvent(
      "mcp:service:connected",
      this.eventListeners.serviceConnected
    );

    // 监听MCP服务断开连接事件
    eventBus.onEvent(
      "mcp:service:disconnected",
      this.eventListeners.serviceDisconnected
    );

    // 监听MCP服务连接失败事件
    eventBus.onEvent(
      "mcp:service:connection:failed",
      this.eventListeners.serviceConnectionFailed
    );
  }

  /**
   * 处理MCP服务连接成功事件
   */
  private async handleServiceConnected(data: {
    serviceName: string;
    tools: Tool[];
    connectionTime: Date;
  }): Promise<void> {
    console.debug(`服务 ${data.serviceName} 连接成功，开始刷新工具缓存`);

    try {
      // 重新初始化CustomMCPHandler
      await this.refreshCustomMCPHandlerPublic();
      console.info(`服务 ${data.serviceName} 工具缓存刷新完成`);
    } catch (error) {
      console.error(`刷新服务 ${data.serviceName} 工具缓存失败:`, error);
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
      await this.refreshToolsCacheInternal();
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
   * 刷新工具缓存（内部方法）
   */
  private async refreshToolsCacheInternal(): Promise<void> {
    // 同步工具配置到配置文件
    const connectedServices = this.lifecycleManager.getConnectedServices();
    await this.configSyncManager.syncToolsConfigToFile(connectedServices, (name) =>
      this.lifecycleManager.getServiceTools(name)
    );
  }

  /**
   * 启动所有 MCP 服务
   */
  async startAllServices(): Promise<void> {
    console.debug("[MCPManager] 正在启动所有 MCP 服务...");

    const failedServices =
      await this.lifecycleManager.startAllServices();

    // 启动失败服务重试机制
    if (failedServices.length > 0) {
      this.retryManager.scheduleFailedServicesRetry(failedServices);
    }
  }

  /**
   * 启动单个 MCP 服务
   */
  async startService(serviceName: string): Promise<void> {
    // 先增强配置
    const config = this.lifecycleManager.getServiceConfig(serviceName);
    if (!config) {
      throw new Error(`未找到服务配置: ${serviceName}`);
    }

    const enhancedConfig = this.configSyncManager.enhanceServiceConfig(
      serviceName,
      config
    );
    this.lifecycleManager.updateServiceConfig(serviceName, enhancedConfig);

    // 启动服务
    await this.lifecycleManager.startService(serviceName);
  }

  /**
   * 停止单个服务
   */
  async stopService(serviceName: string): Promise<void> {
    await this.lifecycleManager.stopService(serviceName);
  }

  /**
   * 停止所有服务
   */
  async stopAllServices(): Promise<void> {
    console.info("[MCPManager] 正在停止所有 MCP 服务...");

    // 停止所有服务重试
    this.retryManager.stopAllServiceRetries();

    // 停止所有服务实例
    await this.lifecycleManager.stopAllServices();

    // 清理统计更新锁
    try {
      configManager.clearAllStatsUpdateLocks();
      console.info("[MCPManager] 统计更新锁已清理");
    } catch (error) {
      console.error("[MCPManager] 清理统计更新锁失败:", error);
    }

    console.info("[MCPManager] 所有 MCP 服务已停止");
  }

  /**
   * 获取所有可用工具
   * @param status 工具状态过滤：'enabled' 仅返回已启用工具，'disabled' 仅返回未启用工具，'all' 返回所有工具
   * @returns 工具数组，包含工具的启用状态信息
   */
  getAllTools(status: ToolStatusFilter = "all"): EnhancedToolInfo[] {
    const allTools: EnhancedToolInfo[] = [];

    // 1. 收集所有已连接服务的工具（包含启用状态过滤）
    const connectedServices = this.lifecycleManager.getConnectedServices();
    for (const serviceName of connectedServices) {
      try {
        const serviceTools = this.lifecycleManager.getServiceTools(serviceName);
        for (const tool of serviceTools) {
          try {
            // 检查工具启用状态
            const isEnabled = configManager.isToolEnabled(serviceName, tool.name);
            const toolConfig =
              configManager.getMcpServerConfig()[serviceName].tools[tool.name];

            // 根据 status 参数过滤工具
            if (status === "enabled" && !isEnabled) {
              continue;
            }
            if (status === "disabled" && isEnabled) {
              continue;
            }

            const toolKey = `${serviceName}__${tool.name}`;
            allTools.push({
              name: toolKey,
              description: tool.description || "",
              inputSchema: tool.inputSchema,
              serviceName,
              originalName: tool.name,
              enabled: isEnabled,
              usageCount: toolConfig.usageCount ?? 0,
              lastUsedTime: toolConfig.lastUsedTime ?? "",
            });
          } catch (toolError) {
            console.warn(
              `[MCPManager] 检查工具 ${serviceName}.${tool.name} 启用状态失败，跳过该工具:`,
              toolError
            );
          }
        }
      } catch (serviceError) {
        console.warn(
          `[MCPManager] 获取服务 ${serviceName} 的工具失败，跳过该服务:`,
          serviceError
        );
      }
    }

    // 2. 添加CustomMCP工具（默认视为已启用）
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
      customTools = [];
    }

    // CustomMCP 工具默认视为已启用
    if (status !== "disabled") {
      for (const tool of customTools) {
        try {
          allTools.push({
            name: tool.name,
            description: tool.description || "",
            inputSchema: tool.inputSchema,
            serviceName: this.getServiceNameForTool(tool),
            originalName: tool.name,
            enabled: true,
            usageCount: 0,
            lastUsedTime: "",
          });
        } catch (toolError) {
          console.warn(
            `[MCPManager] 处理 CustomMCP 工具 ${tool.name} 失败，跳过该工具:`,
            toolError
          );
        }
      }
    }

    console.debug(
      `[MCPManager] 成功获取 ${allTools.length} 个可用工具（status=${status}）`
    );
    return allTools;
  }

  /**
   * 根据工具配置确定服务名称
   */
  private getServiceNameForTool(tool: CustomMCPTool): string {
    if (tool.handler?.type === "mcp") {
      const config = tool.handler.config as
        | { serviceName?: string; toolName?: string }
        | undefined;
      return config?.serviceName || "customMCP";
    }
    return "customMCP";
  }

  /**
   * 获取工具映射（内部使用）
   */
  private getToolsMap(): Map<string, ToolInfo> {
    return this.lifecycleManager.getAllToolsMap();
  }

  /**
   * 调用 MCP 工具（支持标准 MCP 工具和 customMCP 工具）
   */
  async callTool(
    toolName: string,
    arguments_: Record<string, unknown>,
    options?: { timeout?: number }
  ): Promise<ToolCallResult> {
    return this.toolInvoker.callTool(toolName, arguments_, options);
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
    const toolsMap = this.getToolsMap();
    return toolsMap.has(toolName);
  }

  /**
   * 刷新CustomMCPHandler的私有方法
   */
  private async refreshCustomMCPHandler(): Promise<void> {
    try {
      console.debug("重新初始化CustomMCPHandler");
      this.customMCPHandler.initialize();
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
  getService(name: string): ReturnType<typeof this.lifecycleManager.getService> {
    return this.lifecycleManager.getService(name);
  }

  /**
   * 获取所有已连接的服务名称
   */
  getConnectedServices(): string[] {
    return this.lifecycleManager.getConnectedServices();
  }

  /**
   * 获取所有服务实例
   */
  getAllServices(): Map<string, ReturnType<typeof this.lifecycleManager.getService>> {
    return this.lifecycleManager.getAllServices();
  }

  /**
   * 获取 CustomMCP 处理器实例
   */
  getCustomMCPHandler(): CustomMCPHandler {
    return this.customMCPHandler;
  }

  /**
   * 检查指定的 customMCP 工具是否存在
   */
  hasCustomMCPTool(toolName: string): boolean {
    try {
      return this.customMCPHandler.hasTool(toolName);
    } catch (error) {
      console.warn(
        `[MCPManager] 检查 CustomMCP 工具 ${toolName} 是否存在失败:`,
        error
      );
      return false;
    }
  }

  /**
   * 获取所有 customMCP 工具列表
   */
  getCustomMCPTools(): Tool[] {
    try {
      return this.customMCPHandler.getTools();
    } catch (error) {
      console.warn(
        "[MCPManager] 获取 CustomMCP 工具列表失败，返回空数组:",
        error
      );
      return [];
    }
  }

  /**
   * 添加服务配置（重载方法以支持两种调用方式）
   */
  addServiceConfig(name: string, config: MCPServiceConfig): void;
  addServiceConfig(config: InternalMCPServiceConfig): void;
  addServiceConfig(
    nameOrConfig: string | MCPServiceConfig | InternalMCPServiceConfig,
    config?: MCPServiceConfig
  ): void {
    let finalConfig: MCPServiceConfig;
    let serviceName: string;

    if (typeof nameOrConfig === "string" && config) {
      // 两参数版本
      serviceName = nameOrConfig;
      finalConfig = config;
    } else if (typeof nameOrConfig === "object") {
      // 单参数版本（使用 InternalMCPServiceConfig）
      const internalConfig = nameOrConfig as InternalMCPServiceConfig;
      serviceName = internalConfig.name;
      finalConfig = internalConfig;
    } else {
      throw new Error("Invalid arguments for addServiceConfig");
    }

    // 增强配置
    const enhancedConfig = this.configSyncManager.enhanceServiceConfig(
      serviceName,
      finalConfig
    );

    // 存储增强后的配置
    this.lifecycleManager.addServiceConfig(serviceName, enhancedConfig);
    console.debug(`[MCPManager] 已添加服务配置: ${serviceName}`);
  }

  /**
   * 更新服务配置
   */
  updateServiceConfig(name: string, config: MCPServiceConfig): void {
    // 增强配置
    const enhancedConfig = this.configSyncManager.enhanceServiceConfig(name, config);

    // 存储增强后的配置
    this.lifecycleManager.updateServiceConfig(name, enhancedConfig);
    console.debug(`[MCPManager] 已更新并增强服务配置: ${name}`);
  }

  /**
   * 移除服务配置
   */
  removeServiceConfig(name: string): void {
    this.lifecycleManager.removeServiceConfig(name);
    console.debug(`[MCPManager] 已移除服务配置: ${name}`);
  }

  /**
   * 停止指定服务的重试
   */
  stopServiceRetry(serviceName: string): void {
    this.retryManager.stopServiceRetry(serviceName);
  }

  /**
   * 停止所有服务的重试
   */
  stopAllServiceRetries(): void {
    this.retryManager.stopAllServiceRetries();
  }

  /**
   * 获取失败服务列表
   */
  getFailedServices(): string[] {
    return this.retryManager.getFailedServices();
  }

  /**
   * 检查服务是否失败
   */
  isServiceFailed(serviceName: string): boolean {
    return this.retryManager.isServiceFailed(serviceName);
  }

  /**
   * 获取重试统计信息
   */
  getRetryStats(): ReturnType<typeof this.retryManager.getRetryStats> {
    return this.retryManager.getRetryStats();
  }

  /**
   * 获取消息处理器（供外部使用）
   */
  public getMessageHandler(): MCPMessageHandler {
    return this.messageHandler;
  }

  /**
   * 启动管理器
   */
  public async start(): Promise<void> {
    if (this.isRunning) {
      throw new Error("服务器已在运行");
    }

    console.info("启动 MCP 服务管理器");

    try {
      await this.startAllServices();
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
    const allServices = this.lifecycleManager.getAllServices();
    for (const [serviceName, service] of allServices) {
      if (service && service.isConnected()) {
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
   */
  public getActiveConnectionCount(): number {
    return this.getAllConnections().filter(
      (conn) => conn.state === ConnectionState.CONNECTED
    ).length;
  }

  /**
   * 获取服务器状态（从 UnifiedMCPServer 移入）
   */
  getUnifiedStatus(): UnifiedServerStatus {
    const serviceStatus = this.getServiceManagerStatus();
    return {
      isRunning: this.isRunning,
      serviceStatus,
      activeConnections: this.getActiveConnectionCount(),
      config: this.config,
      // 便捷访问属性
      services: serviceStatus.services,
      totalTools: serviceStatus.totalTools,
      availableTools: serviceStatus.availableTools,
    };
  }

  /**
   * 获取管理器状态
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
      customMCPToolCount = 0;
      customToolNames = [];
    }

    const toolsMap = this.getToolsMap();
    const totalTools = toolsMap.size + customMCPToolCount;

    // 获取所有可用工具名称
    const standardToolNames = Array.from(toolsMap.keys());
    const availableTools = [...standardToolNames, ...customToolNames];

    const status: ManagerStatus = {
      services: {},
      totalTools,
      availableTools,
    };

    // 添加标准 MCP 服务状态
    const allServices = this.lifecycleManager.getAllServices();
    for (const [serviceName, service] of allServices) {
      if (service) {
        const serviceStatus = service.getStatus();
        status.services[serviceName] = {
          connected: serviceStatus.connected,
          clientName: `xiaozhi-${serviceName}-client`,
        };
      }
    }

    // 添加 CustomMCP 服务状态
    if (customMCPToolCount > 0) {
      status.services.customMCP = {
        connected: true,
        clientName: "xiaozhi-customMCP-handler",
      };
    }

    return status;
  }

  /**
   * 检查服务器是否正在运行
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
   */
  async initialize(): Promise<void> {
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

  /**
   * 清理资源（实现 IMCPServiceManager 接口）
   */
  async cleanup(): Promise<void> {
    await this.stopAllServices();

    const eventBus = getEventBus();
    // 清理事件监听器，防止内存泄漏
    eventBus.offEvent(
      "mcp:service:connected",
      this.eventListeners.serviceConnected
    );
    eventBus.offEvent(
      "mcp:service:disconnected",
      this.eventListeners.serviceDisconnected
    );
    eventBus.offEvent(
      "mcp:service:connection:failed",
      this.eventListeners.serviceConnectionFailed
    );

    // 清理重试管理器
    this.retryManager.cleanup();
  }
}

export default MCPServiceManager;

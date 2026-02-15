/**
 * MCP 服务管理器
 * 使用组合模式组织多个子管理器，遵循单一职责原则
 *
 * 重构说明：
 * - 将原有的 1848 行代码拆分为多个子管理器
 * - 使用组合模式协调各子管理器
 * - 保持向后兼容的公共 API
 */

import { EventEmitter } from "node:events";
import { logger } from "@/Logger.js";
import { MCPCacheManager } from "@/lib/mcp/cache.js";
import { ConnectionState } from "@/lib/mcp/types";
import type {
  EnhancedToolInfo,
  MCPServiceConfig,
  ManagerStatus,
  ToolCallResult,
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
import { MCPConfigManager } from "./managers/index.js";
import { MCPServiceLifecycleManager } from "./managers/index.js";
import { MCPStatsManager } from "./managers/index.js";
import { MCPToolRegistry } from "./managers/index.js";
import { MCPMessageHandler } from "./message.js";

/**
 * MCP 服务管理器
 * 使用组合模式组织多个子管理器
 */
export class MCPServiceManager extends EventEmitter {
  // 子管理器
  private lifecycle: MCPServiceLifecycleManager;
  private tools: MCPToolRegistry;
  private stats: MCPStatsManager;
  private config: MCPConfigManager;

  // 共享组件
  private customMCPHandler: CustomMCPHandler;
  private cacheManager: MCPCacheManager;
  private toolCallLogger: ToolCallLogger;
  private eventBus = getEventBus();

  // 服务器状态管理（从 UnifiedMCPServer 移入）
  private isRunning = false;
  private serverConfig: UnifiedServerConfig;

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

  // 消息处理器
  private messageHandler: MCPMessageHandler;

  /**
   * 创建 MCPServiceManager 实例
   * @param configs 可选的初始服务配置或服务器配置
   */
  constructor(
    configs?: Record<string, MCPServiceConfig> | UnifiedServerConfig
  ) {
    super();

    // 处理参数，支持 UnifiedServerConfig 格式
    let serviceConfigs: Record<string, MCPServiceConfig>;
    if (configs && this.isUnifiedServerConfig(configs)) {
      // UnifiedServerConfig 格式
      this.serverConfig = {
        name: "MCPServiceManager",
        enableLogging: true,
        logLevel: "info",
        ...configs,
      };
      serviceConfigs = configs.configs || {};
    } else {
      // 原有的 configs 格式
      this.serverConfig = {
        name: "MCPServiceManager",
        enableLogging: true,
        logLevel: "info",
      };
      serviceConfigs = (configs || {}) as Record<string, MCPServiceConfig>;
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
    this.customMCPHandler = new CustomMCPHandler(this.cacheManager, this);

    // 初始化工具调用记录器
    const toolCallLogConfig = configManager.getToolCallLogConfig();
    const configDir = configManager.getConfigDir();
    this.toolCallLogger = new ToolCallLogger(toolCallLogConfig, configDir);

    // 初始化子管理器（顺序很重要，configManager 需要先初始化）
    this.config = new MCPConfigManager(serviceConfigs);

    // 创建用于刷新 CustomMCPHandler 的回调
    const refreshCustomMCPHandlerCallback = async () => {
      await this.refreshCustomMCPHandler();
    };

    this.lifecycle = new MCPServiceLifecycleManager(
      serviceConfigs,
      this.customMCPHandler,
      refreshCustomMCPHandlerCallback
    );

    this.tools = new MCPToolRegistry(
      this.customMCPHandler,
      this.cacheManager,
      this.toolCallLogger
    );

    this.stats = new MCPStatsManager();

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
  }

  /**
   * 设置事件监听器
   */
  private setupEventListeners(): void {
    // 监听MCP服务连接成功事件
    this.eventBus.onEvent(
      "mcp:service:connected",
      this.eventListeners.serviceConnected
    );

    // 监听MCP服务断开连接事件
    this.eventBus.onEvent(
      "mcp:service:disconnected",
      this.eventListeners.serviceDisconnected
    );

    // 监听MCP服务连接失败事件
    this.eventBus.onEvent(
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
    logger.debug(`服务 ${data.serviceName} 连接成功，开始刷新工具缓存`);

    try {
      // 获取最新的工具列表
      const service = this.lifecycle.getService(data.serviceName);
      if (service) {
        // 刷新工具缓存
        await this.tools.refreshToolsCache(
          this.lifecycle.getAllServices(),
          this.config.getAllServiceConfigs()
        );

        // 重新初始化CustomMCPHandler
        await this.refreshCustomMCPHandler();

        logger.info(`服务 ${data.serviceName} 工具缓存刷新完成`);
      }
    } catch (error) {
      logger.error(`刷新服务 ${data.serviceName} 工具缓存失败:`, error);
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
    logger.info(
      `服务 ${data.serviceName} 断开连接，原因: ${data.reason || "未知"}`
    );

    try {
      // 更新工具缓存
      await this.tools.refreshToolsCache(
        this.lifecycle.getAllServices(),
        this.config.getAllServiceConfigs()
      );

      // 重新初始化CustomMCPHandler
      await this.refreshCustomMCPHandler();

      logger.info(`服务 ${data.serviceName} 断开连接处理完成`);
    } catch (error) {
      logger.error(`服务 ${data.serviceName} 断开连接处理失败:`, error);
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
      await this.refreshCustomMCPHandler();
    } catch (error) {
      logger.error("刷新CustomMCPHandler失败:", error);
    }
  }

  /**
   * 刷新CustomMCPHandler的私有方法
   */
  private async refreshCustomMCPHandler(): Promise<void> {
    try {
      logger.debug("重新初始化CustomMCPHandler");
      this.customMCPHandler.initialize();
      logger.debug("CustomMCPHandler重新初始化完成");
    } catch (error) {
      logger.error("CustomMCPHandler重新初始化失败:", error);
      throw error;
    }
  }

  /**
   * 公开的CustomMCPHandler刷新方法，供外部调用
   */
  async refreshCustomMCPHandlerPublic(): Promise<void> {
    return this.refreshCustomMCPHandler();
  }

  // ===== 生命周期管理方法（委托给 LifecycleManager）=====

  /**
   * 启动所有 MCP 服务
   */
  async startAllServices(): Promise<void> {
    return this.lifecycle.startAllServices();
  }

  /**
   * 启动单个 MCP 服务
   */
  async startService(serviceName: string): Promise<void> {
    const result = this.lifecycle.startService(serviceName);

    // 启动后刷新工具缓存
    await this.tools.refreshToolsCache(
      this.lifecycle.getAllServices(),
      this.config.getAllServiceConfigs()
    );

    return result;
  }

  /**
   * 停止单个服务
   */
  async stopService(serviceName: string): Promise<void> {
    const result = this.lifecycle.stopService(serviceName);

    // 停止后刷新工具缓存
    await this.tools.refreshToolsCache(
      this.lifecycle.getAllServices(),
      this.config.getAllServiceConfigs()
    );

    return result;
  }

  /**
   * 停止所有服务
   */
  async stopAllServices(): Promise<void> {
    const result = this.lifecycle.stopAllServices();

    // 清理统计更新锁
    try {
      this.stats.clearAllStatsUpdateLocks();
      logger.info("[MCPManager] 统计更新锁已清理");
    } catch (error) {
      logger.error("[MCPManager] 清理统计更新锁失败:", error);
    }

    return result;
  }

  // ===== 工具管理方法（委托给 ToolRegistry）=====

  /**
   * 获取所有可用工具
   */
  getAllTools(status: ToolStatusFilter = "all"): EnhancedToolInfo[] {
    return this.tools.getAllTools(this.lifecycle.getAllServices(), status);
  }

  /**
   * 调用 MCP 工具
   */
  async callTool(
    toolName: string,
    arguments_: Record<string, unknown>,
    options?: { timeout?: number }
  ): Promise<ToolCallResult> {
    return this.tools.callTool(
      toolName,
      arguments_,
      options,
      this.lifecycle.getAllServices(),
      (toolName, serviceName, originalToolName, isSuccess) =>
        this.stats.updateToolStatsSafe(
          toolName,
          serviceName,
          originalToolName,
          isSuccess
        )
    );
  }

  /**
   * 检查是否存在指定工具
   */
  hasTool(toolName: string): boolean {
    return this.tools.hasTool(toolName);
  }

  /**
   * 检查指定的 customMCP 工具是否存在
   */
  hasCustomMCPTool(toolName: string): boolean {
    return this.tools.hasCustomMCPTool(toolName);
  }

  /**
   * 获取所有 customMCP 工具列表
   */
  getCustomMCPTools(): Tool[] {
    return this.tools.getCustomMCPTools();
  }

  /**
   * 获取 CustomMCP 处理器实例
   */
  getCustomMCPHandler(): CustomMCPHandler {
    return this.tools.getCustomMCPHandler();
  }

  // ===== 配置管理方法（委托给 ConfigManager）=====

  /**
   * 添加服务配置
   */
  addServiceConfig(name: string, serviceConfig: MCPServiceConfig): void {
    this.config.addServiceConfig(name, serviceConfig);
    // 同步更新 LifecycleManager 中的配置
    this.lifecycle.addServiceConfig(name, serviceConfig);
  }

  /**
   * 更新服务配置
   */
  updateServiceConfig(name: string, serviceConfig: MCPServiceConfig): void {
    this.config.updateServiceConfig(name, serviceConfig);
    // 同步更新 LifecycleManager 中的配置
    this.lifecycle.updateServiceConfig(name, serviceConfig);
  }

  /**
   * 移除服务配置
   */
  removeServiceConfig(name: string): void {
    this.config.removeServiceConfig(name);
    // 同步更新 LifecycleManager 中的配置
    this.lifecycle.removeServiceConfig(name);
  }

  // ===== 统计管理方法（委托给 StatsManager）=====

  /**
   * 获取统计更新监控信息
   */
  getStatsUpdateInfo(): {
    activeLocks: string[];
    totalLocks: number;
  } {
    return this.stats.getStatsUpdateInfo();
  }

  // ===== 状态查询方法 =====

  /**
   * 获取服务器状态（兼容 UnifiedServerStatus 格式）
   */
  getStatus(): UnifiedServerStatus {
    return this.getUnifiedStatus();
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
      logger.debug(
        `[MCPManager] 成功获取 customMCP 状态: ${customMCPToolCount} 个工具`
      );
    } catch (error) {
      logger.warn(
        "[MCPManager] 获取 CustomMCP 状态失败，将只包含标准 MCP 工具:",
        error
      );
      // 异常情况下，customMCP 工具数量为0，不影响标准 MCP 工具
      customMCPToolCount = 0;
      customToolNames = [];
    }

    const standardTools = this.tools.getAllTools(
      this.lifecycle.getAllServices(),
      "all"
    );
    const totalTools = standardTools.length + customMCPToolCount;

    // 获取所有可用工具名称
    const standardToolNames = standardTools.map((t) => t.name);
    const availableTools = [...standardToolNames, ...customToolNames];

    const status: ManagerStatus = {
      services: {},
      totalTools,
      availableTools,
    };

    // 添加标准 MCP 服务状态
    for (const [serviceName, service] of this.lifecycle.getAllServices()) {
      const serviceStatus = (
        service as { getStatus?: () => { connected: boolean } }
      )?.getStatus?.();
      status.services[serviceName] = {
        connected: serviceStatus?.connected ?? false,
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
    for (const [serviceName, service] of this.lifecycle.getAllServices()) {
      const isConnected = (
        service as { isConnected?: () => boolean }
      )?.isConnected?.();
      if (isConnected) {
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
   * 获取指定服务实例
   */
  getService(name: string): unknown {
    return this.lifecycle.getService(name);
  }

  /**
   * 获取所有已连接的服务名称
   */
  getConnectedServices(): string[] {
    return this.lifecycle.getConnectedServices();
  }

  /**
   * 获取所有服务实例
   */
  getAllServices(): Map<string, unknown> {
    return this.lifecycle.getAllServices() as Map<string, unknown>;
  }

  // ===== 重试机制方法（委托给 LifecycleManager）=====

  /**
   * 停止指定服务的重试
   */
  stopServiceRetry(serviceName: string): void {
    this.lifecycle.stopServiceRetry(serviceName);
  }

  /**
   * 停止所有服务的重试
   */
  stopAllServiceRetries(): void {
    this.lifecycle.stopAllServiceRetries();
  }

  /**
   * 获取失败服务列表
   */
  getFailedServices(): string[] {
    return this.lifecycle.getFailedServices();
  }

  /**
   * 检查服务是否失败
   */
  isServiceFailed(serviceName: string): boolean {
    return this.lifecycle.isServiceFailed(serviceName);
  }

  /**
   * 获取重试统计信息
   */
  getRetryStats(): {
    failedServices: string[];
    activeRetries: string[];
    totalFailed: number;
    totalActiveRetries: number;
  } {
    return this.lifecycle.getRetryStats();
  }

  // ===== 服务器管理方法（从 UnifiedMCPServer 移入）=====

  /**
   * 获取服务器状态（从 UnifiedMCPServer 移入）
   */
  getUnifiedStatus(): UnifiedServerStatus {
    const serviceStatus = this.getServiceManagerStatus();
    return {
      isRunning: this.isRunning,
      serviceStatus,
      activeConnections: this.getActiveConnectionCount(),
      config: this.serverConfig,
      // 便捷访问属性
      services: serviceStatus.services,
      totalTools: serviceStatus.totalTools,
      availableTools: serviceStatus.availableTools,
    };
  }

  /**
   * 检查服务器是否正在运行（从 UnifiedMCPServer 移入）
   */
  isServerRunning(): boolean {
    return this.isRunning;
  }

  /**
   * 启动管理器
   */
  public async start(): Promise<void> {
    if (this.isRunning) {
      throw new Error("服务器已在运行");
    }

    logger.info("启动 MCP 服务管理器");

    try {
      await this.startAllServices();
      this.isRunning = true;

      logger.info("MCP 服务管理器启动成功");
      this.emit("started");
    } catch (error) {
      logger.error("MCP 服务管理器启动失败", error);
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

    logger.info("停止 MCP 服务管理器");

    try {
      await this.stopAllServices();
      this.isRunning = false;

      logger.info("MCP 服务管理器停止成功");
      this.emit("stopped");
    } catch (error) {
      logger.error("MCP 服务管理器停止失败", error);
      throw error;
    }
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

  /**
   * 获取消息处理器（供外部使用）
   */
  public getMessageHandler(): MCPMessageHandler {
    return this.messageHandler;
  }

  // ===== 向后兼容方法 =====

  /**
   * 初始化方法（向后兼容，实际调用 start）
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

  /**
   * 清理资源（实现 IMCPServiceManager 接口）
   */
  async cleanup(): Promise<void> {
    await this.stopAllServices();

    // 清理事件监听器，防止内存泄漏
    this.eventBus.offEvent(
      "mcp:service:connected",
      this.eventListeners.serviceConnected
    );
    this.eventBus.offEvent(
      "mcp:service:disconnected",
      this.eventListeners.serviceDisconnected
    );
    this.eventBus.offEvent(
      "mcp:service:connection:failed",
      this.eventListeners.serviceConnectionFailed
    );
  }
}

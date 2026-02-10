/**
 * 配置管理类
 * 负责管理应用配置，提供只读访问和安全的配置更新功能
 *
 * 重构说明：
 * - 已将功能拆分到独立模块中：
 *   - types.ts: 类型定义
 *   - events.ts: 事件发布订阅
 *   - storage.ts: 配置存储和序列化
 *   - validator.ts: 配置验证
 *   - endpoints.ts: 端点管理
 *   - servers.ts: MCP服务器管理
 *   - tools.ts: 工具配置管理
 *   - connection.ts: 连接配置管理
 *   - platforms.ts: 平台配置管理
 *   - stats.ts: 统计信息管理
 * - ConfigManager 现在作为统一入口，委托给各个专业模块
 */

import type {
  AppConfig,
  MCPServerConfig,
  MCPToolConfig,
  CustomMCPTool,
  ConnectionConfig,
  ModelScopeConfig,
  WebUIConfig,
  PlatformConfig,
  CozePlatformConfig,
  ToolCallLogConfig,
  MCPServerToolsConfig,
} from "./types.js";
import { configStorage } from "./storage.js";
import { configEvents } from "./events.js";
import { configValidator } from "./validator.js";
import { configEndpoints } from "./endpoints.js";
import { configServers } from "./servers.js";
import { configTools } from "./tools.js";
import { configConnection } from "./connection.js";
import { configPlatforms } from "./platforms.js";
import { configStats } from "./stats.js";
import type { WebServerInstance } from "./types.js";

/**
 * 配置管理类
 * 负责管理应用配置，提供只读访问和安全的配置更新功能
 */
export class ConfigManager {
  private static instance: ConfigManager;

  private constructor() {}

  /**
   * 获取配置管理器单例实例
   */
  public static getInstance(): ConfigManager {
    if (!ConfigManager.instance) {
      ConfigManager.instance = new ConfigManager();
    }
    return ConfigManager.instance;
  }

  // ============ 配置文件操作 ============

  /**
   * 检查配置文件是否存在
   */
  public configExists(): boolean {
    return configStorage.configExists();
  }

  /**
   * 初始化配置文件
   * @param format 配置文件格式，默认为 json
   */
  public initConfig(format: "json" | "json5" | "jsonc" = "json"): void {
    configStorage.initConfig(format);
  }

  /**
   * 获取配置（只读）
   */
  public getConfig(): Readonly<AppConfig> {
    return configStorage.loadConfig();
  }

  /**
   * 重新加载配置（清除缓存）
   */
  public reloadConfig(): void {
    configStorage.reloadConfig();
  }

  /**
   * 获取配置文件路径
   */
  public getConfigPath(): string {
    return configStorage.getConfigFilePath();
  }

  /**
   * 获取默认配置文件路径
   */
  public getDefaultConfigPath(): string {
    return configStorage.getDefaultConfigPath();
  }

  /**
   * 获取配置目录路径
   */
  public getConfigDir(): string {
    return configStorage.getConfigDir();
  }

  // ============ 事件管理 ============

  /**
   * 注册事件监听器
   */
  public on(eventName: string, callback: (data: unknown) => void): void {
    configEvents.on(eventName, callback);
  }

  // ============ 配置验证 ============

  /**
   * 验证配置文件结构
   */
  public validateConfig(config: unknown): void {
    configValidator.validateConfig(config);
  }

  // ============ 端点管理 ============

  /**
   * 获取 MCP 端点（向后兼容）
   * @deprecated 使用 getMcpEndpoints() 获取所有端点
   */
  public getMcpEndpoint(): string {
    return configEndpoints.getMcpEndpoint();
  }

  /**
   * 获取所有 MCP 端点
   */
  public getMcpEndpoints(): string[] {
    return configEndpoints.getMcpEndpoints();
  }

  /**
   * 更新 MCP 端点（支持字符串或数组）
   */
  public updateMcpEndpoint(endpoint: string | string[]): void {
    configEndpoints.updateMcpEndpoint(endpoint);
  }

  /**
   * 添加 MCP 端点
   */
  public addMcpEndpoint(endpoint: string): void {
    configEndpoints.addMcpEndpoint(endpoint);
  }

  /**
   * 移除 MCP 端点
   */
  public removeMcpEndpoint(endpoint: string): void {
    configEndpoints.removeMcpEndpoint(endpoint);
  }

  // ============ MCP 服务器管理 ============

  /**
   * 获取 MCP 服务配置
   */
  public getMcpServers(): Readonly<Record<string, MCPServerConfig>> {
    return configServers.getMcpServers();
  }

  /**
   * 更新 MCP 服务配置
   */
  public updateMcpServer(serverName: string, serverConfig: MCPServerConfig): void {
    configServers.updateMcpServer(serverName, serverConfig);
  }

  /**
   * 删除 MCP 服务配置
   */
  public removeMcpServer(serverName: string): void {
    configServers.removeMcpServer(serverName);
  }

  // ============ 工具配置管理 ============

  /**
   * 获取 MCP 服务工具配置
   */
  public getMcpServerConfig(): Readonly<Record<string, MCPServerToolsConfig>> {
    return configTools.getMcpServerConfig();
  }

  /**
   * 获取指定服务的工具配置
   */
  public getServerToolsConfig(serverName: string): Readonly<Record<string, MCPToolConfig>> {
    return configTools.getServerToolsConfig(serverName);
  }

  /**
   * 检查工具是否启用
   */
  public isToolEnabled(serverName: string, toolName: string): boolean {
    return configTools.isToolEnabled(serverName, toolName);
  }

  /**
   * 更新服务工具配置
   */
  public updateServerToolsConfig(
    serverName: string,
    toolsConfig: Record<string, MCPToolConfig>
  ): void {
    configTools.updateServerToolsConfig(serverName, toolsConfig);
  }

  /**
   * 删除指定服务器的工具配置
   */
  public removeServerToolsConfig(serverName: string): void {
    configTools.removeServerToolsConfig(serverName);
  }

  /**
   * 清理无效的服务器工具配置
   */
  public cleanupInvalidServerToolsConfig(): void {
    configTools.cleanupInvalidServerToolsConfig();
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
    configTools.setToolEnabled(serverName, toolName, enabled, description);
  }

  // ============ CustomMCP 工具管理 ============

  /**
   * 获取 customMCP 配置
   */
  public getCustomMCPConfig(): CustomMCPTool[] | null {
    return configTools.getCustomMCPConfig();
  }

  /**
   * 获取 customMCP 工具列表
   */
  public getCustomMCPTools(): CustomMCPTool[] {
    return configTools.getCustomMCPTools();
  }

  /**
   * 验证 customMCP 工具配置
   */
  public validateCustomMCPTools(tools: CustomMCPTool[]): boolean {
    return configValidator.validateCustomMCPTools(tools);
  }

  /**
   * 检查是否配置了有效的 customMCP 工具
   */
  public hasValidCustomMCPTools(): boolean {
    return configTools.hasValidCustomMCPTools();
  }

  /**
   * 添加自定义 MCP 工具
   */
  public addCustomMCPTool(tool: CustomMCPTool): void {
    configTools.addCustomMCPTool(tool);
  }

  /**
   * 批量添加自定义 MCP 工具
   */
  public async addCustomMCPTools(tools: CustomMCPTool[]): Promise<void> {
    return configTools.addCustomMCPTools(tools);
  }

  /**
   * 删除自定义 MCP 工具
   */
  public removeCustomMCPTool(toolName: string): void {
    configTools.removeCustomMCPTool(toolName);
  }

  /**
   * 更新单个自定义 MCP 工具配置
   */
  public updateCustomMCPTool(toolName: string, updatedTool: CustomMCPTool): void {
    configTools.updateCustomMCPTool(toolName, updatedTool);
  }

  /**
   * 更新自定义 MCP 工具配置
   */
  public updateCustomMCPTools(tools: CustomMCPTool[]): void {
    configTools.updateCustomMCPTools(tools);
  }

  // ============ 连接配置管理 ============

  /**
   * 获取连接配置（包含默认值）
   */
  public getConnectionConfig(): {
    heartbeatInterval: number;
    heartbeatTimeout: number;
    reconnectInterval: number;
  } {
    return configConnection.getConnectionConfig();
  }

  /**
   * 获取心跳检测间隔（毫秒）
   */
  public getHeartbeatInterval(): number {
    return configConnection.getHeartbeatInterval();
  }

  /**
   * 获取心跳超时时间（毫秒）
   */
  public getHeartbeatTimeout(): number {
    return configConnection.getHeartbeatTimeout();
  }

  /**
   * 获取重连间隔（毫秒）
   */
  public getReconnectInterval(): number {
    return configConnection.getReconnectInterval();
  }

  /**
   * 更新连接配置
   */
  public updateConnectionConfig(connectionConfig: Partial<ConnectionConfig>): void {
    configConnection.updateConnectionConfig(connectionConfig);
  }

  /**
   * 设置心跳检测间隔
   */
  public setHeartbeatInterval(interval: number): void {
    configConnection.setHeartbeatInterval(interval);
  }

  /**
   * 设置心跳超时时间
   */
  public setHeartbeatTimeout(timeout: number): void {
    configConnection.setHeartbeatTimeout(timeout);
  }

  /**
   * 设置重连间隔
   */
  public setReconnectInterval(interval: number): void {
    configConnection.setReconnectInterval(interval);
  }

  // ============ ModelScope 配置管理 ============

  /**
   * 获取 ModelScope 配置
   */
  public getModelScopeConfig(): Readonly<ModelScopeConfig> {
    return configPlatforms.getModelScopeConfig();
  }

  /**
   * 获取 ModelScope API Key
   */
  public getModelScopeApiKey(): string | undefined {
    return configPlatforms.getModelScopeApiKey();
  }

  /**
   * 更新 ModelScope 配置
   */
  public updateModelScopeConfig(modelScopeConfig: Partial<ModelScopeConfig>): void {
    configPlatforms.updateModelScopeConfig(modelScopeConfig);
  }

  /**
   * 设置 ModelScope API Key
   */
  public setModelScopeApiKey(apiKey: string): void {
    configPlatforms.setModelScopeApiKey(apiKey);
  }

  // ============ WebUI 配置管理 ============

  /**
   * 获取 Web UI 配置
   */
  public getWebUIConfig(): Readonly<WebUIConfig> {
    return configPlatforms.getWebUIConfig();
  }

  /**
   * 获取 Web UI 端口号
   */
  public getWebUIPort(): number {
    return configPlatforms.getWebUIPort();
  }

  /**
   * 更新 Web UI 配置
   */
  public updateWebUIConfig(webUIConfig: Partial<WebUIConfig>): void {
    configPlatforms.updateWebUIConfig(webUIConfig);
  }

  /**
   * 设置 Web UI 端口号
   */
  public setWebUIPort(port: number): void {
    configPlatforms.setWebUIPort(port);
  }

  /**
   * 通知 Web 界面配置已更新
   */
  public notifyConfigUpdate(config: AppConfig): void {
    try {
      // 检查是否有全局的 webServer 实例（当使用 --ui 参数启动时会设置）
      const webServer = (
        global as typeof global & { __webServer?: WebServerInstance }
      ).__webServer;
      if (webServer && typeof webServer.broadcastConfigUpdate === "function") {
        // 调用 webServer 的 broadcastConfigUpdate 方法来通知所有连接的客户端
        webServer.broadcastConfigUpdate(config);
        console.log("已通过 WebSocket 广播配置更新");
      }
    } catch (error) {
      // 静默处理错误，不影响配置保存的主要功能
      console.warn(
        "通知 Web 界面配置更新失败:",
        error instanceof Error ? error.message : String(error)
      );
    }
  }

  // ============ 平台配置管理 ============

  /**
   * 更新平台配置
   */
  public updatePlatformConfig(platformName: string, platformConfig: PlatformConfig): void {
    configPlatforms.updatePlatformConfig(platformName, platformConfig);
  }

  /**
   * 获取扣子平台配置
   */
  public getCozePlatformConfig(): CozePlatformConfig | null {
    return configPlatforms.getCozePlatformConfig();
  }

  /**
   * 获取扣子 API Token
   */
  public getCozeToken(): string | null {
    return configPlatforms.getCozeToken();
  }

  /**
   * 设置扣子平台配置
   */
  public setCozePlatformConfig(config: CozePlatformConfig): void {
    configPlatforms.setCozePlatformConfig(config);
  }

  /**
   * 检查扣子平台配置是否有效
   */
  public isCozeConfigValid(): boolean {
    return configPlatforms.isCozeConfigValid();
  }

  // ============ 工具调用日志配置管理 ============

  /**
   * 获取工具调用日志配置
   */
  public getToolCallLogConfig(): Readonly<ToolCallLogConfig> {
    return configPlatforms.getToolCallLogConfig();
  }

  /**
   * 更新工具调用日志配置
   */
  public updateToolCallLogConfig(toolCallLogConfig: Partial<ToolCallLogConfig>): void {
    configPlatforms.updateToolCallLogConfig(toolCallLogConfig);
  }

  // ============ 统计信息管理 ============

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
    if (typeof arg2 === "string" && arg3) {
      return configStats.updateToolUsageStats(arg1, arg2, arg3);
    }
    return configStats.updateToolUsageStats(arg1, arg2 as boolean | undefined);
  }

  /**
   * 更新 MCP 服务工具统计信息（重载方法）
   */
  public async updateMCPServerToolStats(
    serviceName: string,
    toolName: string,
    callTime: string,
    incrementUsageCount = true
  ): Promise<void> {
    return configStats.updateMCPServerToolStats(
      serviceName,
      toolName,
      callTime,
      incrementUsageCount
    );
  }

  /**
   * 带并发控制的工具统计更新（CustomMCP 工具）
   */
  public async updateToolUsageStatsWithLock(
    toolName: string,
    incrementUsageCount = true
  ): Promise<void> {
    return configStats.updateToolUsageStatsWithLock(toolName, incrementUsageCount);
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
    return configStats.updateMCPServerToolStatsWithLock(
      serviceName,
      toolName,
      callTime,
      incrementUsageCount
    );
  }

  /**
   * 清理所有统计更新锁（用于异常恢复）
   */
  public clearAllStatsUpdateLocks(): void {
    configStats.clearAllStatsUpdateLocks();
  }

  /**
   * 获取统计更新锁状态（用于调试和监控）
   */
  public getStatsUpdateLocks(): string[] {
    return configStats.getStatsUpdateLocks();
  }

  // ============ 批量配置更新 ============

  /**
   * 批量更新配置（由 Handler 调用）
   */
  public updateConfig(newConfig: Partial<AppConfig>): void {
    const config = configStorage.loadConfig();

    // 更新 MCP 端点
    if (newConfig.mcpEndpoint !== undefined) {
      config.mcpEndpoint = newConfig.mcpEndpoint;
    }

    // 更新 MCP 服务
    if (newConfig.mcpServers) {
      const currentServers = { ...config.mcpServers };
      for (const [name, serverConfig] of Object.entries(newConfig.mcpServers)) {
        config.mcpServers[name] = serverConfig;
      }
      // 删除不存在的服务
      for (const name of Object.keys(currentServers)) {
        if (!(name in newConfig.mcpServers)) {
          delete config.mcpServers[name];
          // 同时清理工具配置
          if (config.mcpServerConfig?.[name]) {
            delete config.mcpServerConfig[name];
          }
        }
      }
    }

    // 更新连接配置
    if (newConfig.connection) {
      if (!config.connection) {
        config.connection = {};
      }
      Object.assign(config.connection, newConfig.connection);
    }

    // 更新 ModelScope 配置
    if (newConfig.modelscope) {
      if (!config.modelscope) {
        config.modelscope = {};
      }
      Object.assign(config.modelscope, newConfig.modelscope);
    }

    // 更新 Web UI 配置
    if (newConfig.webUI) {
      if (!config.webUI) {
        config.webUI = {};
      }
      Object.assign(config.webUI, newConfig.webUI);
    }

    // 更新服务工具配置
    if (newConfig.mcpServerConfig) {
      for (const [serverName, toolsConfig] of Object.entries(
        newConfig.mcpServerConfig
      )) {
        if (config.mcpServerConfig?.[serverName]) {
          config.mcpServerConfig[serverName] = toolsConfig;
        }
      }
    }

    // 更新平台配置
    if (newConfig.platforms) {
      for (const [platformName, platformConfig] of Object.entries(
        newConfig.platforms
      )) {
        if (!config.platforms) {
          config.platforms = {};
        }
        config.platforms[platformName] = platformConfig;
      }
    }

    configStorage.saveConfig(config);

    // 发射配置更新事件
    configEvents.emit("config:updated", {
      type: "config",
      timestamp: new Date(),
    });
  }
}

// 导出单例实例
export const configManager = ConfigManager.getInstance();

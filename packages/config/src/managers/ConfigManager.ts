/**
 * 配置管理器（外观模式）
 *
 * 这是重构后的 ConfigManager，采用外观模式委托给专门的管理器：
 * - ConfigStore: 核心配置 I/O
 * - MCPConfigManager: MCP 端点和服务器管理
 * - ToolConfigManager: 工具配置和统计管理
 * - ConnectionConfigManager: 连接配置管理
 * - ModelScopeConfigManager: ModelScope 配置管理
 * - CustomMCPConfigManager: CustomMCP 工具管理
 * - PlatformConfigManager: 平台配置管理
 * - MediaConfigManager: TTS/ASR/LLM 配置管理
 * - WebUIConfigManager: WebUI 和工具调用日志配置管理
 *
 * @example
 * ```typescript
 * import { configManager } from '@xiaozhi-client/config';
 *
 * // 获取配置
 * const config = configManager.getConfig();
 *
 * // 更新 MCP 端点
 * configManager.updateMcpEndpoint('wss://...');
 *
 * // 监听配置更新事件
 * configManager.on('config:updated', (payload) => {
 *   console.log('配置已更新事件:', payload);
 * });
 * ```
 */

import type {
  AppConfig,
  MCPServerConfig,
  MCPToolConfig,
  ConnectionConfig,
  ModelScopeConfig,
  WebUIConfig,
  ToolCallLogConfig,
  TTSConfig,
  ASRConfig,
  LLMConfig,
  PlatformsConfig,
  PlatformConfig,
  CozePlatformConfig,
  CustomMCPConfig,
  CustomMCPTool,
} from "../types.js";

import { ConfigStore } from "./ConfigStore.js";
import { MCPConfigManager } from "./MCPConfigManager.js";
import { ToolConfigManager } from "./ToolConfigManager.js";
import { ConnectionConfigManager } from "./ConnectionConfigManager.js";
import { ModelScopeConfigManager } from "./ModelScopeConfigManager.js";
import { CustomMCPConfigManager } from "./CustomMCPConfigManager.js";
import { PlatformConfigManager } from "./PlatformConfigManager.js";
import { MediaConfigManager } from "./MediaConfigManager.js";
import { WebUIConfigManager } from "./WebUIConfigManager.js";

// 重新导出所有类型
export type {
  AppConfig,
  MCPServerConfig,
  LocalMCPServerConfig,
  SSEMCPServerConfig,
  HTTPMCPServerConfig,
  StreamableHTTPMCPServerConfig,
  MCPToolConfig,
  MCPServerToolsConfig,
  ConnectionConfig,
  ModelScopeConfig,
  WebUIConfig,
  ToolCallLogConfig,
  TTSConfig,
  ASRConfig,
  LLMConfig,
  PlatformsConfig,
  PlatformConfig,
  CozePlatformConfig,
  CustomMCPConfig,
  CustomMCPTool,
  HandlerConfig,
  ProxyHandlerConfig,
  HttpHandlerConfig,
  FunctionHandlerConfig,
  ScriptHandlerConfig,
  ChainHandlerConfig,
  MCPHandlerConfig,
  WebServerInstance,
} from "../types.js";

/**
 * 配置管理类（外观模式）
 * 负责管理应用配置，通过委托给专门的管理器实现各功能
 */
export class ConfigManager {
  private static instance: ConfigManager;

  // 核心存储
  private readonly store: ConfigStore;

  // 专用管理器
  private readonly mcpConfig: MCPConfigManager;
  private readonly toolConfig: ToolConfigManager;
  private readonly connectionConfig: ConnectionConfigManager;
  private readonly modelScopeConfig: ModelScopeConfigManager;
  private readonly customMCPConfig: CustomMCPConfigManager;
  private readonly platformConfig: PlatformConfigManager;
  private readonly mediaConfig: MediaConfigManager;
  private readonly webUIConfig: WebUIConfigManager;

  private constructor() {
    this.store = new ConfigStore();
    this.mcpConfig = new MCPConfigManager(this.store);
    this.toolConfig = new ToolConfigManager(this.store);
    this.connectionConfig = new ConnectionConfigManager(this.store);
    this.modelScopeConfig = new ModelScopeConfigManager(this.store);
    this.customMCPConfig = new CustomMCPConfigManager(this.store);
    this.platformConfig = new PlatformConfigManager(this.store);
    this.mediaConfig = new MediaConfigManager(this.store);
    this.webUIConfig = new WebUIConfigManager(this.store);
  }

  /**
   * 获取配置管理器单例实例
   */
  public static getInstance(): ConfigManager {
    if (!ConfigManager.instance) {
      ConfigManager.instance = new ConfigManager();
    }
    return ConfigManager.instance;
  }

  // ==================== 核心配置 I/O ====================

  /**
   * 注册事件监听器
   */
  public on(eventName: string, callback: (data: unknown) => void): void {
    this.store.on(eventName, callback);
  }

  /**
   * 检查配置文件是否存在
   */
  public configExists(): boolean {
    return this.store.configExists();
  }

  /**
   * 初始化配置文件
   */
  public initConfig(format: "json" | "json5" | "jsonc" = "json"): void {
    this.store.initConfig(format);
  }

  /**
   * 验证配置文件结构
   */
  public validateConfig(config: unknown): void {
    this.store.validateConfig(config);
  }

  /**
   * 获取配置（只读）
   */
  public getConfig(): Readonly<AppConfig> {
    return this.store.getConfig();
  }

  /**
   * 重新加载配置（清除缓存）
   */
  public reloadConfig(): void {
    this.store.reloadConfig();
  }

  /**
   * 获取配置文件路径
   */
  public getConfigPath(): string {
    return this.store.getConfigPath();
  }

  /**
   * 获取默认配置文件路径
   */
  public getDefaultConfigPath(): string {
    return this.store.getDefaultConfigPath();
  }

  /**
   * 获取配置目录路径
   */
  public getConfigDir(): string {
    return this.store.getConfigDir();
  }

  // ==================== MCP 配置 ====================

  /**
   * 获取 MCP 端点（向后兼容）
   * @deprecated 使用 getMcpEndpoints() 获取所有端点
   */
  public getMcpEndpoint(): string {
    return this.mcpConfig.getMcpEndpoint();
  }

  /**
   * 获取所有 MCP 端点
   */
  public getMcpEndpoints(): string[] {
    return this.mcpConfig.getMcpEndpoints();
  }

  /**
   * 更新 MCP 端点（支持字符串或数组）
   */
  public updateMcpEndpoint(endpoint: string | string[]): void {
    this.mcpConfig.updateMcpEndpoint(endpoint);
  }

  /**
   * 添加 MCP 端点
   */
  public addMcpEndpoint(endpoint: string): void {
    this.mcpConfig.addMcpEndpoint(endpoint);
  }

  /**
   * 移除 MCP 端点
   */
  public removeMcpEndpoint(endpoint: string): void {
    this.mcpConfig.removeMcpEndpoint(endpoint);
  }

  /**
   * 获取 MCP 服务配置
   */
  public getMcpServers(): Readonly<Record<string, MCPServerConfig>> {
    return this.mcpConfig.getMcpServers();
  }

  /**
   * 获取 MCP 服务工具配置
   */
  public getMcpServerConfig(): Readonly<
    Record<string, import("../types.js").MCPServerToolsConfig>
  > {
    return this.mcpConfig.getMcpServerConfig();
  }

  /**
   * 获取指定服务的工具配置
   */
  public getServerToolsConfig(
    serverName: string
  ): Readonly<Record<string, MCPToolConfig>> {
    return this.mcpConfig.getServerToolsConfig(serverName);
  }

  /**
   * 更新 MCP 服务配置
   */
  public updateMcpServer(serverName: string, serverConfig: MCPServerConfig): void {
    this.mcpConfig.updateMcpServer(serverName, serverConfig);
  }

  /**
   * 删除 MCP 服务配置
   */
  public removeMcpServer(serverName: string): void {
    this.mcpConfig.removeMcpServer(serverName);
  }

  /**
   * 更新服务工具配置
   */
  public updateServerToolsConfig(
    serverName: string,
    toolsConfig: Record<string, MCPToolConfig>
  ): void {
    this.mcpConfig.updateServerToolsConfig(serverName, toolsConfig);
  }

  /**
   * 删除指定服务器的工具配置
   */
  public removeServerToolsConfig(serverName: string): void {
    this.mcpConfig.removeServerToolsConfig(serverName);
  }

  /**
   * 清理无效的服务器工具配置
   */
  public cleanupInvalidServerToolsConfig(): void {
    this.mcpConfig.cleanupInvalidServerToolsConfig();
  }

  // ==================== 工具配置 ====================

  /**
   * 检查工具是否启用
   */
  public isToolEnabled(serverName: string, toolName: string): boolean {
    return this.toolConfig.isToolEnabled(serverName, toolName);
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
    this.toolConfig.setToolEnabled(serverName, toolName, enabled, description);
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
    if (typeof arg2 === "string" && arg3) {
      return this.toolConfig.updateToolUsageStats(arg1, arg2, arg3);
    } else {
      return this.toolConfig.updateToolUsageStats(arg1, arg2 as boolean | undefined);
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
    return this.toolConfig.updateMCPServerToolStats(
      serviceName,
      toolName,
      callTime,
      incrementUsageCount
    );
  }

  /**
   * 获取统计更新锁状态（用于调试和监控）
   */
  public getStatsUpdateLocks(): string[] {
    return this.toolConfig.getStatsUpdateLocks();
  }

  // ==================== 连接配置 ====================

  /**
   * 获取连接配置（包含默认值）
   */
  public getConnectionConfig(): Required<ConnectionConfig> {
    return this.connectionConfig.getConnectionConfig();
  }

  /**
   * 获取心跳检测间隔（毫秒）
   */
  public getHeartbeatInterval(): number {
    return this.connectionConfig.getHeartbeatInterval();
  }

  /**
   * 获取心跳超时时间（毫秒）
   */
  public getHeartbeatTimeout(): number {
    return this.connectionConfig.getHeartbeatTimeout();
  }

  /**
   * 获取重连间隔（毫秒）
   */
  public getReconnectInterval(): number {
    return this.connectionConfig.getReconnectInterval();
  }

  /**
   * 更新连接配置
   */
  public updateConnectionConfig(connectionConfig: Partial<ConnectionConfig>): void {
    this.connectionConfig.updateConnectionConfig(connectionConfig);
  }

  /**
   * 设置心跳检测间隔
   */
  public setHeartbeatInterval(interval: number): void {
    this.connectionConfig.setHeartbeatInterval(interval);
  }

  /**
   * 设置心跳超时时间
   */
  public setHeartbeatTimeout(timeout: number): void {
    this.connectionConfig.setHeartbeatTimeout(timeout);
  }

  /**
   * 设置重连间隔
   */
  public setReconnectInterval(interval: number): void {
    this.connectionConfig.setReconnectInterval(interval);
  }

  // ==================== ModelScope 配置 ====================

  /**
   * 获取 ModelScope 配置
   */
  public getModelScopeConfig(): Readonly<ModelScopeConfig> {
    return this.modelScopeConfig.getModelScopeConfig();
  }

  /**
   * 获取 ModelScope API Key
   */
  public getModelScopeApiKey(): string | undefined {
    return this.modelScopeConfig.getModelScopeApiKey();
  }

  /**
   * 更新 ModelScope 配置
   */
  public updateModelScopeConfig(modelScopeConfig: Partial<ModelScopeConfig>): void {
    this.modelScopeConfig.updateModelScopeConfig(modelScopeConfig);
  }

  /**
   * 设置 ModelScope API Key
   */
  public setModelScopeApiKey(apiKey: string): void {
    this.modelScopeConfig.setModelScopeApiKey(apiKey);
  }

  // ==================== CustomMCP 配置 ====================

  /**
   * 获取 customMCP 配置
   */
  public getCustomMCPConfig(): CustomMCPConfig | null {
    return this.customMCPConfig.getCustomMCPConfig();
  }

  /**
   * 获取 customMCP 工具列表
   */
  public getCustomMCPTools(): CustomMCPTool[] {
    return this.customMCPConfig.getCustomMCPTools();
  }

  /**
   * 检查是否配置了有效的 customMCP 工具
   */
  public hasValidCustomMCPTools(): boolean {
    return this.customMCPConfig.hasValidCustomMCPTools();
  }

  /**
   * 验证 customMCP 工具配置
   */
  public validateCustomMCPTools(tools: CustomMCPTool[]): boolean {
    return this.customMCPConfig.validateCustomMCPTools(tools);
  }

  /**
   * 添加自定义 MCP 工具
   */
  public addCustomMCPTool(tool: CustomMCPTool): void {
    this.customMCPConfig.addCustomMCPTool(tool);
  }

  /**
   * 批量添加自定义 MCP 工具
   */
  public async addCustomMCPTools(tools: CustomMCPTool[]): Promise<void> {
    return this.customMCPConfig.addCustomMCPTools(tools);
  }

  /**
   * 删除自定义 MCP 工具
   */
  public removeCustomMCPTool(toolName: string): void {
    this.customMCPConfig.removeCustomMCPTool(toolName);
  }

  /**
   * 更新单个自定义 MCP 工具配置
   */
  public updateCustomMCPTool(toolName: string, updatedTool: CustomMCPTool): void {
    this.customMCPConfig.updateCustomMCPTool(toolName, updatedTool);
  }

  /**
   * 更新自定义 MCP 工具配置
   */
  public updateCustomMCPTools(tools: CustomMCPTool[]): void {
    this.customMCPConfig.updateCustomMCPTools(tools);
  }

  // ==================== 平台配置 ====================

  /**
   * 获取所有平台配置
   */
  public getPlatformsConfig(): Readonly<PlatformsConfig> {
    return this.platformConfig.getPlatformsConfig();
  }

  /**
   * 获取指定平台配置
   */
  public getPlatformConfig(platformName: string): PlatformConfig | null {
    return this.platformConfig.getPlatformConfig(platformName);
  }

  /**
   * 更新平台配置
   */
  public updatePlatformConfig(
    platformName: string,
    platformConfig: PlatformConfig
  ): void {
    this.platformConfig.updatePlatformConfig(platformName, platformConfig);
  }

  /**
   * 获取扣子平台配置
   */
  public getCozePlatformConfig(): CozePlatformConfig | null {
    return this.platformConfig.getCozePlatformConfig();
  }

  /**
   * 获取扣子 API Token
   */
  public getCozeToken(): string | null {
    return this.platformConfig.getCozeToken();
  }

  /**
   * 检查扣子平台配置是否有效
   */
  public isCozeConfigValid(): boolean {
    return this.platformConfig.isCozeConfigValid();
  }

  /**
   * 设置扣子平台配置
   */
  public setCozePlatformConfig(config: CozePlatformConfig): void {
    this.platformConfig.setCozePlatformConfig(config);
  }

  // ==================== 媒体配置（TTS/ASR/LLM）====================

  /**
   * 获取 TTS 配置
   */
  public getTTSConfig(): Readonly<TTSConfig> {
    return this.mediaConfig.getTTSConfig();
  }

  /**
   * 更新 TTS 配置
   */
  public updateTTSConfig(ttsConfig: Partial<TTSConfig>): void {
    this.mediaConfig.updateTTSConfig(ttsConfig);
  }

  /**
   * 获取 ASR 配置
   */
  public getASRConfig(): Readonly<ASRConfig> {
    return this.mediaConfig.getASRConfig();
  }

  /**
   * 更新 ASR 配置
   */
  public updateASRConfig(asrConfig: Partial<ASRConfig>): void {
    this.mediaConfig.updateASRConfig(asrConfig);
  }

  /**
   * 获取 LLM 配置
   */
  public getLLMConfig(): LLMConfig | null {
    return this.mediaConfig.getLLMConfig();
  }

  /**
   * 检查 LLM 配置是否有效
   */
  public isLLMConfigValid(): boolean {
    return this.mediaConfig.isLLMConfigValid();
  }

  /**
   * 更新 LLM 配置
   */
  public updateLLMConfig(llmConfig: Partial<LLMConfig>): void {
    this.mediaConfig.updateLLMConfig(llmConfig);
  }

  // ==================== WebUI 配置 ====================

  /**
   * 获取 Web UI 配置
   */
  public getWebUIConfig(): Readonly<WebUIConfig> {
    return this.webUIConfig.getWebUIConfig();
  }

  /**
   * 获取 Web UI 端口号
   */
  public getWebUIPort(): number {
    return this.webUIConfig.getWebUIPort();
  }

  /**
   * 更新 Web UI 配置
   */
  public updateWebUIConfig(webUIConfig: Partial<WebUIConfig>): void {
    this.webUIConfig.updateWebUIConfig(webUIConfig);
  }

  /**
   * 设置 Web UI 端口号
   */
  public setWebUIPort(port: number): void {
    this.webUIConfig.setWebUIPort(port);
  }

  // ==================== 工具调用日志配置 ====================

  /**
   * 获取工具调用日志配置
   */
  public getToolCallLogConfig(): Readonly<ToolCallLogConfig> {
    return this.webUIConfig.getToolCallLogConfig();
  }

  /**
   * 更新工具调用日志配置
   */
  public updateToolCallLogConfig(toolCallLogConfig: Partial<ToolCallLogConfig>): void {
    this.webUIConfig.updateToolCallLogConfig(toolCallLogConfig);
  }

  // ==================== 批量更新配置 ====================

  /**
   * 批量更新配置（由 Handler 调用）
   */
  public updateConfig(newConfig: Partial<AppConfig>): void {
    const config = this.getMutableConfig();

    // 更新各种配置...
    if (newConfig.mcpEndpoint !== undefined) {
      config.mcpEndpoint = newConfig.mcpEndpoint;
    }

    if (newConfig.mcpServers) {
      const currentServers = { ...config.mcpServers };
      for (const [name, serverConfig] of Object.entries(newConfig.mcpServers)) {
        config.mcpServers[name] = serverConfig;
      }
      for (const name of Object.keys(currentServers)) {
        if (!(name in newConfig.mcpServers)) {
          delete config.mcpServers[name];
          if (config.mcpServerConfig?.[name]) {
            delete config.mcpServerConfig[name];
          }
        }
      }
    }

    if (newConfig.connection) {
      if (!config.connection) {
        config.connection = {};
      }
      Object.assign(config.connection, newConfig.connection);
    }

    if (newConfig.modelscope) {
      if (!config.modelscope) {
        config.modelscope = {};
      }
      Object.assign(config.modelscope, newConfig.modelscope);
    }

    if (newConfig.webUI) {
      if (!config.webUI) {
        config.webUI = {};
      }
      Object.assign(config.webUI, newConfig.webUI);
    }

    if (newConfig.mcpServerConfig) {
      for (const [serverName, toolsConfig] of Object.entries(
        newConfig.mcpServerConfig
      )) {
        if (config.mcpServerConfig?.[serverName]) {
          config.mcpServerConfig[serverName] = toolsConfig;
        }
      }
    }

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

    if ("asr" in newConfig) {
      config.asr = newConfig.asr;
    }

    if ("tts" in newConfig) {
      config.tts = newConfig.tts;
    }

    if ("llm" in newConfig) {
      config.llm = newConfig.llm;
    }

    this.store.saveConfig(config);

    (this.store as any).emitEvent("config:updated", {
      type: "config",
      timestamp: new Date(),
    });
  }

  private getMutableConfig(): AppConfig {
    return (this.store as any).getMutableConfig();
  }
}

// 导出单例实例
export const configManager = ConfigManager.getInstance();

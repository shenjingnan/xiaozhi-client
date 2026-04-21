/**
 * 配置管理外观类
 *
 * 提供向后兼容的统一 API，组合各子管理器的功能。
 * 这是 ConfigManager 的重构版本，将原有功能委托给专门的子管理器。
 */

import { CoreConfigManager } from "./core-config-manager.js";
import { CustomMCPToolManager } from "./custom-mcp-tool-manager.js";
import { MCPServiceConfigManager } from "./mcp-service-config-manager.js";
import { ToolStatsManager } from "./tool-stats-manager.js";

// 重新导出类型以保持向后兼容
export type {
  AppConfig,
  ConnectionConfig,
  MCPServerConfig,
  MCPServerToolsConfig,
  MCPToolConfig,
  ModelScopeConfig,
  WebUIConfig,
  CustomMCPConfig,
  CustomMCPTool,
  HandlerConfig,
  ProxyHandlerConfig,
  HttpHandlerConfig,
  FunctionHandlerConfig,
  ScriptHandlerConfig,
  ChainHandlerConfig,
  MCPHandlerConfig,
  PlatformsConfig,
  PlatformConfig,
  CozePlatformConfig,
  TTSConfig,
  ASRConfig,
  LLMConfig,
  ToolCallLogConfig,
  LocalMCPServerConfig,
  SSEMCPServerConfig,
  HTTPMCPServerConfig,
  WebServerInstance,
} from "./config-types.js";

/** @deprecated 使用 HTTPMCPServerConfig 代替 */
export type StreamableHTTPMCPServerConfig = HTTPMCPServerConfig;

import type {
  ASRConfig,
  AppConfig,
  ConnectionConfig,
  CozePlatformConfig,
  CustomMCPConfig,
  CustomMCPTool,
  HTTPMCPServerConfig,
  LLMConfig,
  MCPServerConfig,
  MCPServerToolsConfig,
  MCPToolConfig,
  ModelScopeConfig,
  PlatformConfig,
  TTSConfig,
  ToolCallLogConfig,
  WebUIConfig,
} from "./config-types.js";

/**
 * 配置管理外观类
 * 组合各子管理器，提供向后兼容的统一 API
 */
export class ConfigManager {
  private static instance: ConfigManager;

  // 子管理器
  private coreConfig: CoreConfigManager;
  private mcpService: MCPServiceConfigManager;
  private customMCPTool: CustomMCPToolManager;
  private toolStats: ToolStatsManager;

  private constructor() {
    this.coreConfig = CoreConfigManager.getInstance();
    this.mcpService = new MCPServiceConfigManager(this.coreConfig);
    this.customMCPTool = new CustomMCPToolManager(this.coreConfig);
    this.toolStats = new ToolStatsManager(this.coreConfig, this.customMCPTool);
  }

  /**
   * 获取单例实例
   */
  public static getInstance(): ConfigManager {
    if (!ConfigManager.instance) {
      ConfigManager.instance = new ConfigManager();
    }
    return ConfigManager.instance;
  }

  /**
   * 重置单例实例（用于测试）
   * 同时重置所有子管理器的单例实例
   */
  public static resetInstance(): void {
    ConfigManager.instance = undefined as unknown as ConfigManager;
    CoreConfigManager.resetInstance();
  }

  // ==================== 核心配置管理 ====================

  /**
   * 注册事件监听器
   */
  public on(eventName: string, callback: (data: unknown) => void): void {
    this.coreConfig.on(eventName, callback);
  }

  /**
   * 检查配置文件是否存在
   */
  public configExists(): boolean {
    return this.coreConfig.configExists();
  }

  /**
   * 初始化配置文件
   */
  public initConfig(): void {
    this.coreConfig.initConfig();
  }

  /**
   * 验证配置文件结构
   */
  public validateConfig(config: unknown): void {
    this.coreConfig.validateConfig(config);
  }

  /**
   * 获取配置（只读）
   */
  public getConfig(): Readonly<AppConfig> {
    return this.coreConfig.getConfig();
  }

  /**
   * 重新加载配置（清除缓存）
   */
  public reloadConfig(): void {
    this.coreConfig.reloadConfig();
  }

  /**
   * 获取配置文件路径
   */
  public getConfigPath(): string {
    return this.coreConfig.getConfigPath();
  }

  /**
   * 获取默认配置文件路径
   */
  public getDefaultConfigPath(): string {
    return this.coreConfig.getDefaultConfigPath();
  }

  /**
   * 获取配置目录路径
   */
  public getConfigDir(): string {
    return this.coreConfig.getConfigDir();
  }

  // ==================== MCP 服务配置管理 ====================

  /**
   * 获取 MCP 端点（向后兼容）
   * @deprecated 使用 getMcpEndpoints() 获取所有端点
   */
  public getMcpEndpoint(): string {
    return this.mcpService.getMcpEndpoint();
  }

  /**
   * 获取所有 MCP 端点
   */
  public getMcpEndpoints(): string[] {
    return this.mcpService.getMcpEndpoints();
  }

  /**
   * 获取 MCP 服务配置
   */
  public getMcpServers(): Readonly<Record<string, MCPServerConfig>> {
    return this.mcpService.getMcpServers();
  }

  /**
   * 获取 MCP 服务工具配置
   */
  public getMcpServerConfig(): Readonly<Record<string, MCPServerToolsConfig>> {
    return this.mcpService.getMcpServerConfig();
  }

  /**
   * 获取指定服务的工具配置
   */
  public getServerToolsConfig(
    serverName: string
  ): Readonly<Record<string, MCPToolConfig>> {
    return this.mcpService.getServerToolsConfig(serverName);
  }

  /**
   * 检查工具是否启用
   */
  public isToolEnabled(serverName: string, toolName: string): boolean {
    return this.mcpService.isToolEnabled(serverName, toolName);
  }

  /**
   * 更新 MCP 端点
   */
  public updateMcpEndpoint(endpoint: string | string[]): void {
    this.mcpService.updateMcpEndpoint(endpoint);
  }

  /**
   * 添加 MCP 端点
   */
  public addMcpEndpoint(endpoint: string): void {
    this.mcpService.addMcpEndpoint(endpoint);
  }

  /**
   * 移除 MCP 端点
   */
  public removeMcpEndpoint(endpoint: string): void {
    this.mcpService.removeMcpEndpoint(endpoint);
  }

  /**
   * 更新 MCP 服务配置
   */
  public updateMcpServer(
    serverName: string,
    serverConfig: MCPServerConfig
  ): void {
    this.mcpService.updateMcpServer(serverName, serverConfig);
  }

  /**
   * 删除 MCP 服务配置
   */
  public removeMcpServer(serverName: string): void {
    this.mcpService.removeMcpServer(serverName);
  }

  /**
   * 更新服务工具配置
   */
  public updateServerToolsConfig(
    serverName: string,
    toolsConfig: Record<string, MCPToolConfig>
  ): void {
    this.mcpService.updateServerToolsConfig(serverName, toolsConfig);
  }

  /**
   * 删除指定服务器的工具配置
   */
  public removeServerToolsConfig(serverName: string): void {
    this.mcpService.removeServerToolsConfig(serverName);
  }

  /**
   * 清理无效的服务器工具配置
   */
  public cleanupInvalidServerToolsConfig(): void {
    this.mcpService.cleanupInvalidServerToolsConfig();
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
    this.mcpService.setToolEnabled(serverName, toolName, enabled, description);
  }

  /**
   * 获取连接配置
   */
  public getConnectionConfig(): Required<ConnectionConfig> {
    return this.mcpService.getConnectionConfig();
  }

  /**
   * 获取心跳检测间隔
   */
  public getHeartbeatInterval(): number {
    return this.mcpService.getHeartbeatInterval();
  }

  /**
   * 获取心跳超时时间
   */
  public getHeartbeatTimeout(): number {
    return this.mcpService.getHeartbeatTimeout();
  }

  /**
   * 获取重连间隔
   */
  public getReconnectInterval(): number {
    return this.mcpService.getReconnectInterval();
  }

  /**
   * 更新连接配置
   */
  public updateConnectionConfig(
    connectionConfig: Partial<ConnectionConfig>
  ): void {
    this.mcpService.updateConnectionConfig(connectionConfig);
  }

  /**
   * 设置心跳检测间隔
   */
  public setHeartbeatInterval(interval: number): void {
    this.mcpService.setHeartbeatInterval(interval);
  }

  /**
   * 设置心跳超时时间
   */
  public setHeartbeatTimeout(timeout: number): void {
    this.mcpService.setHeartbeatTimeout(timeout);
  }

  /**
   * 设置重连间隔
   */
  public setReconnectInterval(interval: number): void {
    this.mcpService.setReconnectInterval(interval);
  }

  /**
   * 批量更新配置
   */
  public updateConfig(newConfig: Partial<AppConfig>): void {
    this.mcpService.updateConfig(newConfig);
  }

  // ==================== 自定义 MCP 工具管理 ====================

  /**
   * 获取 customMCP 配置
   */
  public getCustomMCPConfig(): CustomMCPConfig | null {
    return this.customMCPTool.getCustomMCPConfig();
  }

  /**
   * 获取 customMCP 工具列表
   */
  public getCustomMCPTools(): CustomMCPTool[] {
    return this.customMCPTool.getCustomMCPTools();
  }

  /**
   * 验证 customMCP 工具配置
   */
  public validateCustomMCPTools(tools: CustomMCPTool[]): boolean {
    return this.customMCPTool.validateCustomMCPTools(tools);
  }

  /**
   * 检查是否配置了有效的 customMCP 工具
   */
  public hasValidCustomMCPTools(): boolean {
    return this.customMCPTool.hasValidCustomMCPTools();
  }

  /**
   * 添加自定义 MCP 工具
   */
  public addCustomMCPTool(tool: CustomMCPTool): void {
    this.customMCPTool.addCustomMCPTool(tool);
  }

  /**
   * 批量添加自定义 MCP 工具
   */
  public async addCustomMCPTools(tools: CustomMCPTool[]): Promise<void> {
    await this.customMCPTool.addCustomMCPTools(tools);
  }

  /**
   * 删除自定义 MCP 工具
   */
  public removeCustomMCPTool(toolName: string): void {
    this.customMCPTool.removeCustomMCPTool(toolName);
  }

  /**
   * 更新单个自定义 MCP 工具配置
   */
  public updateCustomMCPTool(
    toolName: string,
    updatedTool: CustomMCPTool
  ): void {
    this.customMCPTool.updateCustomMCPTool(toolName, updatedTool);
  }

  /**
   * 更新自定义 MCP 工具配置
   */
  public updateCustomMCPTools(tools: CustomMCPTool[]): void {
    this.customMCPTool.updateCustomMCPTools(tools);
  }

  // ==================== 工具统计管理 ====================

  /**
   * 更新工具使用统计信息
   */
  public async updateToolUsageStats(
    serverName: string,
    toolName: string,
    callTime: string
  ): Promise<void>;

  public async updateToolUsageStats(
    toolName: string,
    incrementUsageCount?: boolean
  ): Promise<void>;

  public async updateToolUsageStats(
    arg1: string,
    arg2?: string | boolean,
    arg3?: string
  ): Promise<void> {
    // 根据参数类型区分不同的调用方式
    if (typeof arg2 === "string" && arg3 !== undefined) {
      // 三参数版本：updateToolUsageStats(serverName, toolName, callTime)
      await this.toolStats.updateToolUsageStats(arg1, arg2, arg3);
    } else {
      // 两参数版本：updateToolUsageStats(toolName, incrementUsageCount?)
      await this.toolStats.updateToolUsageStats(
        arg1,
        arg2 as boolean | undefined
      );
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
    await this.toolStats.updateMCPServerToolStats(
      serviceName,
      toolName,
      callTime,
      incrementUsageCount
    );
  }

  /**
   * 带并发控制的工具统计更新
   */
  public async updateToolUsageStatsWithLock(
    toolName: string,
    incrementUsageCount = true
  ): Promise<void> {
    await this.toolStats.updateToolUsageStatsWithLock(
      toolName,
      incrementUsageCount
    );
  }

  /**
   * 带并发控制的 MCP 服务工具统计更新
   */
  public async updateMCPServerToolStatsWithLock(
    serviceName: string,
    toolName: string,
    callTime: string,
    incrementUsageCount = true
  ): Promise<void> {
    await this.toolStats.updateMCPServerToolStatsWithLock(
      serviceName,
      toolName,
      callTime,
      incrementUsageCount
    );
  }

  /**
   * 清理所有统计更新锁
   */
  public clearAllStatsUpdateLocks(): void {
    this.toolStats.clearAllStatsUpdateLocks();
  }

  /**
   * 获取统计更新锁状态
   */
  public getStatsUpdateLocks(): string[] {
    return this.toolStats.getStatsUpdateLocks();
  }

  // ==================== ModelScope 配置管理 ====================

  /**
   * 获取 ModelScope 配置
   */
  public getModelScopeConfig(): Readonly<ModelScopeConfig> {
    const config = this.getConfig();
    return config.modelscope || {};
  }

  /**
   * 获取 ModelScope API Key
   */
  public getModelScopeApiKey(): string | undefined {
    const modelScopeConfig = this.getModelScopeConfig();
    return modelScopeConfig.apiKey || process.env.MODELSCOPE_API_TOKEN;
  }

  /**
   * 更新 ModelScope 配置
   */
  public updateModelScopeConfig(
    modelScopeConfig: Partial<ModelScopeConfig>
  ): void {
    const config = this.coreConfig.getMutableConfig();

    if (!config.modelscope) {
      config.modelscope = {};
    }

    Object.assign(config.modelscope, modelScopeConfig);
    this.coreConfig.saveConfig(config);

    this.coreConfig.emitEvent("config:updated", {
      type: "modelscope",
      timestamp: new Date(),
    });
  }

  /**
   * 设置 ModelScope API Key
   */
  public setModelScopeApiKey(apiKey: string): void {
    if (!apiKey || typeof apiKey !== "string") {
      throw new Error("API Key 必须是非空字符串");
    }
    this.updateModelScopeConfig({ apiKey });
  }

  // ==================== Web UI 配置管理 ====================

  /**
   * 获取 Web UI 配置
   */
  public getWebUIConfig(): Readonly<WebUIConfig> {
    const config = this.getConfig();
    return config.webUI || {};
  }

  /**
   * 获取 Web UI 端口号
   */
  public getWebUIPort(): number {
    const webUIConfig = this.getWebUIConfig();
    return webUIConfig.port ?? 9999;
  }

  /**
   * 更新 Web UI 配置
   */
  public updateWebUIConfig(webUIConfig: Partial<WebUIConfig>): void {
    const config = this.coreConfig.getMutableConfig();

    if (!config.webUI) {
      config.webUI = {};
    }

    Object.assign(config.webUI, webUIConfig);
    this.coreConfig.saveConfig(config);

    this.coreConfig.emitEvent("config:updated", {
      type: "webui",
      timestamp: new Date(),
    });
  }

  /**
   * 设置 Web UI 端口号
   */
  public setWebUIPort(port: number): void {
    if (!Number.isInteger(port) || port <= 0 || port > 65535) {
      throw new Error("端口号必须是 1-65535 之间的整数");
    }
    this.updateWebUIConfig({ port });
  }

  // ==================== 平台配置管理 ====================

  /**
   * 更新平台配置
   */
  public updatePlatformConfig(
    platformName: string,
    platformConfig: PlatformConfig
  ): void {
    const config = this.coreConfig.getMutableConfig();
    if (!config.platforms) {
      config.platforms = {};
    }
    config.platforms[platformName] = platformConfig;
    this.coreConfig.saveConfig(config);

    this.coreConfig.emitEvent("config:updated", {
      type: "platform",
      platformName,
      timestamp: new Date(),
    });
  }

  /**
   * 获取扣子平台配置
   */
  public getCozePlatformConfig(): CozePlatformConfig | null {
    const config = this.getConfig();
    const cozeConfig = config.platforms?.coze;

    if (!cozeConfig || !cozeConfig.token) {
      return null;
    }

    return {
      token: cozeConfig.token,
    };
  }

  /**
   * 获取扣子 API Token
   */
  public getCozeToken(): string | null {
    const cozeConfig = this.getCozePlatformConfig();
    return cozeConfig?.token || null;
  }

  /**
   * 设置扣子平台配置
   */
  public setCozePlatformConfig(config: CozePlatformConfig): void {
    if (
      !config.token ||
      typeof config.token !== "string" ||
      config.token.trim() === ""
    ) {
      throw new Error("扣子 API Token 不能为空");
    }

    this.updatePlatformConfig("coze", {
      token: config.token.trim(),
    });
  }

  /**
   * 检查扣子平台配置是否有效
   */
  public isCozeConfigValid(): boolean {
    const cozeConfig = this.getCozePlatformConfig();
    return (
      cozeConfig !== null &&
      typeof cozeConfig.token === "string" &&
      cozeConfig.token.trim() !== ""
    );
  }

  // ==================== 工具调用日志配置 ====================

  /**
   * 获取工具调用日志配置
   */
  public getToolCallLogConfig(): Readonly<ToolCallLogConfig> {
    const config = this.getConfig();
    return config.toolCallLog || {};
  }

  /**
   * 更新工具调用日志配置
   */
  public updateToolCallLogConfig(
    toolCallLogConfig: Partial<ToolCallLogConfig>
  ): void {
    const config = this.coreConfig.getMutableConfig();

    if (!config.toolCallLog) {
      config.toolCallLog = {};
    }

    Object.assign(config.toolCallLog, toolCallLogConfig);
    this.coreConfig.saveConfig(config);
  }

  // ==================== TTS/ASR/LLM 配置 ====================

  /**
   * 获取 TTS 配置
   */
  public getTTSConfig(): Readonly<TTSConfig> {
    const config = this.getConfig();
    return config.tts || {};
  }

  /**
   * 获取 ASR 配置
   */
  public getASRConfig(): Readonly<ASRConfig> {
    const config = this.getConfig();
    return config.asr || {};
  }

  /**
   * 获取 LLM 配置
   */
  public getLLMConfig(): LLMConfig | null {
    const config = this.getConfig();
    return config.llm || null;
  }

  /**
   * 检查 LLM 配置是否有效
   */
  public isLLMConfigValid(): boolean {
    const llmConfig = this.getLLMConfig();
    return (
      llmConfig !== null &&
      typeof llmConfig.model === "string" &&
      llmConfig.model.trim() !== "" &&
      typeof llmConfig.apiKey === "string" &&
      llmConfig.apiKey.trim() !== "" &&
      typeof llmConfig.baseURL === "string" &&
      llmConfig.baseURL.trim() !== ""
    );
  }

  /**
   * 更新 TTS 配置
   */
  public updateTTSConfig(ttsConfig: Partial<TTSConfig>): void {
    const config = this.coreConfig.getMutableConfig();

    if (!config.tts) {
      config.tts = {};
    }

    Object.assign(config.tts, ttsConfig);
    this.coreConfig.saveConfig(config);

    this.coreConfig.emitEvent("config:updated", {
      type: "tts",
      timestamp: new Date(),
    });
  }

  // ==================== 内部方法（用于向后兼容） ====================

  /**
   * 获取可修改的配置对象（内部使用）
   * @deprecated 内部方法，不建议外部使用
   */
  private getMutableConfig(): AppConfig {
    return this.coreConfig.getMutableConfig();
  }

  /**
   * 保存配置到文件（内部使用）
   * @deprecated 内部方法，不建议外部使用
   */
  private saveConfig(config: AppConfig): void {
    this.coreConfig.saveConfig(config);
  }
}

// 导出单例实例
export const configManager = ConfigManager.getInstance();

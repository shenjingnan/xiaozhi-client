/**
 * 配置管理器
 *
 * 核心配置管理模块，负责：
 * - 配置文件的读取和解析（支持 JSON、JSON5、JSONC 格式）
 * - 配置验证和类型检查
 * - 配置更新和持久化
 * - 配置变更事件通知
 * - 配置文件路径解析
 *
 * @example
 * ```typescript
 * import { configManager } from '@xiaozhi-client/config';
 *
 * // 获取配置
 * const config = configManager.getConfig();
 *
 * // 更新配置
 * configManager.updateConfig({ mcpEndpoint: 'wss://...' });
 *
 * // 监听配置更新事件
 * configManager.on('config:updated', (payload) => {
 *   // payload 示例结构：
 *   // {
 *   //   type: 'endpoint' | 'customMCP' | 'config' | 'serverTools' | 'connection' | 'modelscope' | 'webui' | 'platform' | 'tts';
 *   //   timestamp: Date;
 *   //   serviceName?: string;
 *   //   platformName?: string;
 *   // }
 *   console.log('配置已更新事件:', payload);
 *
 *   // 如果需要获取最新的完整配置对象，可在回调中调用 getConfig()
 *   const latestConfig = configManager.getConfig();
 *   console.log('最新配置对象:', latestConfig);
 * });
 * ```
 */

// 重新导出所有类型定义，保持向后兼容
export * from "./types.js";

// 导入内部模块
import { ConfigIO } from "./ConfigIO.js";
import { ConfigValidator } from "./ConfigValidator.js";
import { ConfigEventBus } from "./ConfigEventBus.js";
import { MCPConfigManager } from "./MCPConfigManager.js";
import { CustomMCPToolsManager } from "./CustomMCPToolsManager.js";
import { ToolUsageStats } from "./ToolUsageStats.js";
import { ConnectionConfigManager } from "./ConnectionConfigManager.js";
import type {
  AppConfig,
  MCPServerConfig,
  MCPToolConfig,
  CustomMCPTool,
  WebServerInstance,
  CozePlatformConfig,
} from "./types.js";

/**
 * 配置管理类
 * 负责管理应用配置，提供只读访问和安全的配置更新功能
 *
 * 通过组合各个专门的管理器来实现不同的功能：
 * - ConfigIO: 配置文件 I/O 操作
 * - ConfigValidator: 配置验证
 * - ConfigEventBus: 事件系统
 * - MCPConfigManager: MCP 配置管理
 * - CustomMCPToolsManager: CustomMCP 工具管理
 * - ToolUsageStats: 工具使用统计
 * - ConnectionConfigManager: 连接配置管理
 */
export class ConfigManager {
  private static instance: ConfigManager;

  // 组合各个专门的管理器
  private io: ConfigIO;
  private validator: ConfigValidator;
  private eventBus: ConfigEventBus;
  private mcpConfig: MCPConfigManager;
  private customMCPTools: CustomMCPToolsManager;
  private toolUsageStats: ToolUsageStats;
  private connectionConfig: ConnectionConfigManager;

  // 配置缓存
  private config: AppConfig | null = null;

  // Web 服务器实例引用（用于配置更新通知）
  private webServerInstance: WebServerInstance | null = null;

  private constructor() {
    // 初始化各个管理器
    this.validator = new ConfigValidator();
    this.eventBus = new ConfigEventBus();
    this.io = new ConfigIO(this.validator, this.eventBus);
    this.mcpConfig = new MCPConfigManager();
    this.customMCPTools = new CustomMCPToolsManager(this.validator);
    this.toolUsageStats = new ToolUsageStats();
    this.connectionConfig = new ConnectionConfigManager();
  }

  /**
   * 注册事件监听器
   */
  public on(eventName: string, callback: (data: unknown) => void): void {
    this.eventBus.on(eventName, callback);
  }

  /**
   * 移除事件监听器
   */
  public off(eventName: string, callback: (data: unknown) => void): void {
    this.eventBus.off(eventName, callback);
  }

  /**
   * 设置 Web 服务器实例（用于配置更新通知）
   */
  public setWebServerInstance(webServer: WebServerInstance): void {
    this.webServerInstance = webServer;
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

  /**
   * 检查配置文件是否存在
   */
  public configExists(): boolean {
    return this.io.configExists();
  }

  /**
   * 初始化配置文件
   */
  public initConfig(format: "json" | "json5" | "jsonc" = "json"): void {
    this.io.initConfig(format);
    this.config = null; // 重置缓存
  }

  /**
   * 获取配置（只读）
   */
  public getConfig(): Readonly<AppConfig> {
    if (!this.config) {
      this.config = this.io.loadConfig();
    }

    // 返回深度只读副本
    return JSON.parse(JSON.stringify(this.config));
  }

  /**
   * 获取可修改的配置对象（内部使用）
   */
  private getMutableConfig(): AppConfig {
    if (!this.config) {
      this.config = this.io.loadConfig();
    }
    return this.config;
  }

  /**
   * 验证配置文件结构
   */
  public validateConfig(config: unknown): void {
    this.validator.validateConfig(config);
  }

  /**
   * 验证 CustomMCP 工具配置
   */
  public validateCustomMCPTools(tools: CustomMCPTool[]): boolean {
    return this.validator.validateCustomMCPTools(tools);
  }

  // ==================== MCP 端点管理 ====================

  /**
   * 获取 MCP 端点（向后兼容）
   * @deprecated 使用 getMcpEndpoints() 获取所有端点
   */
  public getMcpEndpoint(): string {
    const config = this.getConfig();
    return this.mcpConfig.getMcpEndpoint(config);
  }

  /**
   * 获取所有 MCP 端点
   */
  public getMcpEndpoints(): string[] {
    const config = this.getConfig();
    return this.mcpConfig.getMcpEndpoints(config);
  }

  /**
   * 更新 MCP 端点（支持字符串或数组）
   */
  public updateMcpEndpoint(endpoint: string | string[]): void {
    const config = this.getMutableConfig();
    this.mcpConfig.updateMcpEndpoint(config, endpoint);
    this.io.saveConfig(config);

    this.eventBus.emitConfigUpdated({
      type: "endpoint",
      timestamp: new Date(),
    });
  }

  /**
   * 添加 MCP 端点
   */
  public addMcpEndpoint(endpoint: string): void {
    const config = this.getMutableConfig();
    this.mcpConfig.addMcpEndpoint(config, endpoint);
    this.io.saveConfig(config);
  }

  /**
   * 移除 MCP 端点
   */
  public removeMcpEndpoint(endpoint: string): void {
    const config = this.getMutableConfig();
    this.mcpConfig.removeMcpEndpoint(config, endpoint);
    this.io.saveConfig(config);
  }

  // ==================== MCP 服务管理 ====================

  /**
   * 获取 MCP 服务配置
   */
  public getMcpServers(): Readonly<Record<string, MCPServerConfig>> {
    const config = this.getConfig();
    return this.mcpConfig.getMcpServers(config);
  }

  /**
   * 更新 MCP 服务配置
   */
  public updateMcpServer(
    serverName: string,
    serverConfig: MCPServerConfig
  ): void {
    const config = this.getMutableConfig();
    this.mcpConfig.updateMcpServer(config, serverName, serverConfig);
    this.io.saveConfig(config);
  }

  /**
   * 删除 MCP 服务配置
   */
  public removeMcpServer(serverName: string): void {
    const config = this.getMutableConfig();

    // 查找 CustomMCP 中相关的工具
    const relatedToolNames = this.mcpConfig.getRelatedCustomMCPTools(
      config,
      serverName
    );

    // 移除 MCP 服务
    this.mcpConfig.removeMcpServer(config, serverName);

    // 移除相关的 CustomMCP 工具
    for (const toolName of relatedToolNames) {
      try {
        this.customMCPTools.removeCustomMCPTool(config, toolName);
      } catch {
        // 忽略移除失败的情况
      }
    }

    this.io.saveConfig(config);

    this.eventBus.emitConfigUpdated({
      type: "customMCP",
      timestamp: new Date(),
    });

    console.log("成功移除 MCP 服务", { serverName });
  }

  // ==================== MCP 服务工具配置管理 ====================

  /**
   * 获取 MCP 服务工具配置
   */
  public getMcpServerConfig(): Readonly<
    Record<string, { tools: Record<string, MCPToolConfig> }>
  > {
    const config = this.getConfig();
    return this.mcpConfig.getMcpServerConfig(config);
  }

  /**
   * 获取指定服务的工具配置
   */
  public getServerToolsConfig(
    serverName: string
  ): Readonly<Record<string, MCPToolConfig>> {
    const config = this.getConfig();
    return this.mcpConfig.getServerToolsConfig(config, serverName);
  }

  /**
   * 检查工具是否启用
   */
  public isToolEnabled(serverName: string, toolName: string): boolean {
    const config = this.getConfig();
    return this.mcpConfig.isToolEnabled(config, serverName, toolName);
  }

  /**
   * 更新服务工具配置
   */
  public updateServerToolsConfig(
    serverName: string,
    toolsConfig: Record<string, MCPToolConfig>
  ): void {
    const config = this.getMutableConfig();
    this.mcpConfig.updateServerToolsConfig(config, serverName, toolsConfig);
    this.io.saveConfig(config);

    this.eventBus.emitConfigUpdated({
      type: "serverTools",
      serviceName: serverName,
      timestamp: new Date(),
    });
  }

  /**
   * 删除指定服务器的工具配置
   */
  public removeServerToolsConfig(serverName: string): void {
    const config = this.getConfig();
    const newConfig = { ...config };
    this.mcpConfig.removeServerToolsConfig(newConfig, serverName);
    this.io.saveConfig(newConfig);
  }

  /**
   * 清理无效的服务器工具配置
   */
  public cleanupInvalidServerToolsConfig(): void {
    const config = this.getMutableConfig();
    this.mcpConfig.cleanupInvalidServerToolsConfig(config);
    if (config.mcpServerConfig) {
      this.io.saveConfig(config);
    }
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
    this.mcpConfig.setToolEnabled(
      config,
      serverName,
      toolName,
      enabled,
      description
    );
    this.io.saveConfig(config);
  }

  // ==================== CustomMCP 工具管理 ====================

  /**
   * 获取 CustomMCP 工具列表
   */
  public getCustomMCPTools(): CustomMCPTool[] {
    const config = this.getConfig();
    return this.customMCPTools.getCustomMCPTools(config);
  }

  /**
   * 检查是否有有效的 CustomMCP 工具
   */
  public hasValidCustomMCPTools(): boolean {
    const config = this.getConfig();
    return this.customMCPTools.hasValidCustomMCPTools(config);
  }

  /**
   * 添加 CustomMCP 工具
   */
  public addCustomMCPTool(tool: CustomMCPTool): void {
    const config = this.getMutableConfig();
    this.customMCPTools.addCustomMCPTool(config, tool);
    this.io.saveConfig(config);
  }

  /**
   * 移除 CustomMCP 工具
   */
  public removeCustomMCPTool(toolName: string): void {
    const config = this.getMutableConfig();
    this.customMCPTools.removeCustomMCPTool(config, toolName);
    this.io.saveConfig(config);
  }

  /**
   * 更新 CustomMCP 工具
   */
  public updateCustomMCPTool(
    toolName: string,
    updatedTool: CustomMCPTool
  ): void {
    const config = this.getMutableConfig();
    this.customMCPTools.updateCustomMCPTool(config, toolName, updatedTool);
    this.io.saveConfig(config);
  }

  /**
   * 批量更新 CustomMCP 工具
   */
  public updateCustomMCPTools(tools: CustomMCPTool[]): void {
    const config = this.getMutableConfig();
    this.customMCPTools.updateCustomMCPTools(config, tools);
    this.io.saveConfig(config);
  }

  // ==================== 工具使用统计 ====================

  /**
   * 更新工具使用统计信息（CustomMCP 工具）
   */
  public async updateToolUsageStats(
    toolName: string,
    incrementUsageCount = true
  ): Promise<void> {
    const config = this.getMutableConfig();
    const callTime = new Date().toISOString();

    const updatedTools = this.toolUsageStats.updateCustomMCPToolStats(
      this.customMCPTools.getCustomMCPTools(config),
      toolName,
      callTime,
      incrementUsageCount
    );

    this.customMCPTools.updateCustomMCPTools(config, updatedTools);
    this.io.saveConfig(config);
  }

  /**
   * 更新 MCP 服务器工具使用统计信息
   */
  public async updateMCPServerToolStats(
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

    const updatedToolsConfig = this.toolUsageStats.updateMCPServerToolStats(
      config.mcpServerConfig[serverName].tools,
      toolName,
      callTime,
      incrementUsageCount
    );

    config.mcpServerConfig[serverName].tools = updatedToolsConfig;
    this.io.saveConfig(config);
  }

  /**
   * 带并发控制的工具统计更新（CustomMCP 工具）
   */
  public async updateToolUsageStatsWithLock(
    toolName: string,
    incrementUsageCount = true
  ): Promise<void> {
    const toolKey = `custommcp_${toolName}`;

    if (!(await this.toolUsageStats.acquireStatsUpdateLock(toolKey))) {
      return; // 已有其他更新在进行
    }

    try {
      await this.updateToolUsageStats(toolName, incrementUsageCount);
      console.log("工具统计更新完成", { toolName });
    } catch (error) {
      console.error("工具统计更新失败", { toolName, error });
      throw error;
    } finally {
      this.toolUsageStats.releaseStatsUpdateLock(toolKey);
    }
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
    const toolKey = `mcpserver_${serviceName}_${toolName}`;

    if (!(await this.toolUsageStats.acquireStatsUpdateLock(toolKey))) {
      return; // 已有其他更新在进行
    }

    try {
      await this.updateMCPServerToolStats(
        serviceName,
        toolName,
        callTime,
        incrementUsageCount
      );
      console.log("MCP 服务工具统计更新完成", { serviceName, toolName });
    } catch (error) {
      console.error("MCP 服务工具统计更新失败", {
        serviceName,
        toolName,
        error,
      });
      throw error;
    } finally {
      this.toolUsageStats.releaseStatsUpdateLock(toolKey);
    }
  }

  /**
   * 清理所有统计更新锁（用于异常恢复）
   */
  public clearAllStatsUpdateLocks(): void {
    this.toolUsageStats.clearAllStatsUpdateLocks();
  }

  /**
   * 获取统计更新锁状态（用于调试和监控）
   */
  public getStatsUpdateLocks(): string[] {
    return this.toolUsageStats.getStatsUpdateLocks();
  }

  // ==================== 连接配置管理 ====================

  /**
   * 获取心跳间隔
   */
  public getHeartbeatInterval(): number {
    const config = this.getConfig();
    return this.connectionConfig.getHeartbeatInterval(config);
  }

  /**
   * 获取心跳超时
   */
  public getHeartbeatTimeout(): number {
    const config = this.getConfig();
    return this.connectionConfig.getHeartbeatTimeout(config);
  }

  /**
   * 获取重连间隔
   */
  public getReconnectInterval(): number {
    const config = this.getConfig();
    return this.connectionConfig.getReconnectInterval(config);
  }

  /**
   * 设置心跳间隔
   */
  public setHeartbeatInterval(interval: number): void {
    const config = this.getMutableConfig();
    this.connectionConfig.setHeartbeatInterval(config, interval);
    this.io.saveConfig(config);
  }

  /**
   * 设置心跳超时
   */
  public setHeartbeatTimeout(timeout: number): void {
    const config = this.getMutableConfig();
    this.connectionConfig.setHeartbeatTimeout(config, timeout);
    this.io.saveConfig(config);
  }

  /**
   * 设置重连间隔
   */
  public setReconnectInterval(interval: number): void {
    const config = this.getMutableConfig();
    this.connectionConfig.setReconnectInterval(config, interval);
    this.io.saveConfig(config);
  }

  // ==================== ModelScope 配置管理 ====================

  /**
   * 获取 ModelScope API Key
   */
  public getModelScopeApiKey(): string | undefined {
    const config = this.getConfig();
    return this.connectionConfig.getModelScopeApiKey(config);
  }

  /**
   * 设置 ModelScope API Key
   */
  public setModelScopeApiKey(apiKey: string): void {
    const config = this.getMutableConfig();
    this.connectionConfig.setModelScopeApiKey(config, apiKey);
    this.io.saveConfig(config);
  }

  // ==================== WebUI 配置管理 ====================

  /**
   * 获取 WebUI 端口
   */
  public getWebUIPort(): number {
    const config = this.getConfig();
    return this.connectionConfig.getWebUIPort(config);
  }

  /**
   * 设置 WebUI 端口
   */
  public setWebUIPort(port: number): void {
    const config = this.getMutableConfig();
    this.connectionConfig.setWebUIPort(config, port);
    this.io.saveConfig(config);
  }

  /**
   * 更新 WebUI 配置
   */
  public updateWebUIConfig(webUIConfig: { port?: number; autoRestart?: boolean }): void {
    const config = this.getMutableConfig();
    this.connectionConfig.updateWebUIConfig(config, webUIConfig);
    this.io.saveConfig(config);
    this.notifyConfigUpdate(config);
  }

  // ==================== 平台配置管理 ====================

  /**
   * 获取平台配置
   */
  public getPlatformConfig(platformName: string): unknown {
    const config = this.getConfig();
    return this.connectionConfig.getPlatformConfig(config, platformName);
  }

  /**
   * 获取扣子平台配置
   */
  public getCozePlatformConfig(): { token?: string } | undefined {
    const config = this.getConfig();
    return this.connectionConfig.getPlatformConfig(config, "coze") as
      | { token?: string }
      | undefined;
  }

  /**
   * 检查扣子配置是否有效
   */
  public isCozeConfigValid(): boolean {
    const cozeConfig = this.getCozePlatformConfig();
    return !!(cozeConfig && cozeConfig.token);
  }

  /**
   * 设置扣子平台配置
   */
  public setCozePlatformConfig(config: CozePlatformConfig): void {
    const appConfig = this.getMutableConfig();
    this.connectionConfig.updatePlatformConfig(appConfig, "coze", config);
    this.io.saveConfig(appConfig);

    this.eventBus.emitConfigUpdated({
      type: "platform",
      platformName: "coze",
      timestamp: new Date(),
    });
  }

  // ==================== 其他配置管理 ====================

  /**
   * 获取工具调用日志配置
   */
  public getToolCallLogConfig(): Readonly<{ maxRecords?: number; logFilePath?: string }> {
    const config = this.getConfig();
    return this.connectionConfig.getToolCallLogConfig(config);
  }

  /**
   * 更新工具调用日志配置
   */
  public updateToolCallLogConfig(toolCallLogConfig: {
    maxRecords?: number;
    logFilePath?: string;
  }): void {
    const config = this.getMutableConfig();
    this.connectionConfig.updateToolCallLogConfig(config, toolCallLogConfig);
    this.io.saveConfig(config);
  }

  /**
   * 获取 TTS 配置
   */
  public getTTSConfig(): Readonly<{
    appid?: string;
    accessToken?: string;
    voice_type?: string;
    encoding?: string;
    cluster?: string;
    endpoint?: string;
  }> {
    const config = this.getConfig();
    return this.connectionConfig.getTTSConfig(config);
  }

  /**
   * 更新 TTS 配置
   */
  public updateTTSConfig(ttsConfig: {
    appid?: string;
    accessToken?: string;
    voice_type?: string;
    encoding?: string;
    cluster?: string;
    endpoint?: string;
  }): void {
    const config = this.getMutableConfig();
    this.connectionConfig.updateTTSConfig(config, ttsConfig);
    this.io.saveConfig(config);

    this.eventBus.emitConfigUpdated({
      type: "tts",
      timestamp: new Date(),
    });
  }

  /**
   * 获取 ASR 配置
   */
  public getASRConfig(): Readonly<{
    appid?: string;
    accessToken?: string;
    cluster?: string;
    wsUrl?: string;
  }> {
    const config = this.getConfig();
    return this.connectionConfig.getASRConfig(config);
  }

  /**
   * 获取 LLM 配置
   */
  public getLLMConfig(): { model: string; apiKey: string; baseURL: string } | null {
    const config = this.getConfig();
    return this.connectionConfig.getLLMConfig(config);
  }

  /**
   * 检查 LLM 配置是否有效
   */
  public isLLMConfigValid(): boolean {
    const config = this.getConfig();
    return this.connectionConfig.isLLMConfigValid(config);
  }

  // ==================== 批量配置更新 ====================

  /**
   * 批量更新配置（由 Handler 调用）
   */
  public updateConfig(newConfig: Partial<AppConfig>): void {
    const config = this.getMutableConfig();

    // 委托给各个管理器处理
    this.mcpConfig.updateConfig(config, newConfig);
    this.connectionConfig.updateConfig(config, newConfig);

    this.io.saveConfig(config);

    this.eventBus.emitConfigUpdated({
      type: "config",
      timestamp: new Date(),
    });
  }

  // ==================== 配置文件路径管理 ====================

  /**
   * 获取配置文件路径
   */
  public getConfigPath(): string {
    return this.io.getConfigFilePath();
  }

  /**
   * 获取配置目录路径
   */
  public getConfigDir(): string {
    return process.env.XIAOZHI_CONFIG_DIR || process.cwd();
  }

  /**
   * 获取默认配置文件路径
   */
  public getDefaultConfigPath(): string {
    return this.io.getDefaultConfigPath();
  }

  /**
   * 重新加载配置
   */
  public reloadConfig(): void {
    this.io.reloadConfig();
    this.config = null;
  }

  // ==================== 内部方法 ====================

  /**
   * 通知配置更新（Web 服务器）
   */
  private notifyConfigUpdate(config: AppConfig): void {
    if (this.webServerInstance && typeof this.webServerInstance.broadcastConfigUpdate === "function") {
      try {
        this.webServerInstance.broadcastConfigUpdate(config);
      } catch (error) {
        console.error("通知 Web 服务器配置更新失败:", error);
      }
    }
  }
}

// 导出单例实例
export const configManager = ConfigManager.getInstance();

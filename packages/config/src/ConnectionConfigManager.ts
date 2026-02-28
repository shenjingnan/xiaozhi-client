/**
 * 连接配置管理
 *
 * 负责连接相关配置的获取和更新
 */
import type {
  AppConfig,
  ConnectionConfig,
  ModelScopeConfig,
  WebUIConfig,
  TTSConfig,
  ASRConfig,
  LLMConfig,
  ToolCallLogConfig,
} from "./types.js";
import { DEFAULT_CONNECTION_CONFIG } from "./types.js";

/**
 * 连接配置管理类
 */
export class ConnectionConfigManager {
  /**
   * 获取心跳间隔
   */
  public getHeartbeatInterval(config: AppConfig): number {
    if (!config.connection) {
      return DEFAULT_CONNECTION_CONFIG.heartbeatInterval;
    }
    return config.connection.heartbeatInterval ??
      DEFAULT_CONNECTION_CONFIG.heartbeatInterval;
  }

  /**
   * 获取心跳超时
   */
  public getHeartbeatTimeout(config: AppConfig): number {
    if (!config.connection) {
      return DEFAULT_CONNECTION_CONFIG.heartbeatTimeout;
    }
    return config.connection.heartbeatTimeout ??
      DEFAULT_CONNECTION_CONFIG.heartbeatTimeout;
  }

  /**
   * 获取重连间隔
   */
  public getReconnectInterval(config: AppConfig): number {
    if (!config.connection) {
      return DEFAULT_CONNECTION_CONFIG.reconnectInterval;
    }
    return config.connection.reconnectInterval ??
      DEFAULT_CONNECTION_CONFIG.reconnectInterval;
  }

  /**
   * 设置心跳间隔
   */
  public setHeartbeatInterval(config: AppConfig, interval: number): void {
    if (interval <= 0) {
      throw new Error("心跳间隔必须大于 0");
    }

    if (!config.connection) {
      config.connection = {};
    }

    config.connection.heartbeatInterval = interval;
  }

  /**
   * 设置心跳超时
   */
  public setHeartbeatTimeout(config: AppConfig, timeout: number): void {
    if (timeout <= 0) {
      throw new Error("心跳超时必须大于 0");
    }

    if (!config.connection) {
      config.connection = {};
    }

    config.connection.heartbeatTimeout = timeout;
  }

  /**
   * 设置重连间隔
   */
  public setReconnectInterval(config: AppConfig, interval: number): void {
    if (interval <= 0) {
      throw new Error("重连间隔必须大于 0");
    }

    if (!config.connection) {
      config.connection = {};
    }

    config.connection.reconnectInterval = interval;
  }

  /**
   * 设置连接配置（支持部分更新）
   */
  public updateConnectionConfig(
    config: AppConfig,
    connectionConfig: ConnectionConfig
  ): void {
    if (!config.connection) {
      config.connection = {};
    }

    Object.assign(config.connection, connectionConfig);
  }

  /**
   * 获取 ModelScope API Key
   */
  public getModelScopeApiKey(config: AppConfig): string | undefined {
    if (!config.modelscope) {
      return undefined;
    }
    return config.modelscope.apiKey;
  }

  /**
   * 设置 ModelScope API Key
   */
  public setModelScopeApiKey(config: AppConfig, apiKey: string): void {
    if (!apiKey || typeof apiKey !== "string") {
      throw new Error("ModelScope API Key 必须是非空字符串");
    }

    if (!config.modelscope) {
      config.modelscope = {};
    }

    config.modelscope.apiKey = apiKey;
  }

  /**
   * 更新 ModelScope 配置
   */
  public updateModelScopeConfig(
    config: AppConfig,
    modelscopeConfig: ModelScopeConfig
  ): void {
    if (!config.modelscope) {
      config.modelscope = {};
    }

    Object.assign(config.modelscope, modelscopeConfig);
  }

  /**
   * 获取 WebUI 端口
   */
  public getWebUIPort(config: AppConfig): number {
    if (!config.webUI) {
      return 9999; // 默认端口
    }
    return config.webUI.port ?? 9999;
  }

  /**
   * 设置 WebUI 端口
   */
  public setWebUIPort(config: AppConfig, port: number): void {
    if (port <= 0 || port > 65535) {
      throw new Error("WebUI 端口必须在 1-65535 之间");
    }

    if (!config.webUI) {
      config.webUI = {};
    }

    config.webUI.port = port;
  }

  /**
   * 更新 WebUI 配置
   */
  public updateWebUIConfig(
    config: AppConfig,
    webUIConfig: Partial<WebUIConfig>
  ): void {
    if (!config.webUI) {
      config.webUI = {};
    }

    Object.assign(config.webUI, webUIConfig);
  }

  /**
   * 获取平台配置
   */
  public getPlatformConfig(config: AppConfig, platformName: string): unknown {
    if (!config.platforms) {
      return undefined;
    }
    return config.platforms[platformName];
  }

  /**
   * 获取所有平台配置
   */
  public getPlatforms(config: AppConfig): Record<string, unknown> | undefined {
    return config.platforms;
  }

  /**
   * 更新平台配置
   */
  public updatePlatformConfig(
    config: AppConfig,
    platformName: string,
    platformConfig: unknown
  ): void {
    if (!config.platforms) {
      config.platforms = {};
    }

    config.platforms[platformName] = platformConfig as Record<string, unknown>;
  }

  /**
   * 批量更新平台配置
   */
  public updatePlatforms(
    config: AppConfig,
    platforms: Record<string, unknown>
  ): void {
    for (const [platformName, platformConfig] of Object.entries(platforms)) {
      if (!config.platforms) {
        config.platforms = {};
      }
      config.platforms[platformName] = platformConfig as Record<string, unknown>;
    }
  }

  /**
   * 获取工具调用日志配置
   */
  public getToolCallLogConfig(config: AppConfig): Readonly<ToolCallLogConfig> {
    return config.toolCallLog || {};
  }

  /**
   * 更新工具调用日志配置
   */
  public updateToolCallLogConfig(
    config: AppConfig,
    toolCallLogConfig: Partial<ToolCallLogConfig>
  ): void {
    if (!config.toolCallLog) {
      config.toolCallLog = {};
    }

    Object.assign(config.toolCallLog, toolCallLogConfig);
  }

  /**
   * 获取 TTS 配置
   */
  public getTTSConfig(config: AppConfig): Readonly<TTSConfig> {
    return config.tts || {};
  }

  /**
   * 更新 TTS 配置
   */
  public updateTTSConfig(config: AppConfig, ttsConfig: Partial<TTSConfig>): void {
    if (!config.tts) {
      config.tts = {};
    }

    Object.assign(config.tts, ttsConfig);
  }

  /**
   * 获取 ASR 配置
   */
  public getASRConfig(config: AppConfig): Readonly<ASRConfig> {
    return config.asr || {};
  }

  /**
   * 获取 LLM 配置
   */
  public getLLMConfig(config: AppConfig): LLMConfig | null {
    return config.llm || null;
  }

  /**
   * 检查 LLM 配置是否有效
   */
  public isLLMConfigValid(config: AppConfig): boolean {
    const llmConfig = this.getLLMConfig(config);
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
   * 更新连接配置（由 updateConfig 方法调用）
   */
  public updateConfig(config: AppConfig, newConfig: Partial<AppConfig>): void {
    // 更新连接配置
    if (newConfig.connection) {
      this.updateConnectionConfig(config, newConfig.connection);
    }

    // 更新 ModelScope 配置
    if (newConfig.modelscope) {
      this.updateModelScopeConfig(config, newConfig.modelscope);
    }

    // 更新 Web UI 配置
    if (newConfig.webUI) {
      this.updateWebUIConfig(config, newConfig.webUI);
    }

    // 更新平台配置
    if (newConfig.platforms) {
      this.updatePlatforms(config, newConfig.platforms);
    }
  }
}

/**
 * 配置平台管理模块
 * 负责平台配置（如 ModelScope、WebUI、Coze 等）的管理操作
 */

import type {
  AppConfig,
  ModelScopeConfig,
  WebUIConfig,
  PlatformConfig,
  CozePlatformConfig,
  ToolCallLogConfig,
} from "./types.js";
import { configStorage } from "./storage.js";
import { configEvents } from "./events.js";

/**
 * 配置平台管理器
 * 负责平台配置的管理操作
 */
export class ConfigPlatforms {
  // ============ ModelScope 配置管理 ============

  /**
   * 获取 ModelScope 配置
   * @returns ModelScope 配置对象
   */
  public getModelScopeConfig(): Readonly<ModelScopeConfig> {
    const config = this.getMutableConfig();
    return config.modelscope || {};
  }

  /**
   * 获取 ModelScope API Key
   * 优先从配置文件读取，其次从环境变量读取
   * @returns ModelScope API Key 或 undefined
   */
  public getModelScopeApiKey(): string | undefined {
    const modelScopeConfig = this.getModelScopeConfig();
    return modelScopeConfig.apiKey || process.env.MODELSCOPE_API_TOKEN;
  }

  /**
   * 更新 ModelScope 配置
   * @param modelScopeConfig ModelScope 配置
   */
  public updateModelScopeConfig(
    modelScopeConfig: Partial<ModelScopeConfig>
  ): void {
    const config = this.getMutableConfig();

    // 确保 modelscope 对象存在
    if (!config.modelscope) {
      config.modelscope = {};
    }

    // 直接修改现有的 modelscope 对象以保留注释
    Object.assign(config.modelscope, modelScopeConfig);
    configStorage.saveConfig(config);

    // 发射配置更新事件
    configEvents.emit("config:updated", {
      type: "modelscope",
      timestamp: new Date(),
    });
  }

  /**
   * 设置 ModelScope API Key
   * @param apiKey ModelScope API Key
   */
  public setModelScopeApiKey(apiKey: string): void {
    if (!apiKey || typeof apiKey !== "string") {
      throw new Error("API Key 必须是非空字符串");
    }
    this.updateModelScopeConfig({ apiKey });
  }

  // ============ WebUI 配置管理 ============

  /**
   * 获取 Web UI 配置
   * @returns Web UI 配置对象
   */
  public getWebUIConfig(): Readonly<WebUIConfig> {
    const config = this.getMutableConfig();
    return config.webUI || {};
  }

  /**
   * 获取 Web UI 端口号
   * @returns Web UI 端口号
   */
  public getWebUIPort(): number {
    const webUIConfig = this.getWebUIConfig();
    return webUIConfig.port ?? 9999; // 默认端口 9999
  }

  /**
   * 更新 Web UI 配置
   * @param webUIConfig Web UI 配置
   */
  public updateWebUIConfig(webUIConfig: Partial<WebUIConfig>): void {
    const config = this.getMutableConfig();

    // 确保 webUI 对象存在
    if (!config.webUI) {
      config.webUI = {};
    }

    // 直接修改现有的 webUI 对象以保留注释
    Object.assign(config.webUI, webUIConfig);
    configStorage.saveConfig(config);

    // 发射配置更新事件
    configEvents.emit("config:updated", {
      type: "webui",
      timestamp: new Date(),
    });
  }

  /**
   * 设置 Web UI 端口号
   * @param port 端口号
   */
  public setWebUIPort(port: number): void {
    if (!Number.isInteger(port) || port <= 0 || port > 65535) {
      throw new Error("端口号必须是 1-65535 之间的整数");
    }
    this.updateWebUIConfig({ port });
  }

  // ============ 平台配置管理 ============

  /**
   * 更新平台配置
   * @param platformName 平台名称
   * @param platformConfig 平台配置
   */
  public updatePlatformConfig(
    platformName: string,
    platformConfig: PlatformConfig
  ): void {
    const config = this.getMutableConfig();
    if (!config.platforms) {
      config.platforms = {};
    }
    config.platforms[platformName] = platformConfig;
    // 注意：Web UI 可能需要刷新才能看到更新后的数据
    configStorage.saveConfig(config);

    // 发射配置更新事件
    configEvents.emit("config:updated", {
      type: "platform",
      platformName,
      timestamp: new Date(),
    });
  }

  /**
   * 获取扣子平台配置
   * @returns 扣子平台配置或 null
   */
  public getCozePlatformConfig(): CozePlatformConfig | null {
    const config = this.getMutableConfig();
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
   * @returns 扣子 API Token 或 null
   */
  public getCozeToken(): string | null {
    const cozeConfig = this.getCozePlatformConfig();
    return cozeConfig?.token || null;
  }

  /**
   * 设置扣子平台配置
   * @param config 扣子平台配置
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
   * @returns 扣子平台配置是否有效
   */
  public isCozeConfigValid(): boolean {
    const cozeConfig = this.getCozePlatformConfig();
    return (
      cozeConfig !== null &&
      typeof cozeConfig.token === "string" &&
      cozeConfig.token.trim() !== ""
    );
  }

  // ============ 工具调用日志配置管理 ============

  /**
   * 获取工具调用日志配置
   * @returns 工具调用日志配置对象
   */
  public getToolCallLogConfig(): Readonly<ToolCallLogConfig> {
    const config = this.getMutableConfig();
    return config.toolCallLog || {};
  }

  /**
   * 更新工具调用日志配置
   * @param toolCallLogConfig 工具调用日志配置
   */
  public updateToolCallLogConfig(
    toolCallLogConfig: Partial<ToolCallLogConfig>
  ): void {
    const config = this.getMutableConfig();

    // 确保 toolCallLog 对象存在
    if (!config.toolCallLog) {
      config.toolCallLog = {};
    }

    // 直接修改现有的 toolCallLog 对象以保留注释
    Object.assign(config.toolCallLog, toolCallLogConfig);
    configStorage.saveConfig(config);
  }

  /**
   * 获取可修改的配置对象（内部使用）
   * @returns 配置对象
   */
  private getMutableConfig(): AppConfig {
    return configStorage.loadConfig();
  }
}

// 导出单例实例
export const configPlatforms = new ConfigPlatforms();

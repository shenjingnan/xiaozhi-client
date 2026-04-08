/**
 * ModelScope 配置管理器
 *
 * 负责 ModelScope 相关配置的管理：
 * - API Key 管理
 * - ModelScope 配置更新
 */

import type { ModelScopeConfig } from "../types.js";
import { ConfigStore } from "./ConfigStore.js";

/**
 * ModelScope 配置管理器
 */
export class ModelScopeConfigManager {
  constructor(private readonly store: ConfigStore) {}

  /**
   * 获取 ModelScope 配置
   */
  public getModelScopeConfig(): Readonly<ModelScopeConfig> {
    const config = this.store.getConfig();
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
    const config = this.getMutableConfig();

    if (!config.modelscope) {
      config.modelscope = {};
    }

    Object.assign(config.modelscope, modelScopeConfig);
    this.store.saveConfig(config);

    this.emitConfigUpdate({ type: "modelscope", timestamp: new Date() });
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

  private getMutableConfig(): any {
    return (this.store as any).getMutableConfig();
  }

  private emitConfigUpdate(data: { type: string; timestamp: Date }): void {
    (this.store as any).emitEvent("config:updated", data);
  }
}

/**
 * 媒体配置管理器
 *
 * 负责媒体相关配置的管理：
 * - TTS 配置管理
 * - ASR 配置管理
 * - LLM 配置管理
 */

import type { TTSConfig, ASRConfig, LLMConfig } from "../types.js";
import { ConfigStore } from "./ConfigStore.js";

/**
 * 媒体配置管理器
 */
export class MediaConfigManager {
  constructor(private readonly store: ConfigStore) {}

  // ==================== TTS 配置 ====================

  /**
   * 获取 TTS 配置
   */
  public getTTSConfig(): Readonly<TTSConfig> {
    const config = this.store.getConfig();
    return config.tts || {};
  }

  /**
   * 更新 TTS 配置
   */
  public updateTTSConfig(ttsConfig: Partial<TTSConfig>): void {
    const config = this.getMutableConfig();

    if (!config.tts) {
      config.tts = {};
    }

    Object.assign(config.tts, ttsConfig);
    this.store.saveConfig(config);

    this.emitConfigUpdate({ type: "tts", timestamp: new Date() });
  }

  // ==================== ASR 配置 ====================

  /**
   * 获取 ASR 配置
   */
  public getASRConfig(): Readonly<ASRConfig> {
    const config = this.store.getConfig();
    return config.asr || {};
  }

  /**
   * 更新 ASR 配置
   */
  public updateASRConfig(asrConfig: Partial<ASRConfig>): void {
    const config = this.getMutableConfig();

    if (!config.asr) {
      config.asr = {};
    }

    Object.assign(config.asr, asrConfig);
    this.store.saveConfig(config);
  }

  // ==================== LLM 配置 ====================

  /**
   * 获取 LLM 配置
   */
  public getLLMConfig(): LLMConfig | null {
    const config = this.store.getConfig();
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
   * 更新 LLM 配置
   */
  public updateLLMConfig(llmConfig: Partial<LLMConfig>): void {
    const config = this.getMutableConfig();

    if (!config.llm) {
      config.llm = {} as LLMConfig;
    }

    Object.assign(config.llm, llmConfig);
    this.store.saveConfig(config);
  }

  private getMutableConfig(): any {
    return (this.store as any).getMutableConfig();
  }

  private emitConfigUpdate(data: { type: string; timestamp: Date }): void {
    (this.store as any).emitEvent("config:updated", data);
  }
}

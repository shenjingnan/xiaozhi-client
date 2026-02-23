/**
 * TTS 事件驱动客户端
 */

import { EventEmitter } from "node:events";
import { createTTSController } from "../core/index.js";
import type { AudioChunkCallback } from "../core/index.js";
import {
  type ByteDanceTTSConfig,
  validateByteDanceTTSConfig,
} from "../platforms/index.js";

/**
 * TTS 客户端选项
 */
export interface TTSClientOptions {
  /** 平台选择 */
  platform?: "bytedance";
  /** 平台配置 */
  config?: ByteDanceTTSConfig;
}

/**
 * TTS 事件驱动客户端
 */
export class TTS extends EventEmitter {
  private controller: ReturnType<typeof createTTSController> | null = null;
  private config: ByteDanceTTSConfig;
  private platform: string;

  constructor(options: TTSClientOptions) {
    super();

    this.platform = options.platform || "bytedance";
    this.config = options.config || {
      app: {
        appid: "",
        accessToken: "",
      },
      audio: {
        voice_type: "S_70000",
        encoding: "wav",
      },
    };
  }

  /**
   * 初始化控制器
   */
  private initController(): void {
    if (!this.controller) {
      this.controller = createTTSController(this.platform, {
        platform: this.platform,
        ...this.config,
      });
    }
  }

  /**
   * 流式合成语音
   * @param text - 要合成的文本
   * @returns Promise，音频流结束时 resolve
   */
  async synthesizeStream(text: string): Promise<void> {
    this.initController();

    if (!this.controller) {
      throw new Error("控制器未初始化");
    }

    const onAudioChunk: AudioChunkCallback = async (
      chunk: Uint8Array,
      isLast: boolean
    ): Promise<void> => {
      // 触发音频块事件
      this.emit("audio_chunk", chunk, isLast);
    };

    try {
      await this.controller.synthesizeStream(text, onAudioChunk);
      // 触发结果完成事件
      this.emit("result");
    } catch (error) {
      // 触发错误事件
      this.emit("error", error);
      throw error;
    }
  }

  /**
   * 非流式合成语音
   * @param text - 要合成的文本
   * @returns 完整的音频数据
   */
  async synthesize(text: string): Promise<Uint8Array> {
    this.initController();

    if (!this.controller) {
      throw new Error("控制器未初始化");
    }

    try {
      const audio = await this.controller.synthesize(text);
      // 触发结果完成事件
      this.emit("result", audio);
      return audio;
    } catch (error) {
      // 触发错误事件
      this.emit("error", error);
      throw error;
    }
  }

  /**
   * 关闭连接
   */
  close(): void {
    if (this.controller) {
      this.controller.close();
      this.controller = null;
    }
    this.emit("close");
  }

  /**
   * 更新配置
   * @param config - 新配置
   */
  updateConfig(config: Partial<ByteDanceTTSConfig>): void {
    this.config = {
      ...this.config,
      ...config,
      app: {
        ...this.config.app,
        ...config.app,
      },
      audio: {
        ...this.config.audio,
        ...config.audio,
      },
    };
    // 重新初始化控制器
    if (this.controller) {
      this.controller.close();
      this.controller = null;
    }
    this.initController();
  }

  /**
   * 获取当前配置
   * @returns 当前配置
   */
  getConfig(): ByteDanceTTSConfig {
    return { ...this.config };
  }

  /**
   * 验证配置
   * @param config - 要验证的配置
   * @returns 验证后的配置
   */
  static validateConfig(config: unknown): ByteDanceTTSConfig {
    return validateByteDanceTTSConfig(config);
  }
}

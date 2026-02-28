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
import { logger } from "../utils/index.js";

/**
 * TTS 客户端选项
 */
export interface TTSClientOptions {
  /** 平台选择 */
  platform?: "bytedance";
  /** 平台配置 */
  config?: ByteDanceTTSConfig;
  /** ByteDance V1 配置 */
  bytedance?: {
    v1?: ByteDanceTTSConfig;
  };
}

/**
 * 流式合成结果
 */
export interface StreamSpeakResult {
  /** 音频数据块 */
  chunk: Uint8Array;
  /** 是否为最终块 */
  isFinal: boolean;
}

/**
 * TTS 事件驱动客户端
 */
export class TTS extends EventEmitter {
  private controller: ReturnType<typeof createTTSController> | null = null;
  private config: ByteDanceTTSConfig;
  private platform: string;

  // ByteDance V1 控制器
  public readonly bytedance: {
    v1: {
      speak: (text: string) => AsyncGenerator<StreamSpeakResult, void, unknown>;
    };
  };

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

    // 初始化 ByteDance V1 控制器
    const v1Config = options.bytedance?.v1 || this.config;
    this.bytedance = {
      v1: {
        speak: (text: string) => this.createV1StreamIterator(text, v1Config),
      },
    };
  }

  /**
   * 创建 V1 流式合成迭代器
   */
  private async *createV1StreamIterator(
    text: string,
    config: ByteDanceTTSConfig
  ): AsyncGenerator<StreamSpeakResult, void, unknown> {
    // 使用 V1 端点和 ogg_opus 编码
    const v1Config: ByteDanceTTSConfig = {
      ...config,
      audio: {
        ...config.audio,
        encoding: "ogg_opus",
      },
    };

    const controller = createTTSController(this.platform, {
      platform: this.platform,
      ...v1Config,
    });

    // 使用回调方式实现异步迭代器
    const queue: StreamSpeakResult[] = [];
    let resolveNext: (() => void) | null = null;
    let streamEnded = false;
    let error: Error | null = null;

    const onAudioChunk = async (
      chunk: Uint8Array,
      isLast: boolean
    ): Promise<void> => {
      logger.debug(
        `Client onAudioChunk: isLast=${isLast}, chunk.length=${chunk.length}, queue.length before=${queue.length}`
      );
      queue.push({ chunk, isFinal: isLast });
      logger.debug(
        `Client onAudioChunk after push: queue.length=${queue.length}, streamEnded will be set to ${isLast}`
      );

      // 唤醒等待中的迭代器
      if (resolveNext) {
        logger.debug("Client: Waking iterator, resolveNext exists");
        const resolve = resolveNext;
        resolveNext = null;
        resolve();
      } else {
        logger.debug("Client: No resolveNext, iterator may not be waiting");
      }
    };

    // 启动流式合成
    const synthesisPromise = controller
      .synthesizeStream(text, onAudioChunk)
      .catch((e) => {
        error = e as Error;
        // 唤醒等待中的迭代器
        if (resolveNext) {
          const resolve = resolveNext;
          resolveNext = null;
          resolve();
        }
      });

    // 迭代返回结果
    while (!streamEnded) {
      // 如果队列中有结果，立即 yield
      while (queue.length > 0) {
        const result = queue.shift()!;
        logger.debug(
          `Iterator yielding: isFinal=${result.isFinal}, queue.length after=${queue.length}`
        );
        // 如果是最终块，yield 后退出
        if (result.isFinal) {
          streamEnded = true;
        }
        yield result;
      }

      // 如果有错误，抛出错误
      if (error) {
        throw error;
      }

      // 如果流已结束，退出
      if (streamEnded) {
        break;
      }

      // 如果没有结果，等待新结果
      await new Promise<void>((resolve) => {
        resolveNext = resolve;
      });

      // 检查是否有错误
      if (error) {
        throw error;
      }
    }

    // 确保合成完成
    await synthesisPromise;
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

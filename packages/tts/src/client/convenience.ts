/**
 * TTS 便捷函数
 */

import { createTTSController } from "../core/index.js";
import type { AudioChunkCallback } from "../core/index.js";
import {
  type ByteDanceTTSConfig,
  validateByteDanceTTSConfig,
} from "../platforms/index.js";

/**
 * 便捷合成选项
 */
export interface SynthesizeOptions {
  /** 应用 ID */
  appid: string;
  /** 访问令牌 */
  accessToken: string;
  /** 声音类型 */
  voice_type: string;
  /** 要合成的文本 */
  text: string;
  /** 编码格式（默认 wav） */
  encoding?: string;
  /** 集群类型 */
  cluster?: string;
  /** 端点 */
  endpoint?: string;
  /** 语速 */
  speed?: number;
  /** 音调 */
  pitch?: number;
  /** 音量 */
  volume?: number;
}

/**
 * 流式合成选项
 */
export interface SynthesizeStreamOptions extends SynthesizeOptions {
  /** 音频块回调 */
  onAudioChunk: AudioChunkCallback;
}

/**
 * 将便捷选项转换为配置
 */
function convertToConfig(options: SynthesizeOptions): ByteDanceTTSConfig {
  return {
    app: {
      appid: options.appid,
      accessToken: options.accessToken,
    },
    audio: {
      voice_type: options.voice_type,
      encoding: options.encoding || "wav",
      ...(options.speed !== undefined && { speed: options.speed }),
      ...(options.pitch !== undefined && { pitch: options.pitch }),
      ...(options.volume !== undefined && { volume: options.volume }),
    },
    ...(options.cluster && { cluster: options.cluster }),
    ...(options.endpoint && { endpoint: options.endpoint }),
  };
}

/**
 * 流式合成语音
 * @param options - 合成选项
 * @param onAudioChunk - 音频块回调
 * @returns Promise，音频流结束时 resolve
 */
export async function synthesizeSpeechStream(
  options: SynthesizeStreamOptions
): Promise<void> {
  const config = convertToConfig(options);
  const controller = createTTSController("bytedance", config);

  try {
    await controller.synthesizeStream(options.text, options.onAudioChunk);
  } finally {
    controller.close();
  }
}

/**
 * 非流式合成语音
 * @param options - 合成选项
 * @returns 音频二进制数据
 */
export async function synthesizeSpeech(
  options: SynthesizeOptions
): Promise<Uint8Array> {
  const config = convertToConfig(options);
  const controller = createTTSController("bytedance", config);

  try {
    return await controller.synthesize(options.text);
  } finally {
    controller.close();
  }
}

/**
 * 验证配置
 * @param config - 要验证的配置
 * @returns 验证后的配置
 */
export function validateConfig(config: unknown): ByteDanceTTSConfig {
  return validateByteDanceTTSConfig(config);
}

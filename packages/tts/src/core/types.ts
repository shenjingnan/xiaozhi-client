/**
 * TTS 核心类型定义
 */

import type {
  BasePlatformConfig,
  Platform,
  PlatformRegistry as SharedPlatformRegistry,
} from "@xiaozhi-client/shared-types/platform";

/**
 * 音频块回调类型
 * @param chunk - 音频数据块
 * @param isLast - 是否为最后一个音频块
 */
export type AudioChunkCallback = (
  chunk: Uint8Array,
  isLast: boolean
) => Promise<void>;

/**
 * TTS 合成结果
 */
export interface TTSResult {
  /** 音频二进制数据 */
  audio: Uint8Array;
  /** 编码格式 */
  encoding: string;
  /** 错误信息（如果有） */
  error?: string;
}

/**
 * TTS 控制器接口
 * 每个平台需要实现此接口
 */
export interface TTSController {
  /**
   * 流式合成语音
   * @param text - 要合成的文本
   * @param onAudioChunk - 音频块回调函数
   */
  synthesizeStream(
    text: string,
    onAudioChunk: AudioChunkCallback
  ): Promise<void>;

  /**
   * 非流式合成语音
   * @param text - 要合成的文本
   * @returns 完整的音频数据
   */
  synthesize(text: string): Promise<Uint8Array>;

  /**
   * 关闭连接
   */
  close(): void;
}

/**
 * 平台配置（重新导出共享类型）
 */
export type PlatformConfig = BasePlatformConfig;

/**
 * TTS 平台接口
 * 定义平台需要实现的抽象方法
 */
export interface TTSPlatform extends Platform<TTSController> {}

/**
 * 平台注册表
 * 存储所有已注册的平台
 */
export interface PlatformRegistry extends SharedPlatformRegistry<TTSPlatform> {}

/**
 * 通用 TTS 选项
 */
export interface CommonTTSOptions {
  /** 平台选择 */
  platform?: "bytedance";

  /** 平台特定配置 */
  config?: PlatformConfig;

  /** 回调：音频块 */
  onAudioChunk?: (chunk: Uint8Array, isLast: boolean) => void;

  /** 回调：错误 */
  onError?: (error: Error) => void;

  /** 回调：连接打开 */
  onOpen?: () => void;

  /** 回调：连接关闭 */
  onClose?: () => void;
}

/**
 * 事件类型
 */
export type TTSEventType =
  | "open"
  | "close"
  | "error"
  | "audio_chunk"
  | "result";

/**
 * 事件数据
 */
export interface TTSEventData {
  type: TTSEventType;
  data?: unknown;
}

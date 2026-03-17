/**
 * 核心类型定义
 */

import type { Readable } from "node:stream";
import type {
  Platform,
  BasePlatformConfig,
  PlatformRegistry as SharedPlatformRegistry,
} from "@xiaozhi-client/shared-types/platform";

/**
 * 音频输入类型
 */
export type AudioInput = AsyncIterable<Buffer> | Readable | Buffer;

/**
 * 流式识别结果（核心抽象类型）
 * 注意：此类型与 types/listen.ts 中的 ListenResult 兼容
 */
export interface ListenResult {
  /** 识别文本 */
  text: string;
  /** 是否为最终结果 */
  isFinal: boolean;
  /** 包序号 */
  seq?: number;
  /** 序列号（备用） */
  sequence?: number;
  /** 结果代码 */
  code?: number;
  /** 消息 */
  message?: string;
}

/**
 * ASR 控制器接口
 * 每个平台需要实现此接口
 */
export interface ASRController {
  /**
   * 流式识别
   * @param audioInput - 音频输入，支持 AsyncIterable、Readable 或 Buffer
   * @returns 异步生成器，持续产出识别结果
   */
  listen(audioInput: AudioInput): AsyncGenerator<ListenResult, void, unknown>;

  /**
   * 非流式识别
   * @param audioData - 音频数据
   * @returns 识别结果
   */
  execute(audioData: Buffer): Promise<ListenResult>;

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
 * ASR 平台接口
 * 定义平台需要实现的抽象方法
 */
export interface ASRPlatform extends Platform<ASRController> {}

/**
 * 平台注册表
 * 存储所有已注册的平台
 */
export interface PlatformRegistry extends SharedPlatformRegistry<ASRPlatform> {}

/**
 * 通用 ASR 选项
 */
export interface CommonASROptions {
  /** 平台选择 */
  platform?: "bytedance" | "minimax" | "alibaba" | "glm";

  /** 平台特定配置 */
  config?: PlatformConfig;

  /** 回调：识别结果 */
  onResult?: (result: ListenResult) => void;

  /** 回调：错误 */
  onError?: (error: Error) => void;

  /** 回调：连接打开 */
  onOpen?: () => void;

  /** 回调：连接关闭 */
  onClose?: () => void;

  /** 回调：VAD 结束 */
  onVADEnd?: (text: string) => void;

  /** 回调：音频结束 */
  onAudioEnd?: () => void;
}

/**
 * 事件类型
 */
export type ASREventType =
  | "open"
  | "close"
  | "error"
  | "result"
  | "audio_end"
  | "full_response"
  | "vad_end";

/**
 * 事件数据
 */
export interface ASREventData {
  type: ASREventType;
  data?: unknown;
}

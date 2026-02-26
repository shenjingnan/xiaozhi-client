/**
 * 核心类型定义
 */

import type { Readable } from "node:stream";
import type { PlatformConfig } from "@xiaozhi-client/platform-registry";

export type { PlatformConfig };

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
 * ASR 平台接口
 * 定义平台需要实现的抽象方法
 */
export interface ASRPlatform {
  /** 平台唯一标识 */
  readonly platform: string;

  /**
   * 创建流式识别控制器
   * @param config - 平台配置
   * @returns 控制器实例
   */
  createController(config: PlatformConfig): ASRController;

  /**
   * 校验配置
   * @param config - 用户配置
   * @returns 校验后的配置
   */
  validateConfig(config: unknown): PlatformConfig;

  /**
   * 获取认证头
   * @param config - 平台配置
   * @returns 认证头
   */
  getAuthHeaders(config: PlatformConfig): Record<string, string>;

  /**
   * 获取服务地址
   * @param config - 平台配置
   * @returns WebSocket URL
   */
  getEndpoint(config: PlatformConfig): string;
}

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

/**
 * Listen API 类型定义
 */

import type { Readable } from "node:stream";

/**
 * 音频流输入类型
 * 支持 AsyncIterable<Buffer>、Readable 流或 Buffer
 */
export type AudioInput =
  | AsyncIterable<Buffer>
  | Readable
  | Buffer
  | AsyncIterable<Uint8Array>;

/**
 * Listen 方法返回的结果类型
 */
export interface ListenResult {
  /** 识别文本 */
  text: string;
  /** 是否为最终结果 */
  isFinal: boolean;
  /** 包序号（用于调试） */
  seq?: number;
}

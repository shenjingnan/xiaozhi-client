/**
 * ByteDance 控制器基类
 */

import type { AudioInput, ListenResult } from "../../../types";

/**
 * ByteDance 流式 ASR 控制器基类
 */
export abstract class ByteDanceController {
  /**
   * 监听音频流并返回识别结果
   * @param audioStream - 音频流输入，支持 AsyncIterable、Readable 或 Buffer
   * @returns 异步生成器，持续产出识别结果
   */
  abstract listen(
    audioStream: AudioInput
  ): AsyncGenerator<ListenResult, void, unknown>;
}

/**
 * ByteDance V2 流式 ASR 控制器
 */

import type { ASR as ASRClient } from "@/client";
import { ByteDanceController } from "@/platforms/bytedance/controllers/ByteDanceController.js";

/**
 * ByteDance V2 流式 ASR 控制器实现
 */
export class ByteDanceV2Controller extends ByteDanceController {
  private asr: ASRClient;

  constructor(asr: ASRClient) {
    super();
    this.asr = asr;
  }

  /**
   * 获取 ASR 客户端实例
   */
  protected override getASR(): ASRClient {
    return this.asr;
  }
}

/**
 * ByteDance V3 流式 ASR 控制器
 */

import type { ASR as ASRClient } from "@/client";
import { ByteDanceController } from "@/platforms/bytedance/controllers/ByteDanceController.js";

/**
 * ByteDance V3 流式 ASR 控制器实现
 * V3 版本在注册事件监听器之前连接服务器
 */
export class ByteDanceV3Controller extends ByteDanceController {
  constructor(asr: ASRClient) {
    super(asr);
  }

  /**
   * V3 版本在注册事件监听器之前连接服务器
   */
  protected shouldConnectBeforeListeners(): boolean {
    return true;
  }
}

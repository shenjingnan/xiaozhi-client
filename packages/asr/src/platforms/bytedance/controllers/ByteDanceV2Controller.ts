/**
 * ByteDance V2 流式 ASR 控制器
 */

import type { ASR as ASRClient } from "@/client";
import { ByteDanceController } from "@/platforms/bytedance/controllers/ByteDanceController.js";

/**
 * ByteDance V2 流式 ASR 控制器实现
 * V2 版本在注册事件监听器之后连接服务器
 */
export class ByteDanceV2Controller extends ByteDanceController {
  constructor(asr: ASRClient) {
    super(asr);
  }

  /**
   * V2 版本在注册事件监听器之后连接服务器
   */
  protected shouldConnectBeforeListeners(): boolean {
    return false;
  }
}

/**
 * ByteDance V2 流式 ASR 控制器
 */

import type { ASR as ASRClient } from "@/client";
import { ByteDanceController } from "@/platforms/bytedance/controllers/ByteDanceController.js";

/**
 * ByteDance V2 流式 ASR 控制器实现
 * V2 与 V3 使用相同的流式 API，区别在于认证方式和请求参数
 * V2 需要在连接之前注册事件监听器，以避免错过初始响应
 */
export class ByteDanceV2Controller extends ByteDanceController {
  constructor(asr: ASRClient) {
    super(asr);
  }

  /**
   * V2 需要在注册事件处理器之前连接
   * 返回 false 表示先注册事件，后连接
   */
  protected shouldConnectBeforeEventHandlers(): boolean {
    return false;
  }
}

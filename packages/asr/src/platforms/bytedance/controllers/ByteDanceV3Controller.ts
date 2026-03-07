/**
 * ByteDance V3 流式 ASR 控制器
 */

import type { ASR as ASRClient } from "@/client";
import { ByteDanceController } from "@/platforms/bytedance/controllers/ByteDanceController.js";

/**
 * ByteDance V3 流式 ASR 控制器实现
 * V3 与 V2 使用相同的流式 API，区别在于认证方式和请求参数
 * V3 先连接服务器，然后注册事件监听器
 */
export class ByteDanceV3Controller extends ByteDanceController {
  constructor(asr: ASRClient) {
    super(asr);
  }

  /**
   * V3 需要在注册事件处理器之前连接
   * 返回 true 表示先连接，后注册事件
   */
  protected shouldConnectBeforeEventHandlers(): boolean {
    return true;
  }
}

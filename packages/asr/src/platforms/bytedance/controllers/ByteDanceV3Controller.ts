/**
 * ByteDance V3 流式 ASR 控制器
 * 继承基类，使用共享的流式处理逻辑
 */

import type { ASR as ASRClient } from "@/client";
import { ByteDanceController } from "@/platforms/bytedance/controllers/ByteDanceController.js";

/**
 * ByteDance V3 流式 ASR 控制器实现
 * V3 与 V2 使用相同的流式 API，区别在于认证方式和请求参数
 */
export class ByteDanceV3Controller extends ByteDanceController {
  constructor(asr: ASRClient) {
    super(asr);
  }
}

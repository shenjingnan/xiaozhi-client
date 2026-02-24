/**
 * 字节跳动 TTS 平台模块导出
 */

import { platformRegistry } from "@/core/index.js";
import { ByteDanceTTSPlatform } from "./TTSController.js";

// 注册字节跳动平台
platformRegistry.register(ByteDanceTTSPlatform);

export * from "./TTSController.js";
export * from "./schemas/index.js";
export * from "./protocol/index.js";
export { ByteDanceTTSPlatform };

/**
 * 核心模块导出
 */

// 客户端导出
export { ASRClient, type ASRClientOptions } from "./ASRClient.js";
// 类型导出
export type { ASRPlatformFactory } from "./ASRPlatform.js";
// 平台接口导出
export {
  platformRegistry,
  registerPlatform,
  SimplePlatformRegistry,
} from "./ASRPlatform.js";
// 工厂函数导出
export { getPlatform, listPlatforms } from "./factories.js";
// 类型导出（排除与 types/ 重复的类型）
export type {
  ASRController,
  ASREventData,
  ASREventType,
  ASRPlatform,
  CommonASROptions,
  PlatformConfig,
  PlatformRegistry,
} from "./types.js";

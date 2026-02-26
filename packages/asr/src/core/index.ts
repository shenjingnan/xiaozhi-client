/**
 * 核心模块导出
 */

// 类型导出（排除与 types/ 重复的类型）
export type {
  ASRController,
  PlatformConfig,
  ASRPlatform,
  CommonASROptions,
  ASREventType,
  ASREventData,
} from "./types.js";

// 平台接口导出
export {
  SimplePlatformRegistryImpl,
  platformRegistry,
  registerPlatform,
} from "./ASRPlatform.js";

// 类型导出
export type { ASRPlatformFactory, ASRPlatformRegistry } from "./ASRPlatform.js";

// 客户端导出
export { ASRClient, type ASRClientOptions } from "./ASRClient.js";

// 工厂函数导出
export { getPlatform, listPlatforms } from "./factories.js";

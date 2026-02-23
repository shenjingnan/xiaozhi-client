/**
 * 平台模块导出
 */

import { platformRegistry } from "../core/index.js";
import { ByteDancePlatform } from "./bytedance/index.js";

// 注册 ByteDance 平台
platformRegistry.register(
  new ByteDancePlatform({ platform: "bytedance", version: "v2" })
);

// 导出平台
export {
  ByteDancePlatform,
  createByteDancePlatform,
} from "./bytedance/index.js";

// 导出平台类型（从 bytedance/index.js 重新导出）
export type {
  ByteDancePlatformConfig,
  ByteDanceV2Config,
  ByteDanceV3Config,
} from "./bytedance/index.js";

// 导出平台注册表
export { platformRegistry } from "../core/index.js";

// 导出协议、控制器和 Schema（ByteDance）- 通过 bytedance/index.js 统一重新导出
export * from "./bytedance/index.js";

/**
 * ByteDance Streaming ASR WebSocket Client for Node.js
 */

// Audio exports
export * from "./audio/index.js";
// Auth exports
export * from "./auth/index.js";
// Core exports - 核心抽象层
export * from "./core/index.js";
// Platforms exports - 平台实现
export * from "./platforms/index.js";
// Protocol exports (ByteDance 二进制协议)
export * from "./platforms/index.js";

// Types exports
export * from "./types/index.js";

// Controllers exports (ByteDance 控制器) - 已通过 platforms/bytedance/index.js 导出

export type {
  ASREventData,
  ASREventType,
  ASROption,
  ASRResult,
} from "./client";
// Main client
export { ASR, executeOne } from "./client";
// Client exports
export * from "./client/index.js";
// Utils exports
export * from "./utils/index.js";

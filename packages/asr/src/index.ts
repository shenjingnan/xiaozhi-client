/**
 * ByteDance Streaming ASR WebSocket Client for Node.js
 */

// Core exports - 核心抽象层
export * from "./core/index.js";

// Platforms exports - 平台实现
export * from "./platforms/index.js";

// Protocol exports
export * from "./protocol/index.js";

// Audio exports
export * from "./audio/index.js";

// Auth exports
export * from "./auth/index.js";

// Types exports
export * from "./types/index.js";

// Controllers exports
export * from "./controllers/index.js";

// Client exports
export * from "./client/index.js";

// Utils exports
export * from "./utils/index.js";

// Main client
export { ASR, executeOne } from "./client";
export type {
  ASROption,
  ASRResult,
  ASREventType,
  ASREventData,
} from "./client";

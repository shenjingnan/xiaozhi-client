/**
 * ByteDance Streaming ASR WebSocket Client for Node.js
 */

// Protocol exports
export * from "./protocol/index.js";

// Audio exports
export * from "./audio/index.js";

// Auth exports
export * from "./auth/index.js";

// Client exports
export * from "./client/index.js";

// Utils exports
export * from "./utils/index.js";

// Main client
export { AsrWsClient, executeOne } from "./client/AsrWsClient.js";
export type { AsrClientOptions, AsrResult, AsrEventType, AsrEventData } from "./client/types.js";

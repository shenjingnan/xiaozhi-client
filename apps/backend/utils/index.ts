/**
 * Utils 统一导出模块
 * 提供 utils 目录下所有工具类的统一导出接口
 */

// 重新导出 @xiaozhi-client/version 以保持向后兼容
export { VersionUtils } from "@xiaozhi-client/version";
export { PathUtils } from "./path-utils.js";
export type { WebSocketLike } from "./websocket-helper.js";
// WebSocket 辅助工具
export { sendWebSocketError } from "./websocket-helper.js";

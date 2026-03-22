/**
 * Utils 统一导出模块
 * 提供 utils 目录下所有工具类的统一导出接口
 */

export { PathUtils } from "./path-utils.js";
// 重新导出 @xiaozhi-client/version 以保持向后兼容
export { VersionUtils } from "@xiaozhi-client/version";
// WebSocket 辅助工具
export { sendWebSocketError } from "./websocket-helper.js";
export type { WebSocketLike } from "./websocket-helper.js";
// ESP32 设备信息提取工具
export {
  extractDeviceInfo,
  camelToSnakeCase,
  type DeviceInfoFromHeaders,
  type ExtractedDeviceInfo,
} from "./esp32-utils.js";
// Prompt 管理工具
export {
  resolvePrompt,
  getDefaultSystemPrompt,
  listPromptFiles,
  validatePromptPath,
  validatePromptFileName,
  getPromptsDir,
  resolvePromptPath,
  readPromptFile,
  updatePromptFile,
  createPromptFile,
  deletePromptFile,
  type PromptFileInfo,
  type PromptFileContent,
} from "./prompt-utils.js";
// 工具排序工具
export {
  toolSorters,
  sortTools,
  type ToolSortField,
  type ToolSortConfig,
} from "./toolSorters.js";

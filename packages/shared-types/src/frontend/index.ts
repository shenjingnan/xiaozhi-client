/**
 * 前端相关类型导出
 */

// UI状态相关类型
export type { CozeWorkflowsResult, CozeUIState } from "./ui";

// 客户端状态类型（从 config/server 重新导出）
export type { ClientStatus } from "../config/server";

// API响应相关类型
export type {
  MCPServerAddRequest,
  MCPServerBatchAddRequest,
  MCPServerAddResult,
  MCPServerBatchAddResponse,
  MCPServerStatus,
  MCPServerListResponse,
  ApiSuccessResponse,
  ApiErrorResponse,
  ToolCallRecord,
  ToolCallLogsResponse,
  ApiResponse,
} from "./api";

export { MCPErrorCode } from "./api";

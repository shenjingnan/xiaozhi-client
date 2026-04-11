/**
 * MCP 工具函数模块
 *
 * 从 @xiaozhi-client/mcp-core 重新导出工具函数
 * 保持向后兼容性，统一导入路径
 */

// =========================
// 工具函数重新导出
// =========================

export {
  inferTransportTypeFromUrl,
  inferTransportTypeFromConfig,
  validateToolCallParams,
} from "@xiaozhi-client/mcp-core";

// =========================
// 相关类型重新导出
// =========================

export {
  MCPTransportType,
  ToolCallError,
  ToolCallErrorCode,
} from "@xiaozhi-client/mcp-core";

export type {
  MCPServiceConfig,
  ToolCallParams,
  ToolCallValidationOptions,
  ValidatedToolCallParams,
} from "@xiaozhi-client/mcp-core";

/**
 * MCP 工具函数模块
 *
 * 从 @xiaozhi-client/mcp-core 重新导出工具函数：
 * - 传输类型推断（基于 URL 或配置）
 * - 工具调用参数验证
 */

// =========================
// 从 mcp-core 重新导出的工具函数
// =========================

export {
  TypeFieldNormalizer,
  normalizeTypeField,
  validateToolCallParams,
  inferTransportTypeFromUrl,
  inferTransportTypeFromConfig,
} from "@xiaozhi-client/mcp-core";
/**
 * MCP 工具函数模块
 *
 * 从 mcp-core 核心库重新导出验证和推断函数，避免代码重复。
 * 所有实现位于 src/mcp-core/utils/validators.ts
 *
 * 注意：相关类型（ToolCallError, ToolCallErrorCode 等）已由 ./types.ts 导出
 */

// 从 mcp-core 核心库重新导出验证函数
export {
  validateToolCallParams,
  inferTransportTypeFromUrl,
  inferTransportTypeFromConfig,
} from "../../../mcp-core/utils/validators.js";

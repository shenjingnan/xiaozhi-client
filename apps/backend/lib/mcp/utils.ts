/**
 * MCP 工具函数模块
 *
 * 提供 MCP 服务配置和工具调用的工具函数：
 * - 传输类型推断（基于 URL 或配置）
 * - 工具调用参数验证
 *
 * @remarks
 * 本模块重新导出 @xiaozhi-client/mcp-core 包中的工具函数，保持向后兼容性。
 * 这样可以避免代码重复，确保所有使用相同功能的代码引用同一个实现。
 */

// 重新导出来自 @xiaozhi-client/mcp-core 的工具函数
// 这些函数在 mcp-core 包中有完整的实现和测试
export {
  inferTransportTypeFromUrl,
  inferTransportTypeFromConfig,
  validateToolCallParams,
} from "@xiaozhi-client/mcp-core";

// 导出类型以保持向后兼容
export type {
  MCPServiceConfig,
  ToolCallParams,
  ToolCallValidationOptions,
  ValidatedToolCallParams,
} from "./types.js";

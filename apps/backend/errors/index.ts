/**
 * 错误处理模块
 *
 * 统一导出所有错误处理相关的类型和工具：
 *
 * - **直接导出**：从 `mcp-errors.ts` 导出错误类型定义
 * - **命名空间导出**：从 `error-helper.ts` 导出错误辅助工具
 *
 * @packageDocumentation
 *
 * @example
 * ```typescript
 * // 导入错误类型
 * import { MCPErrorCode, MCPError } from '@/errors/index.js';
 *
 * // 导入错误辅助工具（推荐使用命名空间导入）
 * import * as ErrorHelper from '@/errors/index.js';
 *
 * // 使用错误辅助工具
 * const categorizedError = ErrorHelper.categorizeError(error, 'service-name');
 * ```
 */

export * from "./mcp-errors.js";

// ErrorHelper 使用命名空间导出以避免与 mcp-errors 中的类型冲突
export * as ErrorHelper from "./error-helper.js";

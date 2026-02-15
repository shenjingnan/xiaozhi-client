/**
 * 错误处理模块统一导出
 *
 * 此文件作为 apps/backend/errors 的入口点，统一导出所有错误类型和错误处理工具。
 * 主要包括：
 *
 * - **MCP 错误类型**：
 *   - {@link MCPErrorCode} - MCP 错误代码枚举
 *   - {@link MCPError} - MCP 错误接口
 *   - {@link ErrorDetails} - 错误详情接口
 *   - {@link ErrorSeverity} - 错误严重级别枚举
 *   - {@link ErrorCategory} - 错误类别枚举
 *
 * - **错误处理工具**：
 *   - {@link ErrorHelper} - 错误处理工具命名空间
 *   - 错误分类和恢复策略
 *   - 错误创建和判断函数
 *   - 错误格式化和统计功能
 *
 * @example
 * ```typescript
 * // 导入错误类型
 * import { MCPErrorCode, MCPError, ErrorSeverity } from '@/errors';
 *
 * // 导入错误处理工具（推荐使用命名空间导入）
 * import * as ErrorHelper from '@/errors';
 *
 * // 使用错误类型
 * const error: MCPError = {
 *   code: MCPErrorCode.CONNECTION_FAILED,
 *   message: 'Connection failed',
 *   details: {
 *     serverName: 'my-service',
 *     timestamp: new Date().toISOString(),
 *     severity: ErrorSeverity.HIGH,
 *     category: ErrorCategory.CONNECTION,
 *   },
 * };
 *
 * // 使用错误处理工具
 * const categorizedError = ErrorHelper.categorizeError(
 *   new Error('Connection failed'),
 *   'my-service'
 * );
 *
 * // 判断错误是否可恢复
 * if (ErrorHelper.isRecoverable(categorizedError)) {
 *   console.log('Error is recoverable');
 * }
 * ```
 *
 * @module apps/backend/errors
 */
export * from "./mcp-errors.js";

// ErrorHelper 使用命名空间导出以避免与 mcp-errors 中的类型冲突
export * as ErrorHelper from "./error-helper.js";

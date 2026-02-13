/**
 * 错误处理模块统一导出入口
 *
 * 导出 MCP 相关错误类型定义和错误处理辅助工具
 */
export * from "./mcp-errors.js";

// ErrorHelper 使用命名空间导出以避免与 mcp-errors 中的类型冲突
export * as ErrorHelper from "./error-helper.js";

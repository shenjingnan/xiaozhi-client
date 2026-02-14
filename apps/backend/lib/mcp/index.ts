/**
 * MCP 核心库统一导出模块
 *
 * 提供完整的 MCP（Model Context Protocol）核心功能，包括：
 * - MCPServiceManager: MCP 服务管理器，统一管理多个 MCP 服务
 * - MCPService: MCP 服务类，负责单个 MCP 服务的连接和工具管理
 * - MCPMessageHandler: MCP 消息处理器，处理所有 MCP 协议消息
 * - MCPCacheManager: MCP 缓存管理器，负责工具列表的缓存
 * - CustomMCPHandler: 自定义 MCP 处理器，处理 Coze 工作流等自定义工具
 * - ToolCallLogger: 工具调用记录器，提供 JSONL 格式的记录功能
 * - ToolCallLogService: 工具调用日志服务，提供查询功能（重新导出，实际位于 @/services）
 * - 类型定义: MCP 相关的所有 TypeScript 类型定义
 * - 工具函数: MCP 工具调用的辅助函数
 *
 * @packageDocumentation
 *
 * @example
 * ```typescript
 * import { MCPServiceManager } from '@/lib/mcp';
 *
 * // 创建服务管理器
 * const manager = new MCPServiceManager(config);
 * await manager.startAllServices();
 *
 * // 获取所有工具
 * const tools = manager.getAllTools();
 *
 * // 调用工具
 * const result = await manager.callTool('tool-name', { param: 'value' });
 * ```
 */
export * from "@/lib/mcp/manager.js";
export * from "@/lib/mcp/connection.js";
export * from "@/lib/mcp/types.js";
export * from "@/lib/mcp/utils.js";
export * from "./message.js";
export * from "@/lib/mcp/cache.js";
export * from "./custom.js";
export * from "./log.js";
// 向后兼容：从 services/ 重新导出 ToolCallLogService
export { ToolCallLogService } from "@/services/tool-call-log.service.js";
export type {
  ToolCallQuery,
  ToolCallRecord,
} from "@/services/tool-call-log.service.js";

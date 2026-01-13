/**
 * 小智接入点连接管理模块
 *
 * ## 重新导出层 (Re-export Layer)
 *
 * 此模块作为重新导出层，统一导出 @xiaozhi-client/endpoint 独立包的所有公共 API。
 *
 * ### 为什么使用重新导出层？
 *
 * 1. **统一导入路径**：所有业务代码通过 @/lib/endpoint 导入，保持一致性
 * 2. **隐藏实现细节**：业务代码不需要知道具体使用的是哪个独立包
 * 3. **便于切换实现**：如果需要切换实现，只需修改此文件
 * 4. **向后兼容**：保持旧 API 的兼容性
 *
 * ### 架构设计
 *
 * ```
 * 业务代码
 *     ↓
 * @/lib/endpoint (此文件 - 重新导出层)
 *     ↓
 * @xiaozhi-client/endpoint (独立包)
 * ```
 *
 * ### 使用方式
 *
 * ```typescript
 * // 推荐：通过重新导出层导入
 * import { Endpoint, EndpointManager } from '@/lib/endpoint/index.js';
 *
 * // 不推荐：直接导入独立包
 * import { Endpoint, EndpointManager } from '@xiaozhi-client/endpoint';
 * ```
 *
 * ### 迁移历史
 *
 * - 2024-12: endpoint 核心代码迁移到 @xiaozhi-client/endpoint 独立包
 * - 此文件作为重新导出层保留，维持向后兼容性
 */

// =========================
// 从独立包重新导出
// =========================

// 核心类导出（新 API）
export {
  Endpoint,
  EndpointManager,
  ToolCallErrorCode,
  ToolCallError,
} from "@xiaozhi-client/endpoint";

// =========================
// 类型导出
// =========================

export type {
  // 工具调用相关
  ToolCallResult,
  ToolCallParams,
  ValidatedToolCallParams,
  // 服务管理器接口
  IMCPServiceManager,
  // 连接状态相关
  EndpointConnectionStatus,
  ConnectionOptions,
  // 管理器状态相关
  SimpleConnectionStatus,
  ConnectionStatus,
  ConfigChangeEvent as EndpointConfigChangeEvent,
  ReconnectResult,
  // JSON Schema
  JSONSchema,
  // 新 API 配置类型
  MCPServerConfig,
  LocalMCPServerConfig,
  SSEMCPServerConfig,
  StreamableHTTPMCPServerConfig,
  EndpointConfig,
  EndpointManagerConfig,
} from "@xiaozhi-client/endpoint";

// =========================
// 枚举导出
// =========================

export { ConnectionState } from "@xiaozhi-client/endpoint";

// =========================
// 工具函数导出
// =========================

export {
  sliceEndpoint,
  validateToolCallParams,
  isValidEndpointUrl,
  deepMerge,
  sleep,
  formatErrorMessage,
} from "@xiaozhi-client/endpoint";

export { ensureToolJSONSchema } from "@xiaozhi-client/endpoint";

// =========================
// MCP 类型导出
// =========================

export type { MCPMessage, ExtendedMCPMessage } from "@xiaozhi-client/endpoint";

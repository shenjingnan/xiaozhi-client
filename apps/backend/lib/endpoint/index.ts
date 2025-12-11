/**
 * 小智接入点连接管理模块
 *
 * 此模块负责管理小智接入点的连接，包括：
 * - EndpointConnection: 单个 WebSocket 连接实现
 * - IndependentXiaozhiConnectionManager: 多个连接的管理器
 */

// 核心类导出
export { EndpointConnection } from "./connection.js";
export { IndependentXiaozhiConnectionManager } from "./manager.js";

// 类型导出
export type {
  IndependentConnectionOptions,
  SimpleConnectionStatus,
  ConnectionStatus,
  ConfigChangeEvent as EndpointConfigChangeEvent,
} from "./manager.js";

// 枚举导出
export { XiaozhiConnectionState } from "./manager.js";

// EndpointConnection 相关导出
export { ToolCallErrorCode, ToolCallError } from "./connection.js";

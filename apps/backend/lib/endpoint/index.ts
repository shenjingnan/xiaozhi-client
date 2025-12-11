/**
 * 小智接入点连接管理模块
 *
 * 此模块负责管理小智接入点的连接，包括：
 * - ProxyMCPServer: 单个 WebSocket 连接实现
 * - IndependentXiaozhiConnectionManager: 多个连接的管理器
 */

// 核心类导出
export { ProxyMCPServer } from "./connection.js";
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

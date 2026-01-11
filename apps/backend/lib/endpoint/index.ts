/**
 * 小智接入点连接管理模块
 *
 * 此模块重新导出 @xiaozhi-client/endpoint 包
 * 保留原有的导出接口以保持向后兼容性
 */

// =========================
// 从独立包重新导出
// =========================

// 核心类导出
export {
  EndpointConnection,
  EndpointManager,
  ToolCallErrorCode,
  ToolCallError,
} from "@xiaozhi-client/endpoint";

// =========================
// 类型导出（带别名映射以保持向后兼容）
// =========================

export type {
  ConnectionOptions as IndependentConnectionOptions,
  SimpleConnectionStatus,
  ConnectionStatus,
  ConfigChangeEvent as EndpointConfigChangeEvent,
  ReconnectResult,
} from "@xiaozhi-client/endpoint";

// 枚举导出（使用别名保持向后兼容）
// ConnectionState 既是类型也是值，所以只需要值导出
export { ConnectionState as XiaozhiConnectionState } from "@xiaozhi-client/endpoint";

// =========================
// 增强管理器导出
// =========================

// 如果需要配置持久化功能，可以导入 EnhancedEndpointManager
// export { EnhancedEndpointManager } from "./EnhancedEndpointManager.js";

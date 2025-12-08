export * from "./ConfigService.js";
export * from "./StatusService.js";
export * from "./NotificationService.js";
export * from "./MCPServiceManagerSingleton.js";
export * from "./EventBus.js";

// IndependentXiaozhiConnectionManager 导出 - 避免冲突的 ConfigChangeEvent
export {
  XiaozhiConnectionState,
  type IndependentConnectionOptions,
  type SimpleConnectionStatus,
} from "@/lib/endpoint/manager.js";

// 重命名 ConfigChangeEvent 以避免与 ConfigWatcher 的冲突
export type { ConfigChangeEvent as EndpointConfigChangeEvent } from "@/lib/endpoint/manager.js";

export * from "./XiaozhiConnectionManagerSingleton.js";

// 新增导出 - 高优先级服务模块
export * from "./ConfigWatcher.js";
export * from "./ErrorHandler.js";
export * from "./HealthChecker.js";
export * from "./PerformanceMonitor.js";

// MCPService 导出 - 避免冲突的 ToolCallResult
export {
  type MCPTransportType,
  ConnectionState,
  type ModelScopeSSEOptions,
  type MCPServiceConfig,
  type MCPServiceStatus,
  type ToolCallResult,
  MCPService,
} from "./MCPService.js";
export { TransportFactory } from "@/lib/mcp/transport-factory.js";

// 传输适配器重新导出（向后兼容）
export {
  TransportAdapter,
  StdioAdapter,
  WebSocketAdapter,
  type MCPMessage,
  type MCPResponse,
  type MCPError,
  type TransportConfig,
  type StdioConfig,
  type WebSocketConfig,
} from "@/lib/mcp/transports/index.js";

// CustomMCPHandler 导出 - 避免冲突的 ToolCallResult
export { CustomMCPHandler } from "./CustomMCPHandler.js";
export * from "./CozeApiService.js";

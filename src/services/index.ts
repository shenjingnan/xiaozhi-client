export * from "./ConfigService.js";
export * from "./StatusService.js";
export * from "./NotificationService.js";
export * from "./MCPServiceManager.js";
export { default as MCPServiceManager } from "./MCPServiceManager.js";
export * from "./MCPServiceManagerSingleton.js";
export * from "./EventBus.js";

// IndependentXiaozhiConnectionManager 导出 - 避免冲突的 ConfigChangeEvent
export {
  IndependentXiaozhiConnectionManager,
  XiaozhiConnectionState,
  type IndependentConnectionOptions,
  type SimpleConnectionStatus,
  type ConnectionStatus,
} from "./IndependentXiaozhiConnectionManager.js";

// 重命名 ConfigChangeEvent 以避免与 ConfigWatcher 的冲突
export type { ConfigChangeEvent as EndpointConfigChangeEvent } from "./IndependentXiaozhiConnectionManager.js";

export * from "./XiaozhiConnectionManagerSingleton.js";

// 新增导出 - 高优先级服务模块
export * from "./ConfigWatcher.js";
export * from "./ErrorHandler.js";
export * from "./HealthChecker.js";
export * from "./PerformanceMonitor.js";

// MCPService 导出 - 避免冲突的 ToolCallResult
export {
  MCPTransportType,
  ConnectionState,
  type ReconnectOptions,
  type PingOptions,
  type ModelScopeSSEOptions,
  type MCPServiceConfig,
  type MCPServiceStatus,
  type MCPServiceOptions,
  MCPService,
} from "./MCPService.js";
export { TransportFactory } from "./TransportFactory.js";

// CustomMCPHandler 导出 - 避免冲突的 ToolCallResult
export { CustomMCPHandler } from "./CustomMCPHandler.js";
export * from "./CozeApiService.js";

// 缓存和日志管理服务
export { MCPCacheManager } from "./MCPCacheManager.js";
export type { MCPToolsCache, MCPToolsCacheEntry } from "./MCPCacheManager.js";
export * from "./ToolCallLogService.js";

// 其他服务模块
export * from "./ToolSyncManager.js";
export * from "./NPMManager.js";
export * from "./MCPServer.js";
export * from "./ToolCallService.js";

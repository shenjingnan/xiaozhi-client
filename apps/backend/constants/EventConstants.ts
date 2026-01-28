/**
 * 事件名称常量定义
 */

/**
 * MCP 服务相关事件
 */
export const MCP_SERVICE_EVENTS = {
  /** 服务已连接 */
  CONNECTED: "mcp:service:connected",
  /** 服务已断开连接 */
  DISCONNECTED: "mcp:service:disconnected",
  /** 服务连接失败 */
  CONNECTION_FAILED: "mcp:service:connection:failed",
} as const;

/**
 * MCP 服务器相关事件
 */
export const MCP_SERVER_EVENTS = {
  /** 服务器已添加 */
  ADDED: "mcp:server:added",
  /** 批量添加服务器 */
  BATCH_ADDED: "mcp:server:batch_added",
  /** 服务器已移除 */
  REMOVED: "mcp:server:removed",
  /** 服务器已启动 */
  STARTED: "mcp:server:started",
  /** 服务器已停止 */
  STOPPED: "mcp:server:stopped",
} as const;

/**
 * 接入点相关事件
 */
export const ENDPOINT_EVENTS = {
  /** 接入点状态变更 */
  STATUS_CHANGED: "endpoint:status:changed",
  /** 接入点已添加 */
  ADDED: "endpoint:added",
  /** 接入点已移除 */
  REMOVED: "endpoint:removed",
  /** 接入点重连完成 */
  RECONNECT_COMPLETED: "endpoint:reconnect:completed",
  /** 接入点重连失败 */
  RECONNECT_FAILED: "endpoint:reconnect:failed",
} as const;

/**
 * 配置相关事件
 */
export const CONFIG_EVENTS = {
  /** 配置已更新 */
  UPDATED: "config:updated",
  /** 配置错误 */
  ERROR: "config:error",
} as const;

/**
 * 状态相关事件
 */
export const STATUS_EVENTS = {
  /** 状态已更新 */
  UPDATED: "status:updated",
  /** 心跳超时 */
  HEARTBEAT_TIMEOUT: "status:heartbeat:timeout",
} as const;

/**
 * WebSocket 相关事件
 */
export const WEBSOCKET_EVENTS = {
  /** 客户端已连接 */
  CLIENT_CONNECTED: "websocket:client:connected",
  /** 客户端已断开 */
  CLIENT_DISCONNECTED: "websocket:client:disconnected",
  /** 消息解析错误 */
  MESSAGE_PARSE_ERROR: "websocket:message:parse_error",
} as const;

/**
 * 所有事件名称的联合类型（用于类型检查）
 */
export type AllEventNames =
  | (typeof MCP_SERVICE_EVENTS)[keyof typeof MCP_SERVICE_EVENTS]
  | (typeof MCP_SERVER_EVENTS)[keyof typeof MCP_SERVER_EVENTS]
  | (typeof ENDPOINT_EVENTS)[keyof typeof ENDPOINT_EVENTS]
  | (typeof CONFIG_EVENTS)[keyof typeof CONFIG_EVENTS]
  | (typeof STATUS_EVENTS)[keyof typeof STATUS_EVENTS]
  | (typeof WEBSOCKET_EVENTS)[keyof typeof WEBSOCKET_EVENTS];

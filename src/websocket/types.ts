/**
 * WebSocket 相关类型定义
 * 定义了 WebSocket 消息类型和相关接口
 */

/**
 * WebSocket 消息类型枚举
 */
export enum WebSocketMessageType {
  // 配置相关消息
  GET_CONFIG = "getConfig",
  UPDATE_CONFIG = "updateConfig",
  CONFIG_UPDATE = "configUpdate",

  // 状态相关消息
  GET_STATUS = "getStatus",
  CLIENT_STATUS = "clientStatus",
  STATUS_UPDATE = "statusUpdate",

  // 服务相关消息
  RESTART_SERVICE = "restartService",
  RESTART_STATUS = "restartStatus",

  // 系统消息
  ERROR = "error",
  HEARTBEAT = "heartbeat",
}

/**
 * 配置相关消息接口
 */
export interface ConfigMessage {
  type: WebSocketMessageType.GET_CONFIG | WebSocketMessageType.UPDATE_CONFIG;
  config?: any;
}

/**
 * 状态相关消息接口
 */
export interface StatusMessage {
  type: WebSocketMessageType.GET_STATUS | WebSocketMessageType.CLIENT_STATUS;
  data?: any;
}

/**
 * 服务相关消息接口
 */
export interface ServiceMessage {
  type: WebSocketMessageType.RESTART_SERVICE;
  data?: any;
}

/**
 * 错误消息接口
 */
export interface ErrorMessage {
  type: WebSocketMessageType.ERROR;
  error: string;
  timestamp?: number;
}

/**
 * 心跳消息接口
 */
export interface HeartbeatMessage {
  type: WebSocketMessageType.HEARTBEAT;
  timestamp: number;
}

/**
 * WebSocket 消息联合类型
 */
export type WebSocketMessage =
  | ConfigMessage
  | StatusMessage
  | ServiceMessage
  | ErrorMessage
  | HeartbeatMessage;

/**
 * WebSocket 连接状态
 */
export enum WebSocketConnectionState {
  CONNECTING = "connecting",
  CONNECTED = "connected",
  DISCONNECTING = "disconnecting",
  DISCONNECTED = "disconnected",
}

/**
 * WebSocket 连接信息
 */
export interface WebSocketConnectionInfo {
  id: string;
  state: WebSocketConnectionState;
  connectedAt: Date;
  lastActivity: Date;
  messageCount: number;
}

/**
 * 连接参数常量
 *
 * 定义 WebSocket 连接相关的默认常量值，确保整个应用使用一致的默认值。
 */

/**
 * 连接参数默认值
 */
export const DEFAULT_CONNECTION_PARAMS = {
  /** 心跳间隔（毫秒） */
  HEARTBEAT_INTERVAL: 30000,
  /** 心跳超时（毫秒） */
  HEARTBEAT_TIMEOUT: 10000,
  /** 重连间隔（毫秒） */
  RECONNECT_INTERVAL: 5000,
} as const;

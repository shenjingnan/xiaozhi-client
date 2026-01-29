/**
 * 超时和延迟常量定义
 * 所有时间单位均为毫秒（ms）
 */

/**
 * MCP 相关超时常量
 */
export const MCP_TIMEOUTS = {
  /** 默认超时时间 */
  DEFAULT: 8000,
  /** 心跳间隔 */
  HEARTBEAT_INTERVAL: 30000,
  /** 心跳超时 */
  HEARTBEAT_TIMEOUT: 35000,
  /** 服务连接超时 */
  CONNECTION_TIMEOUT: 30000,
} as const;

/**
 * 缓存相关超时常量
 */
export const CACHE_TIMEOUTS = {
  /** 缓存 TTL（生存时间） */
  TTL: 300000,
  /** 清理间隔 */
  CLEANUP_INTERVAL: 60000,
} as const;

/**
 * HTTP 相关超时常量
 */
export const HTTP_TIMEOUTS = {
  /** 默认超时 */
  DEFAULT: 30000,
  /** 长运行任务超时 */
  LONG_RUNNING: 60000,
} as const;

/**
 * 重试相关延迟常量
 */
export const RETRY_DELAYS = {
  /** 初始延迟 */
  INITIAL: 1000,
  /** 最大延迟 */
  MAX: 30000,
  /** 重连延迟 */
  RECONNECT: 2000,
} as const;

/**
 * 心跳监控相关常量
 */
export const HEARTBEAT_MONITORING = {
  /** 监控间隔 */
  MONITOR_INTERVAL: 10000,
  /** 超时阈值 */
  TIMEOUT_THRESHOLD: 35000,
} as const;

/**
 * 重试相关配置常量
 */
export const RETRY_CONFIG = {
  /** 最大重试次数 */
  MAX_ATTEMPTS: 5,
  /** 退避乘数 */
  BACKOFF_MULTIPLIER: 2,
} as const;

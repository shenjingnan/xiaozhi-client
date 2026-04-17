/**
 * 超时和延迟常量定义
 * 所有时间单位均为毫秒（ms）
 */

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
 * 服务重启相关延迟常量
 */
export const SERVICE_RESTART_DELAYS = {
  /** 重启执行延迟 */
  EXECUTION_DELAY: 500,
  /** 成功状态通知延迟 */
  SUCCESS_NOTIFICATION_DELAY: 5000,
} as const;

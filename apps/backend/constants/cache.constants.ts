/**
 * 缓存相关常量定义
 */

/**
 * 缓存配置常量
 */
export const CACHE_CONFIG = {
  /** 最大缓存大小 */
  MAX_SIZE: 1000,
  /** 是否启用一次性缓存 */
  ENABLE_ONE_TIME_CACHE: true,
} as const;

/**
 * 消息大小限制常量
 */
export const MESSAGE_SIZE_LIMITS = {
  /** 默认消息大小限制（1MB） */
  DEFAULT: 1024 * 1024,
  /** 最大消息大小限制（10MB） */
  MAX: 10 * 1024 * 1024,
} as const;

/**
 * 分页限制常量
 */
export const PAGINATION_LIMITS = {
  /** 默认每页记录数 */
  DEFAULT_LIMIT: 50,
  /** 最大每页记录数 */
  MAX_LIMIT: 200,
} as const;

/**
 * 缓存文件相关常量
 */
export const CACHE_FILE_CONFIG = {
  /** 缓存文件名 */
  FILENAME: "xiaozhi.cache.json",
  /** 临时文件后缀 */
  TEMP_SUFFIX: ".tmp",
} as const;

/**
 * 工具名称分隔符常量
 */
export const TOOL_NAME_SEPARATORS = {
  /** 服务名与工具名之间的分隔符 */
  SERVICE_TOOL_SEPARATOR: "__",
} as const;

/**
 * 缓存统计相关常量
 */
export const CACHE_STATS = {
  /** 默认缓存命中率 */
  DEFAULT_HIT_RATE: 0,
  /** 最小命中率（百分比） */
  MIN_HIT_RATE: 0,
  /** 最大命中率（百分比） */
  MAX_HIT_RATE: 100,
} as const;

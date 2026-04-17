/**
 * 缓存相关常量定义
 */

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

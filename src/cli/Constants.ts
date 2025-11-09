/**
 * CLI 常量定义
 */

/**
 * 服务相关常量
 */
export const SERVICE_CONSTANTS = {
  /** 服务名称 */
  NAME: "xiaozhi-mcp-service",
  /** 默认端口 */
  DEFAULT_PORT: 3000,
  /** Web UI 默认端口 */
  DEFAULT_WEB_UI_PORT: 9999,
  /** PID 文件名 */
  PID_FILE: "xiaozhi.pid",
  /** 日志文件名 */
  LOG_FILE: "xiaozhi.log",
} as const;

/**
 * 配置相关常量
 */
export const CONFIG_CONSTANTS = {
  /** 配置文件名（按优先级排序） */
  FILE_NAMES: [
    "xiaozhi.config.json5",
    "xiaozhi.config.jsonc",
    "xiaozhi.config.json",
  ],
  /** 默认配置文件名 */
  DEFAULT_FILE: "xiaozhi.config.default.json",
  /** 配置目录环境变量 */
  DIR_ENV_VAR: "XIAOZHI_CONFIG_DIR",
} as const;

/**
 * 路径相关常量
 */
export const PATH_CONSTANTS = {
  /** 工作目录名 */
  WORK_DIR: ".xiaozhi",
  /** 模板目录名 */
  TEMPLATES_DIR: "templates",
  /** 日志目录名 */
  LOGS_DIR: "logs",
} as const;

/**
 * 错误码常量
 */
export const ERROR_CODES = {
  /** 通用错误 */
  GENERAL_ERROR: "GENERAL_ERROR",
  /** 配置错误 */
  CONFIG_ERROR: "CONFIG_ERROR",
  /** 服务错误 */
  SERVICE_ERROR: "SERVICE_ERROR",
  /** 验证错误 */
  VALIDATION_ERROR: "VALIDATION_ERROR",
  /** 文件操作错误 */
  FILE_ERROR: "FILE_ERROR",
  /** 进程错误 */
  PROCESS_ERROR: "PROCESS_ERROR",
  /** 网络错误 */
  NETWORK_ERROR: "NETWORK_ERROR",
  /** 权限错误 */
  PERMISSION_ERROR: "PERMISSION_ERROR",
} as const;

/**
 * 超时常量（毫秒）
 */
export const TIMEOUT_CONSTANTS = {
  /** 进程停止超时 */
  PROCESS_STOP: 3000,
  /** 服务启动超时 */
  SERVICE_START: 10000,
  /** 网络请求超时 */
  NETWORK_REQUEST: 5000,
  /** 文件操作超时 */
  FILE_OPERATION: 2000,
} as const;

/**
 * 分页相关常量
 */
export const PAGINATION_CONSTANTS = {
  /** 默认每页记录数 */
  DEFAULT_LIMIT: 50,
  /** 最大每页记录数 */
  MAX_LIMIT: 200,
} as const;

/**
 * 重试常量
 */
export const RETRY_CONSTANTS = {
  /** 默认重试次数 */
  DEFAULT_ATTEMPTS: 3,
  /** 重试间隔（毫秒） */
  DEFAULT_INTERVAL: 1000,
  /** 最大重试间隔（毫秒） */
  MAX_INTERVAL: 5000,
} as const;

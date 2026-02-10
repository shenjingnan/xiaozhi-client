/**
 * MCP 协议相关常量定义
 */

/**
 * JSON-RPC 版本常量
 */
export const JSONRPC_VERSION = "2.0" as const;

/**
 * MCP 协议版本常量
 */
export const MCP_PROTOCOL_VERSIONS = {
  /** 2024-11-05 版本 */
  V2024_11_05: "2024-11-05",
  /** 2025-06-18 版本 */
  V2025_06_18: "2025-06-18",
  /** 默认版本 */
  DEFAULT: "2024-11-05",
} as const;

/**
 * MCP 支持的协议版本数组
 */
export const MCP_SUPPORTED_PROTOCOL_VERSIONS = [
  MCP_PROTOCOL_VERSIONS.V2024_11_05,
  MCP_PROTOCOL_VERSIONS.V2025_06_18,
] as const;

/**
 * MCP 服务器信息常量
 */
export const MCP_SERVER_INFO = {
  /** 服务器名称 */
  NAME: "xiaozhi-mcp-server",
  /** 服务器版本 */
  VERSION: "1.0.0",
} as const;

/**
 * MCP 方法名称常量
 */
export const MCP_METHODS = {
  /** 初始化 */
  INITIALIZE: "initialize",
  /** 已初始化通知 */
  INITIALIZED: "notifications/initialized",
  /** 工具列表 */
  TOOLS_LIST: "tools/list",
  /** 调用工具 */
  TOOLS_CALL: "tools/call",
  /** 资源列表 */
  RESOURCES_LIST: "resources/list",
  /** 提示列表 */
  PROMPTS_LIST: "prompts/list",
  /** Ping */
  PING: "ping",
} as const;

/**
 * JSON-RPC 错误码常量
 */
export const JSONRPC_ERROR_CODES = {
  /** 解析错误 */
  PARSE_ERROR: -32700,
  /** 无效请求 */
  INVALID_REQUEST: -32600,
  /** 方法未找到 */
  METHOD_NOT_FOUND: -32601,
  /** 无效参数 */
  INVALID_PARAMS: -32602,
  /** 内部错误 */
  INTERNAL_ERROR: -32603,
} as const;

/**
 * JSON-RPC 错误消息常量
 */
export const JSONRPC_ERROR_MESSAGES = {
  /** 解析错误消息 */
  PARSE_ERROR: "Parse error: Invalid JSON",
  /** 无效请求消息 */
  INVALID_REQUEST: "Invalid Request: Message does not conform to JSON-RPC 2.0",
  /** 方法未找到消息 */
  METHOD_NOT_FOUND: "Method not found",
  /** 无效参数消息 */
  INVALID_PARAMS: "Invalid params",
  /** 内部错误消息 */
  INTERNAL_ERROR: "Internal error",
  /** 未找到工具消息 */
  TOOL_NOT_FOUND: "未找到工具",
  /** 未知方法消息 */
  UNKNOWN_METHOD: "未知的方法",
} as const;

/**
 * MCP 缓存版本常量
 */
export const MCP_CACHE_VERSIONS = {
  /** 缓存文件格式版本 */
  CACHE_VERSION: "1.0.0",
  /** 缓存条目版本 */
  CACHE_ENTRY_VERSION: "1.0.0",
} as const;

/**
 * MCP 服务状态类型常量
 */
export const MCP_SERVICE_STATUS = {
  /** 已连接 */
  CONNECTED: "connected",
  /** 断开连接 */
  DISCONNECTED: "disconnected",
  /** 连接中 */
  CONNECTING: "connecting",
  /** 错误 */
  ERROR: "error",
} as const;

/**
 * MCP 默认配置常量
 */
export const MCP_DEFAULT_CONFIG = {
  /** 超时时间（8秒） */
  TIMEOUT: 8000,
  /** 缓存 TTL（5分钟） */
  CACHE_TTL: 300000,
  /** 清理间隔（1分钟） */
  CLEANUP_INTERVAL: 60000,
  /** 最大缓存条目数 */
  MAX_CACHE_SIZE: 1000,
  /** 启用一次性缓存 */
  ENABLE_ONE_TIME_CACHE: true,
} as const;

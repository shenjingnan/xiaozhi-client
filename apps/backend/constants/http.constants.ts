/**
 * HTTP 协议相关常量定义
 */

/**
 * HTTP Content-Type 常量
 */
export const HTTP_CONTENT_TYPES = {
  /** JSON 格式 */
  APPLICATION_JSON: "application/json",
  /** HTML 格式 */
  TEXT_HTML: "text/html",
  /** 纯文本格式 */
  TEXT_PLAIN: "text/plain",
  /** CSS 样式表 */
  TEXT_CSS: "text/css",
  /** JavaScript 代码 */
  APPLICATION_JAVASCRIPT: "application/javascript",
  /** XML 格式 */
  APPLICATION_XML: "application/xml",
  /** PDF 文档 */
  APPLICATION_PDF: "application/pdf",
  /** ZIP 压缩包 */
  APPLICATION_ZIP: "application/zip",
  /** 八位字节流 */
  APPLICATION_OCTET_STREAM: "application/octet-stream",
} as const;

/**
 * HTTP 请求头常量
 */
export const HTTP_HEADERS = {
  /** Content-Type 头 */
  CONTENT_TYPE: "Content-Type",
  /** Content-Length 头 */
  CONTENT_LENGTH: "content-length",
  /** MCP 协议版本头 */
  MCP_PROTOCOL_VERSION: "MCP-Protocol-Version",
  /** 响应时间头 */
  X_RESPONSE_TIME: "X-Response-Time",
} as const;

/**
 * HTTP 状态码常量
 */
export const HTTP_STATUS_CODES = {
  /** 成功 */
  OK: 200,
  /** 已创建 */
  CREATED: 201,
  /** 无内容 */
  NO_CONTENT: 204,
  /** 错误的请求 */
  BAD_REQUEST: 400,
  /** 未授权 */
  UNAUTHORIZED: 401,
  /** 禁止访问 */
  FORBIDDEN: 403,
  /** 未找到 */
  NOT_FOUND: 404,
  /** 请求超时 */
  REQUEST_TIMEOUT: 408,
  /** 内部服务器错误 */
  INTERNAL_SERVER_ERROR: 500,
  /** 服务不可用 */
  SERVICE_UNAVAILABLE: 503,
} as const;

/**
 * HTTP 服务器配置常量
 */
export const HTTP_SERVER_CONFIG = {
  /** 默认绑定地址 */
  DEFAULT_BIND_ADDRESS: "0.0.0.0",
  /** 默认端口 */
  DEFAULT_PORT: 9999,
} as const;

/**
 * HTTP 错误消息常量
 */
export const HTTP_ERROR_MESSAGES = {
  /** 请求过大错误消息 */
  REQUEST_TOO_LARGE: "Request too large",
  /** 消息过大错误消息 */
  MESSAGE_TOO_LARGE: "Message too large",
  /** 无效请求错误消息 */
  INVALID_REQUEST: "Invalid Request",
  /** Content-Type 必须是 application/json */
  INVALID_CONTENT_TYPE: "Content-Type must be application/json",
  /** 解析错误 */
  PARSE_ERROR: "Parse error",
  /** 无效的 JSON */
  INVALID_JSON: "Invalid JSON",
  /** 内部错误 */
  INTERNAL_ERROR: "Internal error",
} as const;

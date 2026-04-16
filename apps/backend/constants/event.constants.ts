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

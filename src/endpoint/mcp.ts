/**
 * MCP 消息类型定义
 *
 * 定义最小化的 MCP 协议消息类型
 */

/**
 * MCP 消息接口
 */
export interface MCPMessage {
  /** JSON-RPC 版本 */
  jsonrpc: "2.0";
  /** 方法名 */
  method: string;
  /** 参数 */
  params?: unknown;
  /** 请求 ID */
  id: string | number;
}

/**
 * 扩展的 MCP 消息接口（用于响应）
 */
export interface ExtendedMCPMessage {
  jsonrpc: "2.0";
  id: string | number;
  result?: unknown;
  error?: {
    code: number;
    message: string;
    data?: unknown;
  };
}

/**
 * MCP 消息协议相关类型定义
 */

/**
 * MCP 消息接口
 */
export interface MCPMessage<TParams = unknown> {
  jsonrpc: "2.0";
  method: string;
  params?: TParams;
  id?: string | number;
}

/**
 * MCP 响应接口
 */
export interface MCPResponse<TResult = unknown> {
  jsonrpc: "2.0";
  result?: TResult;
  error?: MCPError;
  id: string | number | null;
}

/**
 * MCP 错误接口
 */
export interface MCPError<TData = unknown> {
  code: number;
  message: string;
  data?: TData;
}

/**
 * 连接状态枚举
 */
export enum ConnectionState {
  DISCONNECTED = "disconnected",
  CONNECTING = "connecting",
  CONNECTED = "connected",
  ERROR = "error",
}

/**
 * 传输适配器配置接口
 */
export interface TransportConfig {
  name: string;
  timeout?: number;
  retryAttempts?: number;
  retryDelay?: number;
}

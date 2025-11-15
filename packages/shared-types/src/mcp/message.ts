/**
 * MCP 消息协议相关类型定义
 */

/**
 * MCP 消息接口
 */
export interface MCPMessage {
  jsonrpc: "2.0";
  method: string;
  params?: any;
  id?: string | number;
}

/**
 * MCP 响应接口
 */
export interface MCPResponse {
  jsonrpc: "2.0";
  result?: any;
  error?: MCPError;
  id: string | number | null;
}

/**
 * MCP 错误接口
 */
export interface MCPError {
  code: number;
  message: string;
  data?: any;
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
/**
 * Endpoint 包核心类型定义
 *
 * 定义小智接入点相关的所有核心类型，包括：
 * - 工具调用相关类型（ToolCallResult、ToolCallParams 等）
 * - JSON Schema 类型定义
 * - 工具信息类型（EnhancedToolInfo 等）
 * - MCP 服务配置类型
 * - 连接状态类型
 *
 * @module types
 */

// =========================
// 1. 工具调用相关类型
// =========================

/**
 * 工具调用结果接口
 * 使用更宽松的类型定义以兼容不同来源的 ToolCallResult
 */
export interface ToolCallResult {
  content: Array<Record<string, unknown>>;
  isError?: boolean;
  _meta?: Record<string, unknown>;
  toolResult?: unknown; // 支持旧协议版本
  [key: string]: unknown; // 支持其他未知字段
}

/**
 * 工具调用参数接口
 */
export interface ToolCallParams {
  name: string;
  arguments?: Record<string, unknown>;
}

/**
 * 验证后的工具调用参数
 */
export interface ValidatedToolCallParams {
  name: string;
  arguments?: Record<string, unknown>;
}

/**
 * 工具调用错误码枚举
 */
export enum ToolCallErrorCode {
  /** 无效参数 */
  INVALID_PARAMS = -32602,
  /** 工具不存在 */
  TOOL_NOT_FOUND = -32601,
  /** 服务不可用 */
  SERVICE_UNAVAILABLE = -32001,
  /** 调用超时 */
  TIMEOUT = -32002,
  /** 工具执行错误 */
  TOOL_EXECUTION_ERROR = -32000,
}

/**
 * 工具调用错误类
 */
export class ToolCallError extends Error {
  constructor(
    public code: ToolCallErrorCode,
    message: string,
    public data?: unknown
  ) {
    super(message);
    this.name = "ToolCallError";
  }
}

// =========================
// 2. JSON Schema 类型
// =========================

// 从 mcp-core 重新导出 JSONSchema 类型和相关函数，避免重复定义
import type { JSONSchema } from "@xiaozhi-client/mcp-core";
import { ensureToolJSONSchema } from "@xiaozhi-client/mcp-core";

// 重新导出供外部使用
export type { JSONSchema };
export { ensureToolJSONSchema };

// =========================
// 3. 工具信息类型
// =========================

/**
 * 增强的工具信息接口
 * 包含工具的启用状态和使用统计信息
 */
export interface EnhancedToolInfo {
  /** 工具唯一标识符，格式为 "{serviceName}__{originalName}" */
  name: string;

  /** 工具描述信息 */
  description: string;

  /** 工具输入参数的 JSON Schema 定义 */
  inputSchema: JSONSchema;

  /** 工具所属的 MCP 服务名称 */
  serviceName: string;

  /** 工具在 MCP 服务中的原始名称 */
  originalName: string;

  /** 工具是否启用 */
  enabled: boolean;

  /** 工具使用次数统计 */
  usageCount: number;

  /** 工具最后使用时间 (ISO 8601 格式字符串) */
  lastUsedTime: string;
}

/**
 * MCP 服务管理器接口
 * 用于工具调用，避免循环依赖
 */
export interface IMCPServiceManager {
  /** 获取所有工具列表 */
  getAllTools(): EnhancedToolInfo[];

  /** 调用工具 */
  callTool(
    toolName: string,
    arguments_: Record<string, unknown>
  ): Promise<ToolCallResult>;

  /** 初始化 */
  initialize(): Promise<void>;

  /** 清理资源 */
  cleanup(): Promise<void>;
}

// =========================
// 4. 连接状态类型
// =========================

/**
 * 连接状态枚举
 */
export enum ConnectionState {
  DISCONNECTED = "disconnected",
  CONNECTING = "connecting",
  CONNECTED = "connected",
  FAILED = "failed",
}

/**
 * 连接选项接口
 */
export interface ConnectionOptions {
  /** 连接超时时间（毫秒），默认 10000 */
  connectionTimeout?: number;
  /** 重连延迟时间（毫秒），默认 2000 */
  reconnectDelay?: number;
}

// =========================
// 5. EndpointConnection 状态类型
// =========================

/**
 * EndpointConnection 状态接口
 */
export interface EndpointConnectionStatus {
  /** 是否已连接 */
  connected: boolean;
  /** 是否已初始化 */
  initialized: boolean;
  /** 接入点 URL */
  url: string;
  /** 可用工具数量 */
  availableTools: number;
  /** 连接状态 */
  connectionState: ConnectionState;
  /** 最后一次错误信息 */
  lastError: string | null;
}

// =========================
// 6. EndpointManager 状态类型
// =========================

/**
 * 简单连接状态接口
 */
export interface SimpleConnectionStatus {
  /** 接入点地址 */
  endpoint: string;
  /** 是否已连接 */
  connected: boolean;
  /** 是否已初始化 */
  initialized: boolean;
  /** 最后连接时间 */
  lastConnected?: Date;
  /** 最后错误信息 */
  lastError?: string;
}

/**
 * 完整连接状态接口（扩展 SimpleConnectionStatus）
 */
export interface ConnectionStatus extends SimpleConnectionStatus {
  // 扩展字段可以在这里添加
}

/**
 * 配置变更事件类型
 */
export interface ConfigChangeEvent {
  type:
    | "endpoints_added"
    | "endpoints_removed"
    | "endpoints_updated"
    | "options_updated";
  data: {
    added?: string[];
    removed?: string[];
    updated?: string[];
    oldOptions?: Partial<ConnectionOptions>;
    newOptions?: Partial<ConnectionOptions>;
  };
  timestamp: Date;
}

/**
 * 重连结果接口
 */
export interface ReconnectResult {
  successCount: number;
  failureCount: number;
  results: Array<{
    endpoint: string;
    success: boolean;
    error?: string;
  }>;
}

// =========================
// 7. 新 API 配置类型
// =========================

/**
 * MCP 服务器配置类型
 * 支持三种配置方式：
 * 1. 本地命令 (stdio): { command: string; args: string[]; env?: Record<string, string> }
 * 2. SSE: { type: "sse"; url: string; headers?: Record<string, string> }
 * 3. HTTP: { type?: "http"; url: string; headers?: Record<string, string> }
 *
 * 向后兼容：自动将 streamable-http/streamable_http/streamableHttp 转换为 http
 */
export type MCPServerConfig =
  | LocalMCPServerConfig
  | SSEMCPServerConfig
  | HTTPMCPServerConfig;

/**
 * 本地 MCP 服务器配置
 */
export interface LocalMCPServerConfig {
  command: string;
  args: string[];
  env?: Record<string, string>;
}

/**
 * SSE MCP 服务器配置
 */
export interface SSEMCPServerConfig {
  type: "sse";
  url: string;
  headers?: Record<string, string>;
}

/**
 * HTTP MCP 服务器配置
 * 使用 type: "http"
 * 向后兼容 streamable-http 写法
 */
export interface HTTPMCPServerConfig {
  type?: "http" | "streamable-http"; // 可选，默认就是 http
  url: string;
  headers?: Record<string, string>;
}

// 向后兼容的别名
/** @deprecated 使用 HTTPMCPServerConfig 代替 */
export type StreamableHTTPMCPServerConfig = HTTPMCPServerConfig;

/**
 * Endpoint 配置接口
 * @deprecated 不再使用，Endpoint 构造函数改为接收 IMCPServiceManager
 */
export interface EndpointConfig {
  /** MCP 服务器配置（声明式） */
  mcpServers: Record<string, MCPServerConfig>;
  /** 可选：重连延迟（毫秒），默认 2000 */
  reconnectDelay?: number;
  /** 可选：ModelScope API Key（全局） */
  modelscopeApiKey?: string;
}

/**
 * EndpointManager 配置接口
 */
export interface EndpointManagerConfig {
  /** 可选：默认重连延迟（毫秒） */
  defaultReconnectDelay?: number;
}

// =========================
// 8. JWT Token 类型
// =========================

/**
 * 小智平台 JWT Token Payload 接口
 *
 * @example
 * ```typescript
 * // 从 endpoint URL 解码得到的 payload
 * const payload: XiaozhiTokenPayload = {
 *   userId: 302720,
 *   agentId: 1324149,
 *   endpointId: "agent_1324149",
 *   purpose: "mcp-endpoint",
 *   iat: 1768480930,
 *   exp: 1800038530
 * };
 * ```
 */
export interface XiaozhiTokenPayload {
  /** 用户 ID */
  userId: number;
  /** 代理 ID */
  agentId: number;
  /** 接入点 ID，格式为 "agent_{agentId}" */
  endpointId: string;
  /** Token 用途 */
  purpose: string;
  /** 签发时间（Unix 时间戳） */
  iat: number;
  /** 过期时间（Unix 时间戳） */
  exp: number;
}

/**
 * 解析后的 Endpoint URL 信息
 */
export interface ParsedEndpointInfo {
  /** 完整的 endpoint URL */
  url: string;
  /** 提取的 JWT Token */
  token: string;
  /** 解码后的 Token Payload */
  payload: XiaozhiTokenPayload;
  /** WebSocket 服务器地址（不含 token 参数） */
  wsUrl: string;
}

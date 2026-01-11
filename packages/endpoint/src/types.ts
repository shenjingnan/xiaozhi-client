// =========================
// 1. 工具调用相关类型
// =========================

/**
 * 工具调用结果接口
 */
export interface ToolCallResult {
  content: Array<{
    type: string;
    text: string;
  }>;
  isError?: boolean;
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

/**
 * JSON Schema 类型定义
 * 兼容 MCP SDK 的 JSON Schema 格式
 */
export type JSONSchema =
  | (Record<string, unknown> & {
      type: "object";
      properties?: Record<string, unknown>;
      required?: string[];
      additionalProperties?: boolean;
    })
  | Record<string, unknown>;

/**
 * 确保对象符合 MCP Tool JSON Schema 格式
 * 返回类型兼容 MCP SDK 的 Tool 类型
 */
export function ensureToolJSONSchema(schema: JSONSchema): {
  type: "object";
  properties?: Record<string, object>;
  required?: string[];
  additionalProperties?: boolean;
} {
  if (
    typeof schema === "object" &&
    schema !== null &&
    "type" in schema &&
    schema.type === "object"
  ) {
    return schema as {
      type: "object";
      properties?: Record<string, object>;
      required?: string[];
      additionalProperties?: boolean;
    };
  }

  // 如果不符合标准格式，返回默认的空对象 schema
  return {
    type: "object",
    properties: {},
    required: [],
    additionalProperties: true,
  };
}

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
 * 3. Streamable HTTP: { type?: "streamable-http"; url: string; headers?: Record<string, string> }
 */
export type MCPServerConfig =
  | LocalMCPServerConfig
  | SSEMCPServerConfig
  | StreamableHTTPMCPServerConfig;

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
 * Streamable HTTP MCP 服务器配置
 */
export interface StreamableHTTPMCPServerConfig {
  type?: "streamable-http"; // 可选，默认就是 streamable-http
  url: string;
  headers?: Record<string, string>;
}

/**
 * Endpoint 配置接口
 * 用于新 API：直接在构造函数中传入 MCP 服务器配置
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
 * EndpointManager 配置接口（新 API 简化版）
 */
export interface EndpointManagerConfig {
  /** 可选：默认重连延迟（毫秒） */
  defaultReconnectDelay?: number;
}

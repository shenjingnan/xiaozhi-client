/**
 * MCP 核心库类型定义
 * 统一管理所有 MCP 相关的类型定义
 */

import type { Tool } from "@modelcontextprotocol/sdk/types.js";
import type { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";
import type { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import type { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

// =========================
// 1. 基础传输类型
// =========================

/**
 * MCP 传输层联合类型定义
 * 支持 STDIO、SSE、StreamableHTTP 三种传输协议
 */
export type MCPServerTransport =
  | StdioClientTransport
  | SSEClientTransport
  | StreamableHTTPClientTransport;

/**
 * 通信方式枚举
 * 定义 MCP 支持的传输类型
 */
export enum MCPTransportType {
  STDIO = "stdio",
  SSE = "sse",
  HTTP = "http",
}

/**
 * 传输类型字符串字面量
 * 方便外部用户直接使用字符串而不需要导入枚举
 */
export type MCPTransportTypeString = "stdio" | "sse" | "http";

/**
 * 传输类型输入值（枚举或字符串字面量）
 */
export type MCPTransportTypeInput = MCPTransportType | MCPTransportTypeString;

// =========================
// 1.1 事件回调接口
// =========================

/**
 * MCP 服务事件回调接口
 * 用于替代 EventBus 依赖，提供灵活的事件处理机制
 */
export interface MCPServiceEventCallbacks {
  /** 连接成功回调 */
  onConnected?: (data: {
    serviceName: string;
    tools: Tool[];
    connectionTime: Date;
  }) => void;
  /** 断开连接回调 */
  onDisconnected?: (data: {
    serviceName: string;
    reason?: string;
    disconnectionTime: Date;
  }) => void;
  /** 连接失败回调 */
  onConnectionFailed?: (data: {
    serviceName: string;
    error: Error;
    attempt: number;
  }) => void;
}

// =========================
// 2. 配置接口类型
// =========================

/**
 * ModelScope SSE 自定义选项接口
 */
export interface ModelScopeSSEOptions {
  eventSourceInit?: {
    fetch?: (
      url: string | URL | Request,
      init?: RequestInit
    ) => Promise<Response>;
  };
  requestInit?: RequestInit;
}

/**
 * 心跳检测配置接口
 */
export interface HeartbeatConfig {
  /** 是否启用心跳检测（默认 false） */
  enabled?: boolean;
  /** 心跳间隔（毫秒，默认 30000 = 30秒） */
  interval?: number;
}

/**
 * MCP 服务配置接口
 * 包含所有 MCP 服务的配置选项（不包含服务名称）
 *
 * @description
 * 与 MCP 官方配置格式保持一致，支持三种传输类型：
 * - stdio: 本地进程通信 { command, args, env }
 * - sse: Server-Sent Events { url, headers }
 * - http: Streamable HTTP { url, headers }
 *
 * 向后兼容：自动将 streamable-http/streamable_http/streamableHttp 转换为 http
 */
export interface MCPServiceConfig {
  // name 字段已从配置中移除，应作为独立参数传递
  type?: MCPTransportTypeInput; // 支持枚举或字符串字面量，如 "stdio" | "sse" | "http"
  // stdio 配置
  command?: string;
  args?: string[];
  env?: Record<string, string>; // 环境变量配置
  // 网络配置
  url?: string;
  // 认证配置
  apiKey?: string;
  headers?: Record<string, string>;
  customSSEOptions?: ModelScopeSSEOptions;
  // 心跳配置
  heartbeat?: HeartbeatConfig;
}

/**
 * 旧版 MCP 服务配置接口（包含 name 字段）
 * 用于向后兼容
 */
export interface LegacyMCPServiceConfig extends MCPServiceConfig {
  name: string;
}

/**
 * 内部使用的 MCP 服务配置接口（包含 name 字段）
 * 用于 TransportFactory 等内部函数
 */
export interface InternalMCPServiceConfig extends MCPServiceConfig {
  name: string;
}

// =========================
// 3. 状态枚举类型
// =========================

/**
 * 连接状态枚举
 */
export enum ConnectionState {
  DISCONNECTED = "disconnected",
  CONNECTING = "connecting",
  CONNECTED = "connected",
  RECONNECTING = "reconnecting",
  FAILED = "failed",
  ERROR = "error",
}

/**
 * MCP 服务状态接口
 */
export interface MCPServiceStatus {
  name: string;
  connected: boolean;
  initialized: boolean;
  transportType: MCPTransportType;
  toolCount: number;
  lastError?: string;
  connectionState: ConnectionState;
}

// =========================
// 4. 工具调用相关类型
// =========================

// 从 MCP SDK 重新导出工具调用结果类型
// 使用 CompatibilityCallToolResult 以支持新旧协议版本
export type { CompatibilityCallToolResult as ToolCallResult } from "@modelcontextprotocol/sdk/types.js";

/**
 * JSON Schema 类型定义
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
 * 类型守卫：检查对象是否为有效的 MCP Tool JSON Schema
 */
export function isValidToolJSONSchema(obj: unknown): obj is {
  type: "object";
  properties?: Record<string, unknown>;
  required?: string[];
  additionalProperties?: boolean;
} {
  return (
    typeof obj === "object" &&
    obj !== null &&
    "type" in obj &&
    (obj as { type?: unknown }).type === "object"
  );
}

/**
 * 确保对象符合 MCP Tool JSON Schema 格式
 */
export function ensureToolJSONSchema(schema: JSONSchema): {
  type: "object";
  properties?: Record<string, object>;
  required?: string[];
  additionalProperties?: boolean;
} {
  if (isValidToolJSONSchema(schema)) {
    return schema as {
      type: "object";
      properties?: Record<string, object>;
      required?: string[];
      additionalProperties?: boolean;
    };
  }

  return {
    type: "object",
    properties: {} as Record<string, object>,
    required: [],
    additionalProperties: true,
  };
}

/**
 * CustomMCP 工具类型定义
 */
export interface CustomMCPTool {
  name: string;
  description?: string;
  inputSchema: JSONSchema;
  handler?: {
    type: string;
    config?: Record<string, unknown>;
  };
}

/**
 * 工具信息接口
 */
export interface ToolInfo {
  serviceName: string;
  originalName: string;
  tool: Tool;
}

// =========================
// 5. 增强工具信息类型
// =========================

/**
 * 工具状态过滤选项
 */
export type ToolStatusFilter = "enabled" | "disabled" | "all";

/**
 * 增强的工具信息接口
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
  /** 工具最后使用时间 */
  lastUsedTime: string;
}

// =========================
// 6. 服务器配置类型
// =========================

/**
 * 统一服务器配置接口
 */
export interface UnifiedServerConfig {
  name?: string;
  enableLogging?: boolean;
  logLevel?: string;
  configs?: Record<string, MCPServiceConfig>;
}

/**
 * 统一服务器状态接口
 */
export interface UnifiedServerStatus {
  isRunning: boolean;
  serviceStatus: ManagerStatus;
  transportCount: number;
  activeConnections: number;
  config: UnifiedServerConfig;
  services?: Record<string, MCPServiceConnectionStatus>;
  totalTools?: number;
  availableTools?: string[];
}

// =========================
// 7. 管理器相关类型
// =========================

/**
 * MCP 服务连接状态接口
 */
export interface MCPServiceConnectionStatus {
  connected: boolean;
  clientName: string;
}

/**
 * 管理器状态接口
 */
export interface ManagerStatus {
  services: Record<string, MCPServiceConnectionStatus>;
  totalTools: number;
  availableTools: string[];
}

// =========================
// 8. 参数校验相关类型
// =========================

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
 * 工具调用验证选项
 */
export interface ToolCallValidationOptions {
  validateName?: boolean;
  validateArguments?: boolean;
  allowEmptyArguments?: boolean;
  customValidator?: (params: ToolCallParams) => string | null;
}

/**
 * 工具调用错误码枚举
 */
export enum ToolCallErrorCode {
  INVALID_PARAMS = -32602,
  TOOL_NOT_FOUND = -32601,
  SERVICE_UNAVAILABLE = -32001,
  TIMEOUT = -32002,
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

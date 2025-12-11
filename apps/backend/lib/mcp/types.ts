/**
 * MCP 核心库类型定义
 * 统一管理所有 MCP 相关的类型定义，避免重复定义和导入路径混乱
 */

import type { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";
import type { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import type { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import type { Tool } from "@modelcontextprotocol/sdk/types.js";

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
  STREAMABLE_HTTP = "streamable-http",
}

// =========================
// 2. 配置接口类型
// =========================

/**
 * ModelScope SSE 自定义选项接口
 * 专门用于 ModelScope 相关的 SSE 配置
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
 * MCP 服务配置接口
 * 包含所有 MCP 服务的配置选项
 */
export interface MCPServiceConfig {
  name: string;
  type?: MCPTransportType; // 现在是可选的，支持自动推断
  // stdio 配置
  command?: string;
  args?: string[];
  env?: Record<string, string>; // 环境变量配置
  // 网络配置
  url?: string;
  // 认证配置
  apiKey?: string;
  headers?: Record<string, string>;
  // ModelScope 特有配置
  modelScopeAuth?: boolean;
  customSSEOptions?: ModelScopeSSEOptions;
  // 超时配置
  timeout?: number;
  // 重试配置
  retryAttempts?: number;
}

// =========================
// 3. 状态枚举类型
// =========================

/**
 * 连接状态枚举
 * 合并了 connection.ts 和 TransportAdapter.ts 中的定义
 */
export enum ConnectionState {
  DISCONNECTED = "disconnected",
  CONNECTING = "connecting",
  CONNECTED = "connected",
  RECONNECTING = "reconnecting",
  FAILED = "failed",
  ERROR = "error", // 从 TransportAdapter.ts 合并的额外状态
}

/**
 * MCP 服务状态接口
 * 描述 MCP 服务的运行时状态信息
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

/**
 * 工具调用结果接口
 * 统一了 connection.ts、manager.ts 和 CustomMCPHandler.ts 中的定义
 */
export interface ToolCallResult {
  content: Array<{
    type: string;
    text: string;
  }>;
  isError?: boolean;
}

/**
 * JSON Schema 类型定义
 * 兼容 MCP SDK 的 JSON Schema 格式，同时支持更宽松的对象格式以保持向后兼容
 */
export type JSONSchema =
  | (Record<string, unknown> & {
      type: "object";
      properties?: Record<string, unknown>;
      required?: string[];
      additionalProperties?: boolean;
    })
  | Record<string, unknown>; // 允许更宽松的格式以保持向后兼容

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
 * 如果不符合，会返回一个默认的空对象 schema
 */
export function ensureToolJSONSchema(schema: JSONSchema): {
  type: "object";
  properties?: Record<string, unknown>;
  required?: string[];
  additionalProperties?: boolean;
} {
  if (isValidToolJSONSchema(schema)) {
    return schema;
  }

  // 如果不符合标准格式，返回默认的空对象 schema
  return {
    type: "object",
    properties: {},
    required: [],
    additionalProperties: true,
  };
}

/**
 * CustomMCP 工具类型定义
 * 统一了 manager.ts 和 configManager.ts 中的定义
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
 * 用于缓存工具映射关系，保持向后兼容性
 */
export interface ToolInfo {
  serviceName: string;
  originalName: string;
  tool: Tool;
}

/**
 * MCP 工具项接口
 * 用于表示 getAllTools() 方法返回的工具对象
 */
export interface MCPToolItem {
  name: string;
  description: string;
  inputSchema: JSONSchema;
  serviceName: string;
  originalName: string;
}

// =========================
// 5. 服务器配置类型
// =========================

/**
 * 统一服务器配置接口
 * 从 UnifiedMCPServer 移入，用于统一服务器配置管理
 */
export interface UnifiedServerConfig {
  name?: string;
  enableLogging?: boolean;
  logLevel?: string;
  configs?: Record<string, MCPServiceConfig>; // MCPService 配置
}

/**
 * 统一服务器状态接口
 * 从 UnifiedMCPServer 移入，用于统一服务器状态管理
 */
export interface UnifiedServerStatus {
  isRunning: boolean;
  serviceStatus: ManagerStatus;
  transportCount: number;
  activeConnections: number;
  config: UnifiedServerConfig;
  // 添加对 serviceStatus 的便捷访问属性
  services?: Record<string, MCPServiceConnectionStatus>;
  totalTools?: number;
  availableTools?: string[];
}

// =========================
// 6. 管理器相关类型
// =========================

/**
 * MCP 服务连接状态接口
 * 重命名原 ServiceStatus 为 MCPServiceConnectionStatus 避免与 CLI 的 ServiceStatus 冲突
 */
export interface MCPServiceConnectionStatus {
  connected: boolean;
  clientName: string;
}

/**
 * 管理器状态接口
 * 描述 MCP 服务管理器的整体状态
 */
export interface ManagerStatus {
  services: Record<string, MCPServiceConnectionStatus>;
  totalTools: number;
  availableTools: string[];
}

// =========================
// 向后兼容性别名
// =========================

/**
 * 向后兼容：ServiceStatus 别名
 * 为了与现有代码保持兼容，暂时保留此别名
 * @deprecated 请使用 MCPServiceConnectionStatus
 */
export type ServiceStatus = MCPServiceConnectionStatus;

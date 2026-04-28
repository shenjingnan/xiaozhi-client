/**
 * Endpoint 包核心类型定义
 *
 * 定义小智接入点相关的所有核心类型，包括：
 * - 从 @/mcp-core re-export 的 MCP 核心类型（ConnectionState、EnhancedToolInfo 等）
 * - Endpoint 专属类型（连接状态、配置、Token 等）
 *
 * @module types
 */

import type {
  HTTPMCPServerConfig,
  LocalMCPServerConfig,
  MCPServerConfig,
  SSEMCPServerConfig,
} from "../types";

// 本地接口定义需要用到的类型（从 @/mcp-core 导入）
import type { EnhancedToolInfo } from "@/mcp-core";
import type { ConnectionState } from "@/mcp-core";

// 向后兼容：re-export MCP 服务配置类型
export type {
  HTTPMCPServerConfig,
  LocalMCPServerConfig,
  MCPServerConfig,
  SSEMCPServerConfig,
};

/** @deprecated 使用 HTTPMCPServerConfig 代替 */
export type StreamableHTTPMCPServerConfig = HTTPMCPServerConfig;

// =========================
// 从 @/mcp-core re-export 的 MCP 核心类型
// =========================

// 工具调用参数
export type { ToolCallParams, ValidatedToolCallParams } from "@/mcp-core";

// 工具调用错误
export { ToolCallErrorCode, ToolCallError } from "@/mcp-core";

// 增强的工具信息
export type { EnhancedToolInfo } from "@/mcp-core";

// 连接状态（mcp-core 版本包含完整的 6 个状态值）
export { ConnectionState } from "@/mcp-core";

// JSON Schema 类型和相关函数
import type { JSONSchema } from "@/mcp-core";
import { ensureToolJSONSchema } from "@/mcp-core";
export type { JSONSchema };
export { ensureToolJSONSchema };

/**
 * 工具调用结果接口
 *
 * 注意：此类型与 server/lib/mcp/types.ts 中的 ToolCallResult 保持一致。
 * 由于 lint 规则 useImportRestrictions 禁止跨模块导入，此处保留本地定义。
 * 任何修改都应同步更新 server/lib/mcp/types.ts 中的对应定义。
 */
export interface ToolCallResult {
  content: Array<{
    type: string;
    text?: string;
  }>;
  isError?: boolean;
  [key: string]: unknown;
}

// =========================
// Endpoint 专属类型
// =========================

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

/**
 * 连接选项接口
 */
export interface ConnectionOptions {
  /** 连接超时时间（毫秒），默认 10000 */
  connectionTimeout?: number;
  /** 重连延迟时间（毫秒），默认 2000 */
  reconnectDelay?: number;
}

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
// 新 API 配置类型
// =========================

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
// JWT Token 类型
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
 *   exp: 1800038535
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

/**
 * 前端API响应相关类型定义
 */

import type { MCPServerConfig } from "../config";

// 重新导出统一的错误码枚举
export { MCPErrorCode } from "../api/errors";

/**
 * MCP 服务添加请求接口（单服务格式）
 */
export interface MCPServerAddRequest {
  name: string;
  config: MCPServerConfig;
}

/**
 * MCP 服务批量添加请求接口（mcpServers 格式）
 */
export interface MCPServerBatchAddRequest {
  mcpServers: Record<string, MCPServerConfig>;
}

/**
 * MCP 服务添加操作结果
 */
export interface MCPServerAddResult {
  name: string;
  success: boolean;
  error?: string;
  config?: MCPServerConfig;
  tools?: string[];
  status?: string;
}

/**
 * MCP 服务批量添加响应
 */
export interface MCPServerBatchAddResponse {
  success: boolean;
  message: string;
  results: MCPServerAddResult[];
  addedCount: number;
  failedCount: number;
}

/**
 * MCP 服务状态接口
 */
export interface MCPServerStatus {
  name: string;
  status: "connected" | "disconnected" | "connecting" | "error";
  connected: boolean;
  tools: string[];
  lastUpdated?: string;
  config: MCPServerConfig;
}

/**
 * MCP 服务列表响应接口
 */
export interface MCPServerListResponse {
  servers: MCPServerStatus[];
  total: number;
}

/**
 * API 统一响应格式接口
 */
export interface ApiSuccessResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
}

export interface ApiErrorResponse {
  error: {
    code: string;
    message: string;
    details?: {
      serverName?: string;
      config?: any;
      tools?: string[];
      timestamp: string;
    };
  };
}

/**
 * 工具调用记录
 */
export interface ToolCallRecord {
  /** 工具名称 */
  toolName: string;
  /** 原始工具名称（如果有的话） */
  originalToolName?: string;
  /** 服务器名称 */
  serverName?: string;
  /** 调用参数 */
  arguments?: any;
  /** 调用结果 */
  result?: any;
  /** 是否成功 */
  success: boolean;
  /** 调用耗时（毫秒） */
  duration?: number;
  /** 错误信息 */
  error?: string;
  /** 时间戳 */
  timestamp?: number;
}

/**
 * 工具调用日志响应
 */
export interface ToolCallLogsResponse {
  /** 日志记录列表 */
  records: ToolCallRecord[];
  /** 总数量 */
  total: number;
  /** 是否有更多数据 */
  hasMore: boolean;
}

/**
 * API通用响应格式
 */
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
}

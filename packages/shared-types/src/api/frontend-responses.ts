/**
 * 前端 API 特定响应类型定义
 * 定义各种前端 API 方法的返回类型
 */

import type { ConnectionConfig } from "../config";
import type { CustomMCPToolWithStats } from "../mcp";

/**
 * 连接配置响应
 * GET /api/config/connection 的响应数据
 */
export interface ConnectionConfigResponse {
  /** 连接配置 */
  connection: ConnectionConfig;
}

/**
 * 更新版本响应
 * POST /api/update 的响应数据
 */
export interface UpdateVersionResponse {
  /** 目标版本 */
  version: string;
  /** 响应消息 */
  message: string;
}

/**
 * 工具调用响应
 * POST /api/tools/call 的响应数据
 */
export interface CallToolResponse {
  /** 工具执行结果 */
  result?: unknown;
  /** 是否成功 */
  success: boolean;
  /** 错误信息（如果失败） */
  error?: string;
}

/**
 * 自定义工具响应
 * POST /api/tools/custom 的响应数据
 */
export interface CustomToolResponse {
  /** 添加/更新的工具 */
  tool: CustomMCPToolWithStats;
}

/**
 * 自定义工具列表响应
 * GET /api/tools/custom 的响应数据
 */
export interface CustomToolsListResponse {
  /** 自定义工具列表 */
  tools: CustomMCPToolWithStats[];
}

/**
 * 扣子 API 相关类型定义
 */

/**
 * 扣子 API 响应详情
 */
export interface CozeApiDetail {
  /** 日志ID */
  logid: string;
}

/**
 * 扣子 API 基础响应接口
 */
export interface CozeApiResponse<T = unknown> {
  /** 响应状态码，0表示成功 */
  code: number;
  /** 响应数据 */
  data: T;
  /** 响应消息 */
  msg: string;
  /** 响应详情 */
  detail: CozeApiDetail;
}

/**
 * 获取工作空间列表的完整响应
 */
export interface CozeWorkspacesResponse
  extends CozeApiResponse<CozeWorkspacesData> {}

/**
 * 获取工作流列表的完整响应
 */
export interface CozeWorkflowsResponse
  extends CozeApiResponse<CozeWorkflowsData> {}

/**
 * 缓存项接口
 */
export interface CacheItem<T = unknown> {
  /** 缓存数据 */
  data: T;
  /** 缓存时间戳 */
  timestamp: number;
  /** 缓存过期时间（毫秒） */
  ttl: number;
}

import type { CozeWorkflowsData, CozeWorkflowsParams } from "./workflow";
// 导入其他类型，避免循环依赖
import type { CozeWorkspacesData } from "./workspace";

// 重新导出这些类型，便于外部使用
export type { CozeWorkspacesData, CozeWorkflowsParams, CozeWorkflowsData };

// 从共享类型重新导出 CozeApiError，避免重复定义
export type { CozeApiError } from "../api/errors";

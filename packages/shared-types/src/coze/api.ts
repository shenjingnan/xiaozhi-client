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
export interface CozeApiResponse<T = any> {
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
export interface CozeWorkspacesResponse extends CozeApiResponse<CozeWorkspacesData> {}

/**
 * 获取工作流列表的完整响应
 */
export interface CozeWorkflowsResponse extends CozeApiResponse<CozeWorkflowsData> {}

/**
 * 扣子 API 错误响应
 */
export interface CozeApiError extends Error {
  /** 错误代码 */
  code: string;
  /** HTTP 状态码 */
  statusCode?: number;
  /** 原始响应数据 */
  response?: any;
}

/**
 * 缓存项接口
 */
export interface CacheItem<T = any> {
  /** 缓存数据 */
  data: T;
  /** 缓存时间戳 */
  timestamp: number;
  /** 缓存过期时间（毫秒） */
  ttl: number;
}

// 导入其他类型，避免循环依赖
import type { CozeWorkspacesData } from './workspace'
import type { CozeWorkflowsParams, CozeWorkflowsData } from './workflow'

// 重新导出这些类型，便于外部使用
export type { CozeWorkspacesData, CozeWorkflowsParams, CozeWorkflowsData }
/**
 * 扣子 API 相关类型定义
 * 基于 docs/coze-api.md 中的 API 文档
 */

/**
 * 扣子工作空间接口
 */
export interface CozeWorkspace {
  /** 工作空间ID */
  id: string;
  /** 工作空间名称 */
  name: string;
  /** 工作空间描述 */
  description: string;
  /** 工作空间类型 */
  workspace_type: "personal" | "team";
  /** 企业ID */
  enterprise_id: string;
  /** 管理员用户ID列表 */
  admin_uids: string[];
  /** 工作空间图标URL */
  icon_url: string;
  /** 用户在工作空间中的角色类型 */
  role_type: "owner" | "admin" | "member";
  /** 加入状态 */
  joined_status: "joined" | "pending" | "rejected";
  /** 所有者用户ID */
  owner_uid: string;
}

/**
 * 扣子工作流创建者信息
 */
export interface CozeWorkflowCreator {
  /** 创建者ID */
  id: string;
  /** 创建者名称 */
  name: string;
}

/**
 * 扣子工作流接口
 */
export interface CozeWorkflow {
  /** 工作流ID */
  workflow_id: string;
  /** 工作流名称 */
  workflow_name: string;
  /** 工作流描述 */
  description: string;
  /** 工作流图标URL */
  icon_url: string;
  /** 关联应用ID */
  app_id: string;
  /** 创建者信息 */
  creator: CozeWorkflowCreator;
  /** 创建时间戳 */
  created_at: number;
  /** 更新时间戳 */
  updated_at: number;
}

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
 * 获取工作空间列表的响应数据
 */
export interface CozeWorkspacesData {
  /** 工作空间总数 */
  total_count: number;
  /** 工作空间列表 */
  workspaces: CozeWorkspace[];
}

/**
 * 获取工作空间列表的完整响应
 */
export interface CozeWorkspacesResponse
  extends CozeApiResponse<CozeWorkspacesData> {}

/**
 * 获取工作流列表的响应数据
 */
export interface CozeWorkflowsData {
  /** 是否有更多数据 */
  has_more: boolean;
  /** 工作流列表 */
  items: CozeWorkflow[];
}

/**
 * 获取工作流列表的完整响应
 */
export interface CozeWorkflowsResponse
  extends CozeApiResponse<CozeWorkflowsData> {}

/**
 * 获取工作流列表的请求参数
 */
export interface CozeWorkflowsParams {
  /** 工作空间ID */
  workspace_id: string;
  /** 页码，从1开始 */
  page_num?: number;
  /** 每页数量，默认20 */
  page_size?: number;
  /** 工作流模式，默认为 workflow */
  workflow_mode?: "workflow";
}

// 从共享类型重新导出 CozeApiError，避免重复定义
export type { CozeApiError } from "@xiaozhi-client/shared-types";

/**
 * 扣子平台配置接口
 */
export interface CozePlatformConfig {
  /** 扣子 API Token */
  token: string;
}

/**
 * 扣子 API 服务配置
 */
export interface CozeApiServiceConfig {
  /** API Token */
  token: string;
  /** API 基础URL，默认 https://api.coze.cn */
  apiBaseUrl?: string;
  /** 请求超时时间，默认 10000ms */
  timeout?: number;
  /** 重试次数，默认 3 次 */
  retryAttempts?: number;
  /** 是否启用缓存，默认 true */
  cacheEnabled?: boolean;
}

// ==================== 工作流参数配置相关类型 ====================

/**
 * 工作流参数定义
 */
export interface WorkflowParameter {
  /** 英文字段名，用作参数标识符 */
  fieldName: string;
  /** 中英文描述，说明参数用途 */
  description: string;
  /** 参数类型 */
  type: "string" | "number" | "boolean";
  /** 是否必填参数 */
  required: boolean;
}

/**
 * 工作流参数配置
 */
export interface WorkflowParameterConfig {
  /** 参数列表 */
  parameters: WorkflowParameter[];
}

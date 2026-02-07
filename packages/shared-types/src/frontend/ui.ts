/**
 * 前端UI状态相关类型定义
 */

import type { CozeWorkflow } from "../coze";

/**
 * 扣子工作流列表响应
 */
export interface CozeWorkflowsResult {
  /** 工作流列表 */
  items: CozeWorkflow[];
  /** 是否有更多数据 */
  hasMore: boolean;
}

/**
 * 前端UI状态类型
 */
export interface CozeUIState {
  /** 当前选中的工作空间ID */
  selectedWorkspaceId: string | null;
  /** 工作空间列表加载状态 */
  workspacesLoading: boolean;
  /** 工作流列表加载状态 */
  workflowsLoading: boolean;
  /** 工作空间列表错误信息 */
  workspacesError: string | null;
  /** 工作流列表错误信息 */
  workflowsError: string | null;
}

/**
 * 客户端状态（从 config/server 重新导出）
 */
export type { ClientStatus } from "../config/server";

/**
 * 扣子工作流相关类型定义
 */

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
  /** 是否已添加为工具（前端运行时属性） */
  isAddedAsTool?: boolean;
  /** 输入参数Schema（前端运行时属性） */
  inputSchema?: any;
  /** 工具名称（前端运行时属性） */
  toolName?: string | null;
}

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
/**
 * 扣子工作空间相关类型定义
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
 * 获取工作空间列表的响应数据
 */
export interface CozeWorkspacesData {
  /** 工作空间总数 */
  total_count: number;
  /** 工作空间列表 */
  workspaces: CozeWorkspace[];
}
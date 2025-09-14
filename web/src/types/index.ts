export interface LocalMCPServerConfig {
  command: string;
  args: string[];
  env?: Record<string, string>;
}

export interface SSEMCPServerConfig {
  type: "sse";
  url: string;
}

export interface StreamableHTTPMCPServerConfig {
  type?: "streamable-http"; // 可选，因为默认就是 streamable-http
  url: string;
}

export type MCPServerConfig =
  | LocalMCPServerConfig
  | SSEMCPServerConfig
  | StreamableHTTPMCPServerConfig;

export interface MCPToolConfig {
  description?: string;
  enable: boolean;
  usageCount?: number;
  lastUsedTime?: string;
}

export interface MCPServerToolsConfig {
  tools: Record<string, MCPToolConfig>;
}

export interface ConnectionConfig {
  heartbeatInterval?: number;
  heartbeatTimeout?: number;
  reconnectInterval?: number;
}

export interface ModelScopeConfig {
  apiKey?: string;
}

export interface WebUIConfig {
  port?: number;
  autoRestart?: boolean;
}

export interface PlatformsConfig {
  [platformName: string]: PlatformConfig;
}

export interface PlatformConfig {
  token?: string;
}

export interface AppConfig {
  mcpEndpoint: string | string[];
  mcpServers: Record<string, MCPServerConfig>;
  mcpServerConfig?: Record<string, MCPServerToolsConfig>;
  connection?: ConnectionConfig;
  modelscope?: ModelScopeConfig;
  webUI?: WebUIConfig;
  platforms?: PlatformsConfig;
}

export interface ClientStatus {
  status: "connected" | "disconnected";
  mcpEndpoint: string;
  activeMCPServers: string[];
  lastHeartbeat?: number;
}

// ==================== 扣子平台相关类型 ====================

/**
 * 扣子工作空间
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
  admin_UIDs: string[];
  /** 工作空间图标URL */
  icon_url: string;
  /** 用户在工作空间中的角色 */
  role_type: "owner" | "admin" | "member";
  /** 加入状态 */
  joined_status: "joined" | "pending" | "rejected";
  /** 拥有者用户ID */
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
 * 扣子工作流
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
  /** 关联的应用ID */
  app_id: string;
  /** 创建者信息 */
  creator: CozeWorkflowCreator;
  /** 创建时间（Unix时间戳） */
  created_at: number;
  /** 更新时间（Unix时间戳） */
  updated_at: number;
  /** 是否已添加为MCP工具 */
  isAddedAsTool: boolean;
  /** 如果已添加为工具，对应的工具名称 */
  toolName: string | null;
  inputSchema?: any;
}

/**
 * 扣子工作流查询参数
 */
export interface CozeWorkflowsParams {
  /** 工作空间ID（必需） */
  workspace_id: string;
  /** 页码，从1开始 */
  page_num?: number;
  /** 每页数量，默认20 */
  page_size?: number;
}

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

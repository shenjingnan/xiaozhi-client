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

// ==================== MCP 服务器管理 API 相关类型 ====================

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
 * API 错误码枚举
 */
export enum MCPErrorCode {
  // 服务相关错误
  SERVER_NOT_FOUND = "SERVER_NOT_FOUND",
  SERVER_ALREADY_EXISTS = "SERVER_ALREADY_EXISTS",
  INVALID_SERVICE_NAME = "INVALID_SERVICE_NAME",

  // 配置相关错误
  INVALID_CONFIG = "INVALID_CONFIG",
  CONFIG_UPDATE_FAILED = "CONFIG_UPDATE_FAILED",

  // 连接相关错误
  CONNECTION_FAILED = "CONNECTION_FAILED",

  // 操作相关错误
  ADD_FAILED = "ADD_FAILED",
  REMOVE_FAILED = "REMOVE_FAILED",

  // 系统错误
  INTERNAL_ERROR = "INTERNAL_ERROR",
  VALIDATION_ERROR = "VALIDATION_ERROR",
}

// ==================== 工具调用日志相关类型 ====================

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

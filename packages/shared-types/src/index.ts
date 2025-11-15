/**
 * 小智项目共享类型定义主入口
 */

// 扣子平台相关类型
export type { CozeWorkspace } from './coze/workspace'
export type { CozeApiResponse } from './coze/api'
export type { CozeWorkflow, CozeWorkflowCreator, WorkflowParameter, WorkflowParameterConfig, CozeWorkflowsParams } from './coze/workflow'

// MCP 相关类型
export type { ExtendedMCPToolsCache, EnhancedToolResultCache } from './mcp/cache'
export type { TaskStatus } from './mcp/task'
export type { MCPMessage, MCPResponse, MCPError } from './mcp/message'

// 工具API相关类型
export type { ToolType, MCPToolData } from './api/toolApi'

// 配置相关类型
export type {
  LocalMCPServerConfig,
  MCPToolConfig,
  MCPServerToolsConfig,
  ConnectionConfig,
  AppConfig,
  ModelScopeConfig,
  WebUIConfig,
  PlatformsConfig,
  PlatformConfig,
  MCPServerConfig,
  SSEMCPServerConfig,
  StreamableHTTPMCPServerConfig
} from './config/app'

// 前端相关类型
export * from './frontend'

// 工具类型
export { TimeoutError } from './utils/timeout'
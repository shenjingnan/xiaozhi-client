/**
 * 小智项目共享类型定义主入口
 */

// 扣子平台相关类型
export type {
  CozeWorkspace,
  CozeWorkspacesData,
  CozeApiResponse,
  CozeWorkspacesResponse,
  CozeWorkflowsResponse,
  CozeWorkflow,
  CozeWorkflowCreator,
  WorkflowParameter,
  WorkflowParameterConfig,
  CozeWorkflowsParams,
  CozeWorkflowsData,
  CozeApiError,
  CozePlatformConfig,
  CozeApiServiceConfig,
} from "./coze";

// MCP 相关类型
export type {
  ExtendedMCPToolsCache,
  EnhancedToolResultCache,
  TaskStatus,
  MCPMessage,
  MCPResponse,
  MCPError,
  CustomMCPTool,
  CustomMCPToolWithStats,
  CustomMCPToolConfig,
  JSONSchema,
} from "./mcp";

// 工具API相关类型
export type { ToolType, MCPToolData } from "./api";

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
  StreamableHTTPMCPServerConfig,
  ASRConfig,
  TTSConfig,
  LLMConfig,
} from "./config";

// 前端相关类型
export * from "./frontend";

// 工具类型
export { TimeoutError } from "./utils";

// TTS 相关类型
export type { VoiceInfo, VoicesResponse } from "./tts";

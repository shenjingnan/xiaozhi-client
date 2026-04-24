/**
 * 小智项目共享类型定义主入口
 */

// 扣子平台相关类型
export type {
  CozeWorkspace,
  CozeApiResponse,
  CozeWorkflow,
  CozeWorkflowCreator,
  WorkflowParameter,
  WorkflowParameterConfig,
  CozeWorkflowsParams,
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
  // MCP 服务配置
  HTTPMCPServerConfig,
  LocalMCPServerConfig,
  MCPServerConfig,
  MCPServerToolsConfig,
  MCPToolConfig,
  SSEMCPServerConfig,
  // 向后兼容别名
  StreamableHTTPMCPServerConfig,
  // 应用主配置
  AppConfig,
  ConnectionConfig,
  // 子系统配置
  ASRConfig,
  CozePlatformConfig,
  LLMConfig,
  ModelScopeConfig,
  PlatformConfig,
  PlatformsConfig,
  ToolCallLogConfig,
  TTSConfig,
  WebUIConfig,
} from "./config";

// 前端相关类型
export * from "./frontend";

// 工具类型
export { TimeoutError } from "./utils";

// TTS 相关类型
export type { VoiceInfo, VoicesResponse } from "./tts";

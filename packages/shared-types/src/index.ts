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
  ToolHandlerConfig,
  MCPHandlerConfig,
  ProxyHandlerConfig,
  HttpHandlerConfig,
  FunctionHandlerConfig,
} from "./mcp";

// 工具API相关类型
export type {
  MCPToolData,
  CozeWorkflowData,
  HttpApiToolData,
  FunctionToolData,
  AddCustomToolRequest,
  ToolValidationErrorDetail,
  AddToolResponse,
  ToolMetadata,
  ToolConfigOptions,
  ExtendedCustomMCPTool,
} from "./api";

// 导出枚举（同时作为类型和值）
// 从 toolApi 直接导入，避免通过 api 中转造成的命名冲突
export { ToolType, ToolValidationError } from "./api/toolApi";

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

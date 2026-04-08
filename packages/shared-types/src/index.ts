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
  AddToolResponse,
  ToolMetadata,
  ToolConfigOptions,
  ExtendedCustomMCPTool,
  ToolValidationErrorDetail,
} from "./api";

export {
  ToolType,
} from "./api";

// 导出 ToolValidationError（从 api 导入时名称为 ApiToolValidationError）
import { ApiToolValidationError } from "./api";
export { ApiToolValidationError as ToolValidationError };

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

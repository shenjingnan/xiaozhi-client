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

// MCP 相关类型 - 包括工具处理器配置和 CustomMCP 工具类型
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

// 工具API相关类型 - 导出所有类型以消除跨包重复定义
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
  // 注意：ToolValidationError 在 api/index.ts 中被重命名为 ApiToolValidationError
  // 如果需要原始名称，可以使用 ApiToolValidationError 并重命名
} from "./api";

// 导出 ToolValidationError 作为别名（向后兼容）
export { ApiToolValidationError as ToolValidationError } from "./api";

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

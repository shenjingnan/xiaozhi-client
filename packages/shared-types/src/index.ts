/**
 * @xiaozhi-client/shared-types
 *
 * 小智项目的共享类型定义包，公开发布到 npm
 *
 * 此包提供项目中所有模块共享的类型定义，包括：
 *
 * - **Coze 平台类型**: 扣子平台相关类型，包括工作流、参数配置等
 * - **MCP 相关类型**: MCP 协议相关类型，包括工具定义、消息格式、缓存等
 * - **API 类型**: 工具 API 相关类型定义
 * - **配置类型**: 各种服务配置类型，包括连接、服务器、平台等配置
 * - **前端类型**: 前端专用类型定义
 * - **工具类型**: 通用工具类和函数，如 TimeoutError 等
 *
 * @example
 * ### 使用配置类型
 * ```typescript
 * import type { AppConfig, MCPServerConfig } from '@xiaozhi-client/shared-types';
 *
 * const config: AppConfig = {
 *   mcpEndpoint: 'wss://api.example.com/mcp',
 *   mcpServers: {
 *     'calculator': {
 *       type: 'stdio',
 *       command: 'node',
 *       args: ['calculator.js']
 *     }
 *   }
 * };
 * ```
 *
 * @example
 * ### 使用 MCP 工具类型
 * ```typescript
 * import type { CustomMCPTool, JSONSchema } from '@xiaozhi-client/shared-types';
 *
 * const tool: CustomMCPTool = {
 *   name: 'my_tool',
 *   description: '我的工具',
 *   inputSchema: {
 *     type: 'object',
 *     properties: {
 *       param1: { type: 'string', description: '参数1' }
 *     }
 *   }
 * };
 * ```
 *
 * @example
 * ### 使用 Coze 平台类型
 * ```typescript
 * import type { CozeWorkflow, WorkflowParameter } from '@xiaozhi-client/shared-types';
 *
 * const workflow: CozeWorkflow = {
 *   workflow_id: 'workflow_123',
 *   name: '我的工作流',
 *   description: '工作流描述',
 *   parameters: [
 *     {
 *       name: 'input',
 *       type: 'string',
 *       required: true,
 *       description: '输入参数'
 *     } as WorkflowParameter
 *   ]
 * };
 * ```
 *
 * @packageDocumentation
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

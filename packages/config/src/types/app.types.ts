/**
 * 核心应用配置类型定义
 *
 * 包含 AppConfig 核心配置类型和 WebServerInstance 接口
 */

import type { ConnectionConfig } from "./connection.types.js";
import type { CustomMCPConfig } from "./custom-mcp.types.js";
import type { MCPServerConfig, MCPServerToolsConfig } from "./mcp.types.js";
import type {
  ASRConfig,
  LLMConfig,
  ModelScopeConfig,
  PlatformsConfig,
  TTSConfig,
  ToolCallLogConfig,
  WebUIConfig,
} from "./platform.types.js";

/**
 * Web 服务器实例接口（用于配置更新通知）
 */
export interface WebServerInstance {
  broadcastConfigUpdate(config: AppConfig): void;
}

/**
 * 应用配置
 */
export interface AppConfig {
  mcpEndpoint: string | string[];
  mcpServers: Record<string, MCPServerConfig>;
  mcpServerConfig?: Record<string, MCPServerToolsConfig>;
  customMCP?: CustomMCPConfig; // 新增 customMCP 配置支持
  connection?: ConnectionConfig; // 连接配置（可选，用于向后兼容）
  modelscope?: ModelScopeConfig; // ModelScope 配置（可选）
  webUI?: WebUIConfig; // Web UI 配置（可选）
  platforms?: PlatformsConfig; // 平台配置（可选）
  toolCallLog?: ToolCallLogConfig; // 工具调用日志配置（可选）
  tts?: TTSConfig; // TTS 配置（可选）
  asr?: ASRConfig; // ASR 配置（可选）
  llm?: LLMConfig; // LLM 配置（可选）
}

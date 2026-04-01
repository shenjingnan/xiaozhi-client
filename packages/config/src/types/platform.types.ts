/**
 * 平台配置相关类型定义
 *
 * 包含 ModelScope、WebUI、TTS、ASR、LLM、平台等配置类型
 */

/**
 * ModelScope 配置
 */
export interface ModelScopeConfig {
  apiKey?: string; // ModelScope API 密钥
}

/**
 * Web UI 配置
 */
export interface WebUIConfig {
  port?: number; // Web UI 端口号，默认 9999
  autoRestart?: boolean; // 是否在配置更新后自动重启服务，默认 true
}

/**
 * TTS 配置接口
 */
export interface TTSConfig {
  appid?: string; // 应用 ID
  accessToken?: string; // 访问令牌
  voice_type?: string; // 声音类型
  encoding?: string; // 编码格式（默认 wav）
  cluster?: string; // 集群类型
  endpoint?: string; // WebSocket 端点
}

/**
 * ASR 配置接口
 */
export interface ASRConfig {
  appid?: string; // 应用 ID
  accessToken?: string; // 访问令牌
  cluster?: string; // 集群类型（默认：volcengine_streaming_common）
  wsUrl?: string; // WebSocket 端点
}

/**
 * LLM 配置接口
 */
export interface LLMConfig {
  model: string; // 模型名称
  apiKey: string; // API 密钥
  baseURL: string; // API 基础地址
  prompt?: string; // 自定义系统提示词（支持纯字符串或文件路径）
}

/**
 * 工具调用日志配置接口
 */
export interface ToolCallLogConfig {
  maxRecords?: number; // 最大记录条数，默认 100
  logFilePath?: string; // 自定义日志文件路径（可选）
}

/**
 * 平台配置
 */
export interface PlatformConfig {
  token?: string;
}

/**
 * 平台配置集合
 */
export interface PlatformsConfig {
  [platformName: string]: PlatformConfig;
}

/**
 * 扣子平台配置接口
 */
export interface CozePlatformConfig extends PlatformConfig {
  /** 扣子 API Token */
  token: string;
}

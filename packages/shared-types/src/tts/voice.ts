/**
 * TTS 音色相关类型定义
 */

/**
 * 音色信息
 */
export interface VoiceInfo {
  /** 音色名称（如：Vivi 2.0） */
  name: string;
  /** 技术标识符 */
  voiceType: string;
  /** 场景分类 */
  scene: string;
  /** 语种 */
  language: string;
  /** 支持能力 */
  capabilities: string[];
  /** 模型版本 */
  modelVersion: string;
}

/**
 * 音色列表 API 响应
 */
export interface VoicesResponse {
  /** 音色列表 */
  voices: VoiceInfo[];
  /** 总数 */
  total: number;
  /** 场景列表 */
  scenes: string[];
}
/**
 * ByteDance V2 请求配置类型定义
 */

import type { AudioFormat } from "@/audio";
import type {
  ByteDanceV2App,
  ByteDanceV2Audio,
  ByteDanceV2Request as ByteDanceV2RequestSchemaType,
  ByteDanceV2User,
} from "./schemas/index.js";

/**
 * ByteDance V2 完整请求配置
 * 包含 app、user、request、audio 四个部分
 */
export interface ByteDanceV2ASRRequest {
  /** 应用配置 */
  app: ByteDanceV2App;
  /** 用户配置 */
  user: ByteDanceV2User;
  /** 请求参数 */
  request: ByteDanceV2RequestSchemaType;
  /** 音频配置 */
  audio: ByteDanceV2Audio;
}

/**
 * ByteDance V2 请求构造器配置
 */
export interface ByteDanceV2RequestBuilderConfig {
  /** 应用 ID */
  appid: string;
  /** 集群 */
  cluster: string;
  /** 应用密钥 */
  token: string;
  /** 用户 ID */
  uid: string;
  /** 音频格式 */
  format: AudioFormat;
  /** 采样率 */
  sampleRate: number;
  /** 语言 */
  language: string;
  /** 位深 */
  bits: number;
  /** 声道数 */
  channel: number;
  /** 编解码器 */
  codec: string;
  /** N-best 数量 */
  nbest: number;
  /** 工作流 */
  workflow: string;
  /** 显示语言 */
  showLanguage: boolean;
  /** 显示分句 */
  showUtterances: boolean;
  /** 结果类型 */
  resultType: string;
}

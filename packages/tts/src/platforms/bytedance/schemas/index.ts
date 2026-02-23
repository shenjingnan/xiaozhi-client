/**
 * 字节跳动 TTS 配置校验 Schema
 */

import { z } from "zod";

/**
 * 字节跳动 TTS 应用配置 Schema
 */
export const ByteDanceTTSAppSchema = z.object({
  /** 应用 ID */
  appid: z.string().min(1, "appid 不能为空"),
  /** 访问令牌 */
  accessToken: z.string().min(1, "accessToken 不能为空"),
});

/**
 * 字节跳动 TTS 音频配置 Schema
 */
export const ByteDanceTTSAudioSchema = z.object({
  /** 声音类型 */
  voice_type: z.string().min(1, "voice_type 不能为空"),
  /** 编码格式 */
  encoding: z.string().optional().default("wav"),
  /** 语速 */
  speed: z.number().optional(),
  /** 音调 */
  pitch: z.number().optional(),
  /** 音量 */
  volume: z.number().optional(),
});

/**
 * 字节跳动 TTS 配置 Schema
 */
export const ByteDanceTTSConfigSchema = z.object({
  /** 应用配置 */
  app: ByteDanceTTSAppSchema,
  /** 音频配置 */
  audio: ByteDanceTTSAudioSchema,
  /** 集群类型 */
  cluster: z.string().optional(),
  /** 自定义端点 */
  endpoint: z.string().optional(),
});

/**
 * 字节跳动 TTS 配置类型
 */
export type ByteDanceTTSConfig = z.infer<typeof ByteDanceTTSConfigSchema>;

/**
 * 字节跳动 TTS 应用类型
 */
export type ByteDanceTTSApp = z.infer<typeof ByteDanceTTSAppSchema>;

/**
 * 字节跳动 TTS 音频类型
 */
export type ByteDanceTTSAudio = z.infer<typeof ByteDanceTTSAudioSchema>;

/**
 * 校验并返回 TTS 配置
 * @param config - 用户配置
 * @returns 校验后的配置
 */
export function validateByteDanceTTSConfig(
  config: unknown
): ByteDanceTTSConfig {
  return ByteDanceTTSConfigSchema.parse(config);
}

/**
 * 默认 TTS 端点
 */
export const DEFAULT_TTS_ENDPOINT =
  "wss://openspeech.bytedance.com/api/v1/tts/ws_binary";

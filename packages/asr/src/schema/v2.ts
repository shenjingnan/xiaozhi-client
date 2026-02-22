/**
 * ByteDance V2 流式语音识别配置 Schema
 */

import { z } from "zod";

/**
 * V2 用户配置
 */
export const ByteDanceV2UserSchema = z.object({
  uid: z.string().optional().describe("用户标识，建议采用 IMEI 或 MAC"),
});

export type ByteDanceV2User = z.infer<typeof ByteDanceV2UserSchema>;

/**
 * V2 音频配置
 */
export const ByteDanceV2AudioSchema = z.object({
  format: z.string().optional().describe("音频容器格式：raw / wav / mp3 / ogg"),
  rate: z.number().optional().describe("音频采样率，默认为 16000"),
  language: z.string().optional().describe("指定可识别的语言"),
  bits: z.number().optional().describe("音频采样点位数，默认为 16"),
  channel: z
    .number()
    .optional()
    .describe("音频声道数：1(mono) / 2(stereo)，默认为1"),
  codec: z
    .string()
    .optional()
    .describe("音频编码格式：raw / opus，默认为 raw(pcm)"),
});

export type ByteDanceV2Audio = z.infer<typeof ByteDanceV2AudioSchema>;

/**
 * V2 请求配置
 */
export const ByteDanceV2RequestSchema = z.object({
  reqid: z
    .string()
    .optional()
    .describe("请求标识，每个请求唯一标识，建议使用 UUID"),
  nbest: z.number().optional().describe("识别结果候选数目，默认为 1"),
  workflow: z
    .string()
    .optional()
    .describe(
      "自定义工作流，默认值：audio_in,resample,partition,vad,fe,decode"
    ),
  show_language: z.boolean().optional().describe("输出语言信息"),
  show_utterances: z
    .boolean()
    .optional()
    .describe("输出语音停顿、分句、分词信息"),
  result_type: z
    .string()
    .optional()
    .describe("返回结果类型，默认每次返回所有分句结果"),
  sequence: z
    .number()
    .optional()
    .describe(
      "请求序号。对于同一个请求的多个包序号，从 1 递增，最后一包取相反数"
    ),
  vad_signal: z.boolean().optional().describe("开启 vad 检测"),
  start_silence_time: z
    .string()
    .optional()
    .describe("首部静音，设置范围在1000-60000(单位为毫秒)之间"),
  vad_silence_time: z
    .string()
    .optional()
    .describe("尾部静音，设置范围在500ms-6000ms之间"),
});

export type ByteDanceV2Request = z.infer<typeof ByteDanceV2RequestSchema>;

/**
 * V2 应用配置
 */
export const ByteDanceV2AppSchema = z.object({
  appid: z.string().min(1, "appid 不能为空").describe("应用标识"),
  token: z.string().min(1, "token 不能为空").describe("应用令牌，控制访问权限"),
  cluster: z
    .string()
    .optional()
    .describe(
      "业务集群。根据场景，选择需要访问的集群。在控制台创建应用并开通流式语音识别服务后，显示的 Cluster ID 字段"
    ),
});

export type ByteDanceV2App = z.infer<typeof ByteDanceV2AppSchema>;

/**
 * V2 完整配置 Schema
 */
export const ByteDanceV2ConfigSchema = ByteDanceV2AppSchema.extend({
  uid: z.string().optional().describe("用户标识，建议采用 IMEI 或 MAC"),
  user: ByteDanceV2UserSchema.optional(),
  audio: ByteDanceV2AudioSchema.optional(),
  request: ByteDanceV2RequestSchema.optional(),
});

export type ByteDanceV2Config = z.infer<typeof ByteDanceV2ConfigSchema>;

/**
 * V2 默认 cluster
 */
export const BYTEDANCE_V2_DEFAULT_CLUSTER = "volcengine_streaming_common";

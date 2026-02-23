/**
 * ByteDance V2 流式语音识别配置 Schema
 */

import { z } from "zod";

/**
 * V2 应用配置
 */
export const ByteDanceV2AppSchema = z.object({
  appid: z.string().min(1, "appid 不能为空").describe("应用标识"),
  token: z.string().min(1, "token 不能为空").describe("应用令牌，控制访问权限"),
  cluster: z
    .string()
    .min(1, "cluster 不能为空")
    .describe(
      "业务集群。根据场景，选择需要访问的集群。在控制台创建应用并开通流式语音识别服务后，显示的 Cluster ID 字段"
    ),
});

export type ByteDanceV2App = z.infer<typeof ByteDanceV2AppSchema>;

/**
 * V2 用户配置
 */
export const ByteDanceV2UserSchema = z.object({
  uid: z
    .string()
    .min(1, "uid 不能为空")
    .describe("用户标识，建议采用 IMEI 或 MAC"),
  device: z.string().optional().describe("设备名称"),
  platform: z
    .string()
    .optional()
    .describe("操作系统及API版本号，如 iOS/Android/Linux"),
  network: z.string().optional().describe("用户网络，如 2G / 3G / 4G / WiFi"),
  nation: z.string().optional().describe("国家"),
  province: z.string().optional().describe("省份"),
  city: z.string().optional().describe("城市"),
});

export type ByteDanceV2User = z.infer<typeof ByteDanceV2UserSchema>;

/**
 * V2 音频配置
 */
export const ByteDanceV2AudioSchema = z.object({
  format: z
    .string()
    .min(1, "format 不能为空")
    .describe("音频容器格式：raw / wav / mp3 / ogg"),
  codec: z
    .string()
    .optional()
    .default("raw")
    .describe("音频编码格式：raw / opus，默认为 raw(pcm)"),
  rate: z
    .number()
    .int()
    .optional()
    .default(16000)
    .describe("音频采样率，默认为 16000"),
  bits: z
    .number()
    .int()
    .optional()
    .default(16)
    .describe("音频采样点位数，默认为 16"),
  channel: z
    .number()
    .int()
    .optional()
    .default(1)
    .describe("音频声道数：1(mono) / 2(stereo)，默认为1"),
});

export type ByteDanceV2Audio = z.infer<typeof ByteDanceV2AudioSchema>;

/**
 * V2 请求配置
 */
export const ByteDanceV2RequestSchema = z.object({
  reqid: z
    .string()
    .min(1, "reqid 不能为空")
    .describe("请求标识，每个请求唯一标识，建议使用 UUID"),
  sequence: z
    .number()
    .int()
    .min(1, "sequence 不能为空")
    .describe(
      "请求序号。对于同一个请求的多个包序号，从 1 递增，最后一包取相反数。如 1,2,3,-4"
    ),
  nbest: z
    .number()
    .int()
    .optional()
    .default(1)
    .describe("识别结果候选数目，默认为 1"),
  confidence: z
    .number()
    .int()
    .optional()
    .default(0)
    .describe("识别结果置信度下限，默认为0，保留字段"),
  workflow: z
    .string()
    .optional()
    .describe("自定义工作流，如 audio_in,resample,partition,vad,fe,decode"),
  show_utterance: z
    .boolean()
    .optional()
    .describe(
      "输出语音停顿、分句、分词信息。默认每次返回所有分句结果。如果想每次只返回当前分句结果，则设置 show_utterances=true 和 result_type=single；如果当前分句结果是中间结果则返回的 definite=false，如果是分句最终结果则返回的 definite=true"
    ),
  result_type: z.string().optional().describe("返回结果类型"),
  boosting_table_name: z
    .string()
    .optional()
    .describe("自学习平台上设置的热词词表名称，热词功能和设置方法可以参考文档"),
  correct_table_name: z
    .string()
    .optional()
    .describe(
      "自学习平台上设置的替换词词表名称，替换词功能和设置方法可以参考文档"
    ),
  vad_signal: z.boolean().optional().describe("开启 vad 检测"),
  start_silence_time: z
    .string()
    .optional()
    .describe(
      "首部静音，设置范围在1000-60000[单位为毫秒]之间，推荐常用值5000ms到10000ms"
    ),
  vad_silence_time: z
    .string()
    .optional()
    .describe("尾部静音，设置范围在500ms-6000ms之间，推荐常用值800ms或1000ms"),
});

export type ByteDanceV2Request = z.infer<typeof ByteDanceV2RequestSchema>;

/**
 * V2 完整配置 Schema
 */
export const ByteDanceV2ConfigSchema = z.object({
  app: ByteDanceV2AppSchema.describe("应用相关配置"),
  user: ByteDanceV2UserSchema.describe("用户相关配置"),
  audio: ByteDanceV2AudioSchema.describe("音频相关配置"),
  request: ByteDanceV2RequestSchema.optional().describe("请求相关配置"),
});

export type ByteDanceV2Config = z.infer<typeof ByteDanceV2ConfigSchema>;

/**
 * V2 默认 cluster
 */
export const BYTEDANCE_V2_DEFAULT_CLUSTER = "volcengine_streaming_common";

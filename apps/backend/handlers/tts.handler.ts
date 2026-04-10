/**
 * TTS API HTTP 路由处理器
 * 提供语音合成 RESTful API 接口
 */

import { TTS_VOICES, getVoiceScenes } from "@/constants/voices.js";
import type { AppContext } from "@/types/hono.context.js";
import { configManager } from "@xiaozhi-client/config";
import { mapClusterToResourceId } from "@xiaozhi-client/esp32";
import type { VoiceInfo, VoicesResponse } from "@xiaozhi-client/shared-types";
import type { Context } from "hono";
import { createTTS } from "univoice";
import { BaseHandler } from "./base.handler.js";

/**
 * 允许的 encoding 值白名单
 */
const ALLOWED_ENCODINGS = [
  "mp3",
  "wav",
  "ogg",
  "flac",
  "pcm",
  "opus",
  "ogg_opus",
] as const;

type AllowedEncoding = (typeof ALLOWED_ENCODINGS)[number];

/**
 * encoding 到 MIME Content-Type 的映射
 * 部分值不对应标准 MIME 类型，需要显式映射
 */
const ENCODING_TO_MIME: Record<AllowedEncoding, string> = {
  mp3: "audio/mpeg",
  wav: "audio/wav",
  ogg: "audio/ogg",
  flac: "audio/flac",
  pcm: "audio/pcm",
  opus: "audio/opus",
  ogg_opus: "audio/ogg",
};

/**
 * encoding 到文件扩展名的映射
 */
const ENCODING_TO_EXT: Record<AllowedEncoding, string> = {
  mp3: "mp3",
  wav: "wav",
  ogg: "ogg",
  flac: "flac",
  pcm: "pcm",
  opus: "opus",
  ogg_opus: "ogg",
};

/**
 * TTS 合成请求体
 */
interface TTSRequestBody {
  /** 要转换的文本 */
  text: string;
  /** 应用 ID（可选，从配置读取） */
  appid?: string;
  /** 访问令牌（可选，从配置读取） */
  accessToken?: string;
  /** 声音类型（可选，从配置读取） */
  voice_type?: string;
  /** 编码格式（可选，默认 wav） */
  encoding?: string;
  /** 集群类型（可选） */
  cluster?: string;
  /** WebSocket 端点（可选） */
  endpoint?: string;
}

/**
 * TTS API 路由处理器类
 */
export class TTSApiHandler extends BaseHandler {
  constructor() {
    super();
  }

  /**
   * 语音合成
   * POST /api/tts
   */
  async synthesize(c: Context<AppContext>): Promise<Response> {
    try {
      c.get("logger").info("处理语音合成请求");

      // 解析请求参数
      const body = await this.parseJsonBody<TTSRequestBody>(c);

      // 验证必需参数
      if (!body.text) {
        c.get("logger").warn("缺少 text 参数");
        return c.fail(
          "MISSING_PARAMETER",
          "缺少必需参数: text",
          undefined,
          400
        );
      }

      // 获取 TTS 配置作为默认值
      const ttsConfig = configManager.getTTSConfig();

      // 优先从请求参数读取，否则从配置读取
      const appid = body.appid || ttsConfig.appid;
      const accessToken = body.accessToken || ttsConfig.accessToken;
      const voice_type = body.voice_type || ttsConfig.voice_type;
      const cluster = body.cluster || ttsConfig.cluster;
      const endpoint = body.endpoint || ttsConfig.endpoint;
      const encoding = body.encoding || ttsConfig.encoding || "wav";

      // 运行时校验 encoding 值
      if (!ALLOWED_ENCODINGS.includes(encoding as AllowedEncoding)) {
        c.get("logger").warn(`不支持的 encoding 参数: ${encoding}`);
        return c.fail(
          "INVALID_PARAMETER",
          `不支持的 encoding 参数: ${encoding}，允许值: ${ALLOWED_ENCODINGS.join(", ")}`,
          undefined,
          400
        );
      }

      const safeEncoding = encoding as AllowedEncoding;

      // 验证必需的 TTS 参数
      if (!appid) {
        c.get("logger").warn("缺少 appid 参数");
        return c.fail(
          "MISSING_PARAMETER",
          "缺少 appid 参数，请提供或配置 tts.appid",
          undefined,
          400
        );
      }

      if (!accessToken) {
        c.get("logger").warn("缺少 accessToken 参数");
        return c.fail(
          "MISSING_PARAMETER",
          "缺少 accessToken 参数，请提供或配置 tts.accessToken",
          undefined,
          400
        );
      }

      if (!voice_type) {
        c.get("logger").warn("缺少 voice_type 参数");
        return c.fail(
          "MISSING_PARAMETER",
          "缺少 voice_type 参数，请提供或配置 tts.voice_type",
          undefined,
          400
        );
      }

      // 创建 TTS 客户端（使用 univoice SDK）
      const tts = createTTS({
        provider: "doubao",
        appId: appid!,
        accessToken: accessToken!,
        voice: voice_type!,
        format: safeEncoding,
        resourceId: mapClusterToResourceId(cluster),
        sampleRate: 24000,
        ...(endpoint && { baseUrl: endpoint }),
      });

      c.get("logger").info(
        `开始语音合成: text=${body.text.substring(0, 20)}..., voice_type=${voice_type}`
      );

      // 调用 TTS 合成（非流式）
      const response = await tts.synthesize({ text: body.text });
      const audioData = response.audio;

      c.get("logger").info(`语音合成成功: audioSize=${audioData.length} bytes`);

      // 返回音频数据，使用正确的 MIME 类型和文件扩展名
      return new Response(Buffer.from(audioData), {
        headers: {
          "Content-Type": ENCODING_TO_MIME[safeEncoding],
          "Content-Disposition": `attachment; filename="tts_${Date.now()}.${ENCODING_TO_EXT[safeEncoding]}"`,
        },
      });
    } catch (error) {
      return this.handleError(c, error, "语音合成");
    }
  }

  /**
   * 获取可用音色列表
   * GET /api/tts/voices
   */
  async getVoices(c: Context<AppContext>): Promise<Response> {
    try {
      c.get("logger").info("获取音色列表");

      const voices: VoiceInfo[] = TTS_VOICES;
      const scenes = getVoiceScenes();

      const response: VoicesResponse = {
        voices,
        total: voices.length,
        scenes,
      };

      return c.success(response);
    } catch (error) {
      return this.handleError(c, error, "获取音色列表");
    }
  }
}

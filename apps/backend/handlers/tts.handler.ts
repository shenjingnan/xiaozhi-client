/**
 * TTS API HTTP 路由处理器
 * 提供语音合成 RESTful API 接口
 */

import { type TTSOptions, synthesizeSpeech } from "@/lib/tts/binary.js";
import type { AppContext } from "@/types/hono.context.js";
import type { Context } from "hono";
import { BaseHandler } from "./base.handler.js";
import fs from "node:fs";

/**
 * TTS 合成请求体
 */
interface TTSRequestBody {
  /** 要转换的文本 */
  text: string;
  /** 应用 ID */
  appid: string;
  /** 访问令牌 */
  accessToken: string;
  /** 声音类型（如 S_xx） */
  voice_type: string;
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

      if (!body.appid) {
        c.get("logger").warn("缺少 appid 参数");
        return c.fail(
          "MISSING_PARAMETER",
          "缺少必需参数: appid",
          undefined,
          400
        );
      }

      if (!body.accessToken) {
        c.get("logger").warn("缺少 accessToken 参数");
        return c.fail(
          "MISSING_PARAMETER",
          "缺少必需参数: accessToken",
          undefined,
          400
        );
      }

      if (!body.voice_type) {
        c.get("logger").warn("缺少 voice_type 参数");
        return c.fail(
          "MISSING_PARAMETER",
          "缺少必需参数: voice_type",
          undefined,
          400
        );
      }

      const options: TTSOptions = {
        appid: body.appid,
        accessToken: body.accessToken,
        text: body.text,
        voice_type: body.voice_type,
        encoding: body.encoding || "wav",
        cluster: body.cluster,
        endpoint: body.endpoint,
      };

      c.get("logger").info(
        `开始语音合成: text=${body.text.substring(0, 20)}..., voice_type=${body.voice_type}`
      );

      // 调用 TTS 合成
      const audioData = await synthesizeSpeech(options);

      c.get("logger").info(`语音合成成功: audioSize=${audioData.length} bytes`);

      fs.writeFileSync("audio.wav", audioData);

      // 返回音频数据
      return new Response(Buffer.from(audioData), {
        headers: {
          "Content-Type": "audio/wav",
          "Content-Disposition": `attachment; filename="tts_${Date.now()}.wav"`,
        },
      });
    } catch (error) {
      return this.handleError(c, error, "语音合成");
    }
  }
}

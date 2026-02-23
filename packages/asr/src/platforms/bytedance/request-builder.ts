/**
 * ByteDance V2 请求构造器
 */

import { AudioFormat } from "@/audio";
import type {
  ByteDanceV2ASRRequest,
  ByteDanceV2RequestBuilderConfig,
} from "./request.js";

/**
 * ByteDance V2 请求构造器
 * 用于构造标准的 V2 ASR 请求参数
 */
export class ByteDanceV2RequestBuilder {
  private config: ByteDanceV2RequestBuilderConfig;

  constructor(config: ByteDanceV2RequestBuilderConfig) {
    this.config = config;
  }

  /**
   * 构造 V2 请求
   * @param reqid 请求 ID
   * @returns 完整的请求配置对象
   */
  build(reqid: string): ByteDanceV2ASRRequest {
    return {
      app: {
        appid: this.config.appid,
        cluster: this.config.cluster,
        token: this.config.token,
      },
      user: {
        uid: this.config.uid,
      },
      request: {
        reqid,
        sequence: 1,
        nbest: this.config.nbest,
        confidence: 0,
        workflow: this.config.workflow,
        show_language: this.config.showLanguage,
        show_utterances: this.config.showUtterances,
        vad_signal: true,
        start_silence_time: "5000",
        vad_silence_time: "800",
        result_type: this.config.resultType,
      },
      audio: {
        format: this.convertFormat(this.config.format),
        rate: this.config.sampleRate,
        language: this.config.language,
        bits: this.config.bits,
        channel: this.config.channel,
        codec: this.config.codec,
      },
    };
  }

  /**
   * 转换音频格式为字符串
   */
  private convertFormat(format: AudioFormat): string {
    switch (format) {
      case AudioFormat.OGG:
        return "ogg";
      case AudioFormat.WAV:
        return "wav";
      default:
        return format;
    }
  }
}

/**
 * 字节跳动 TTS 控制器实现
 */

import { randomUUID } from "node:crypto";
import WebSocket from "ws";
import type {
  AudioChunkCallback,
  PlatformConfig,
  TTSController,
} from "../../core/index.js";
import {
  FullClientRequest,
  MsgType,
  ReceiveMessage,
} from "./protocol/index.js";
import {
  type ByteDanceTTSConfig,
  ByteDanceTTSConfigSchema,
  DEFAULT_TTS_ENDPOINT,
} from "./schemas/index.js";

/**
 * 验证并返回 TTS 配置
 */
function validateConfig(config: unknown): ByteDanceTTSConfig {
  return ByteDanceTTSConfigSchema.parse(config);
}

/**
 * 根据声音类型自动判断集群类型
 */
function voiceToCluster(voice: string): string {
  if (voice.startsWith("S_")) {
    return "volcano_icl";
  }
  return "volcano_tts";
}

/**
 * 字节跳动 TTS 控制器实现类
 */
export class ByteDanceTTSController implements TTSController {
  private config: ByteDanceTTSConfig;
  private ws: WebSocket | null = null;
  private isStreamClosed = false;

  constructor(config: ByteDanceTTSConfig) {
    this.config = config;
  }

  /**
   * 建立 WebSocket 连接
   */
  private async connectWebSocket(): Promise<WebSocket> {
    this.isStreamClosed = false;

    const endpoint = this.config.endpoint || DEFAULT_TTS_ENDPOINT;
    const headers = {
      Authorization: `Bearer;${this.config.app.accessToken}`,
    };

    this.ws = new WebSocket(endpoint, {
      headers,
      skipUTF8Validation: true,
    });

    await new Promise<void>((resolve, reject) => {
      if (!this.ws) {
        reject(new Error("WebSocket 未创建"));
        return;
      }
      this.ws.on("open", () => resolve());
      this.ws.on("error", (err) => reject(err));
    });

    return this.ws;
  }

  /**
   * 构建 TTS 请求
   */
  private buildRequest(text: string): Record<string, unknown> {
    const encoding = this.config.audio.encoding || "wav";

    return {
      app: {
        appid: this.config.app.appid,
        token: this.config.app.accessToken,
        cluster:
          this.config.cluster?.trim() ||
          voiceToCluster(this.config.audio.voice_type),
      },
      user: {
        uid: randomUUID(),
      },
      audio: {
        voice_type: this.config.audio.voice_type,
        encoding: encoding,
        ...(this.config.audio.speed !== undefined && {
          speed: this.config.audio.speed,
        }),
        ...(this.config.audio.pitch !== undefined && {
          pitch: this.config.audio.pitch,
        }),
        ...(this.config.audio.volume !== undefined && {
          volume: this.config.audio.volume,
        }),
      },
      request: {
        reqid: randomUUID(),
        text: text,
        operation: "submit",
        extra_param: JSON.stringify({
          disable_markdown_filter: false,
        }),
        with_timestamp: "1",
      },
    };
  }

  /**
   * 发送 TTS 请求
   */
  private async sendRequest(text: string): Promise<void> {
    const ws = await this.connectWebSocket();
    const request = this.buildRequest(text);

    await FullClientRequest(
      ws,
      new TextEncoder().encode(JSON.stringify(request))
    );
  }

  /**
   * 流式合成语音
   */
  async synthesizeStream(
    text: string,
    onAudioChunk: AudioChunkCallback
  ): Promise<void> {
    await this.sendRequest(text);

    while (true) {
      if (this.isStreamClosed || !this.ws) {
        break;
      }

      const msg = await ReceiveMessage(this.ws);

      switch (msg.type) {
        case MsgType.FrontEndResultServer:
          break;
        case MsgType.AudioOnlyServer: {
          const isLast = msg.sequence !== undefined && msg.sequence < 0;
          await onAudioChunk(msg.payload, isLast);

          if (isLast) {
            this.close();
            return;
          }
          break;
        }
        default:
          this.close();
          throw new Error(`${msg.toString()}`);
      }
    }
  }

  /**
   * 非流式合成语音
   */
  async synthesize(text: string): Promise<Uint8Array> {
    await this.sendRequest(text);

    const totalAudio: Uint8Array[] = [];

    while (true) {
      if (this.isStreamClosed || !this.ws) {
        break;
      }

      const msg = await ReceiveMessage(this.ws);

      switch (msg.type) {
        case MsgType.FrontEndResultServer:
          break;
        case MsgType.AudioOnlyServer:
          totalAudio.push(msg.payload);
          break;
        default:
          this.close();
          throw new Error(`${msg.toString()}`);
      }

      if (
        msg.type === MsgType.AudioOnlyServer &&
        msg.sequence !== undefined &&
        msg.sequence < 0
      ) {
        break;
      }
    }

    this.close();

    if (totalAudio.length === 0) {
      throw new Error("no audio received");
    }

    // 合并所有音频数据块
    const totalLength = totalAudio.reduce(
      (sum, chunk) => sum + chunk.length,
      0
    );
    const result = new Uint8Array(totalLength);
    let offset = 0;
    for (const chunk of totalAudio) {
      result.set(chunk, offset);
      offset += chunk.length;
    }

    return result;
  }

  /**
   * 关闭连接
   */
  close(): void {
    this.isStreamClosed = true;
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }
}

/**
 * 字节跳动 TTS 平台实现
 */
export const ByteDanceTTSPlatform = {
  platform: "bytedance",

  createController(config: PlatformConfig): TTSController {
    const validatedConfig = validateConfig(config);
    return new ByteDanceTTSController(validatedConfig);
  },

  validateConfig(config: unknown): PlatformConfig {
    const validated = validateConfig(config);
    return {
      platform: "bytedance",
      ...validated,
    };
  },

  getAuthHeaders(config: PlatformConfig): Record<string, string> {
    const validated = validateConfig(config);
    return {
      Authorization: `Bearer;${validated.app.accessToken}`,
    };
  },

  getEndpoint(config: PlatformConfig): string {
    const validated = validateConfig(config);
    return validated.endpoint || DEFAULT_TTS_ENDPOINT;
  },
};

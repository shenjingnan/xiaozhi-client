import { randomUUID } from "node:crypto";
import WebSocket from "ws";
import { FullClientRequest, MsgType, ReceiveMessage } from "./protocols";

/**
 * TTS 合成选项
 */
export interface TTSOptions {
  /** 应用 ID */
  appid: string;
  /** 访问令牌 */
  accessToken: string;
  /** 集群类型（可选，默认根据 voice_type 自动判断） */
  cluster?: string;
  /** 声音类型（如 S_xx） */
  voice_type: string;
  /** 要转换的文本 */
  text: string;
  /** 编码格式（默认 wav） */
  encoding?: string;
  /** WebSocket 端点（可选） */
  endpoint?: string;
}

/**
 * 根据声音类型自动判断集群类型
 */
export function VoiceToCluster(voice: string): string {
  if (voice.startsWith("S_")) {
    return "volcano_icl";
  }
  return "volcano_tts";
}

/**
 * 合成语音
 * 连接 WebSocket 并发送 TTS 请求，收集返回的音频数据
 * @param options - TTS 合成选项
 * @returns 音频二进制数据
 */
export async function synthesizeSpeech(
  options: TTSOptions
): Promise<Uint8Array> {
  const endpoint =
    options.endpoint || "wss://openspeech.bytedance.com/api/v1/tts/ws_binary";
  const encoding = options.encoding || "wav";

  const headers = {
    Authorization: `Bearer;${options.accessToken}`,
  };

  const ws = new WebSocket(endpoint, {
    headers,
    skipUTF8Validation: true,
  });

  await new Promise((resolve, reject) => {
    ws.on("open", resolve);
    ws.on("error", reject);
  });

  const request = {
    app: {
      appid: options.appid,
      token: options.accessToken,
      cluster: options.cluster?.trim() || VoiceToCluster(options.voice_type),
    },
    user: {
      uid: randomUUID(),
    },
    audio: {
      voice_type: options.voice_type,
      encoding: encoding,
    },
    request: {
      reqid: randomUUID(),
      text: options.text,
      operation: "submit",
      extra_param: JSON.stringify({
        disable_markdown_filter: false,
      }),
      with_timestamp: "1",
    },
  };

  await FullClientRequest(
    ws,
    new TextEncoder().encode(JSON.stringify(request))
  );

  const totalAudio: Uint8Array[] = [];

  while (true) {
    const msg = await ReceiveMessage(ws);

    switch (msg.type) {
      case MsgType.FrontEndResultServer:
        break;
      case MsgType.AudioOnlyServer:
        totalAudio.push(msg.payload);
        break;
      default:
        ws.close();
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

  ws.close();

  if (totalAudio.length === 0) {
    throw new Error("no audio received");
  }

  // 合并所有音频数据块
  const totalLength = totalAudio.reduce((sum, chunk) => sum + chunk.length, 0);
  const result = new Uint8Array(totalLength);
  let offset = 0;
  for (const chunk of totalAudio) {
    result.set(chunk, offset);
    offset += chunk.length;
  }

  return result;
}

/**
 * 流式合成语音
 * 连接 WebSocket 并发送 TTS 请求，每个音频块通过回调实时处理
 * @param options - TTS 合成选项
 * @param onAudioChunk - 音频块回调函数，收到每个 payload 后立即调用
 * @returns Promise，音频流结束时 resolve
 */
export async function synthesizeSpeechStream(
  options: TTSOptions,
  onAudioChunk: (chunk: Uint8Array, isLast: boolean) => Promise<void>
): Promise<void> {
  const endpoint =
    options.endpoint || "wss://openspeech.bytedance.com/api/v1/tts/ws_binary";
  const encoding = options.encoding || "wav";

  const headers = {
    Authorization: `Bearer;${options.accessToken}`,
  };

  const ws = new WebSocket(endpoint, {
    headers,
    skipUTF8Validation: true,
  });

  await new Promise((resolve, reject) => {
    ws.on("open", resolve);
    ws.on("error", reject);
  });

  const request = {
    app: {
      appid: options.appid,
      token: options.accessToken,
      cluster: options.cluster?.trim() || VoiceToCluster(options.voice_type),
    },
    user: {
      uid: randomUUID(),
    },
    audio: {
      voice_type: options.voice_type,
      encoding: encoding,
    },
    request: {
      reqid: randomUUID(),
      text: options.text,
      operation: "submit",
      extra_param: JSON.stringify({
        disable_markdown_filter: false,
      }),
      with_timestamp: "1",
    },
  };

  await FullClientRequest(
    ws,
    new TextEncoder().encode(JSON.stringify(request))
  );

  while (true) {
    const msg = await ReceiveMessage(ws);

    switch (msg.type) {
      case MsgType.FrontEndResultServer:
        break;
      case MsgType.AudioOnlyServer: {
        // 每收到一个音频块立即调用回调处理
        const isLast = msg.sequence !== undefined && msg.sequence < 0;
        await onAudioChunk(msg.payload, isLast);

        if (isLast) {
          // 最后一块，结束循环
          ws.close();
          return;
        }
        break;
      }
      default:
        ws.close();
        throw new Error(`${msg.toString()}`);
    }
  }
}

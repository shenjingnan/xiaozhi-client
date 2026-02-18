/**
 * TTS 语音合成二进制协议模块
 *
 * 负责通过 WebSocket 与字节跳动 TTS 服务进行二进制协议通信，实现文本转语音功能。
 *
 * ## 核心功能
 * - 建立 WebSocket 连接到 TTS 服务
 * - 发送完整的客户端请求（FullClientRequest）
 * - 接收并解析音频数据响应
 * - 处理流式音频数据块并合并
 *
 * ## 依赖关系
 * - `./protocols` - TTS 协议定义和消息处理
 * - `ws` - WebSocket 客户端
 * - `node:crypto` - UUID 生成
 *
 * ## 使用示例
 * ```typescript
 * import { synthesizeSpeech } from './lib/tts/binary';
 *
 * const audioData = await synthesizeSpeech({
 *   appid: 'your-app-id',
 *   accessToken: 'your-token',
 *   voice_type: 'S_1',
 *   text: '你好，世界',
 *   encoding: 'wav'
 * });
 * ```
 *
 * ## 注意事项
 * - 需要有效的字节跳动 TTS 服务凭证
 * - WebSocket 连接需要处理网络错误
 * - 音频数据按序列号顺序接收，负序列号表示结束
 */

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

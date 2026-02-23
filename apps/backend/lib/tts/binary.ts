/**
 * TTS 合成选项
 * @deprecated 使用 @xiaozhi-client/tts 包代替
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
 * @deprecated 使用 @xiaozhi-client/tts 包中的 voiceToCluster 代替
 */
export function VoiceToCluster(voice: string): string {
  if (voice.startsWith("S_")) {
    return "volcano_icl";
  }
  return "volcano_tts";
}

/**
 * 合成语音
 * @deprecated 使用 @xiaozhi-client/tts 包的 synthesizeSpeech 函数代替
 */
export async function synthesizeSpeech(
  options: TTSOptions
): Promise<Uint8Array> {
  // 动态导入避免循环依赖
  const { synthesizeSpeech: newSynthesizeSpeech } = await import(
    "@xiaozhi-client/tts"
  );
  return newSynthesizeSpeech({
    appid: options.appid,
    accessToken: options.accessToken,
    voice_type: options.voice_type,
    text: options.text,
    encoding: options.encoding,
    cluster: options.cluster,
    endpoint: options.endpoint,
  });
}

/**
 * 流式合成语音
 * @deprecated 使用 @xiaozhi-client/tts 包的 synthesizeSpeechStream 函数代替
 */
export async function synthesizeSpeechStream(
  options: TTSOptions,
  onAudioChunk: (chunk: Uint8Array, isLast: boolean) => Promise<void>
): Promise<void> {
  // 动态导入避免循环依赖
  const { synthesizeSpeechStream: newSynthesizeSpeechStream } = await import(
    "@xiaozhi-client/tts"
  );
  await newSynthesizeSpeechStream(
    {
      appid: options.appid,
      accessToken: options.accessToken,
      voice_type: options.voice_type,
      text: options.text,
      encoding: options.encoding,
      cluster: options.cluster,
      endpoint: options.endpoint,
    },
    onAudioChunk
  );
}

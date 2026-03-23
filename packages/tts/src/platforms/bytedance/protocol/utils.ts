/**
 * TTS 协议辅助函数
 */

/**
 * 合并多个音频数据块为一个完整的 Uint8Array
 * @param chunks - 音频数据块数组
 * @returns 合并后的音频数据
 * @throws 如果音频数据块为空则抛出错误
 */
export function mergeAudioChunks(chunks: Uint8Array[]): Uint8Array {
  if (chunks.length === 0) {
    throw new Error("no audio received");
  }

  const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const result = new Uint8Array(totalLength);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.length;
  }

  return result;
}

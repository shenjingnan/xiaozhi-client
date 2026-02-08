/**
 * AI服务接口定义
 * 定义语音交互所需的AI能力接口
 */

/**
 * AI服务接口
 * 提供语音识别（STT）和文本生成（LLM）功能
 */
export interface IAIService {
  /**
   * 语音识别（STT）
   * 将音频数据转换为文本
   * @param audioData - 音频数据（Opus格式）
   * @returns 识别出的文本
   */
  recognize(audioData: Uint8Array): Promise<string>;

  /**
   * 文本生成（LLM）
   * 根据用户输入生成回复
   * @param text - 用户输入的文本
   * @returns 生成的回复文本
   */
  generateResponse(text: string): Promise<string>;
}

/**
 * TTS服务接口
 * 提供文本转语音功能
 */
export interface ITTSService {
  /**
   * 文本转语音（TTS）
   * 将文本转换为音频数据
   * @param text - 要转换的文本
   * @returns 音频数据（Opus格式，24000Hz）
   */
  synthesize(text: string): Promise<Uint8Array>;

  /**
   * 初始化TTS服务
   * 加载必要的资源
   */
  initialize?(): Promise<void>;
}

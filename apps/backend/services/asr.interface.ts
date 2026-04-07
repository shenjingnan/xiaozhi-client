/**
 * ASR 服务接口
 * 定义单会话语音识别服务的方法和事件
 */

/**
 * ASR 服务事件回调
 */
export interface ASRServiceEvents {
  /**
   * 识别结果回调
   * @param text - 识别文本
   * @param isFinal - 是否为最终结果
   */
  onResult?: (text: string, isFinal: boolean) => void;

  /**
   * 错误回调
   * @param error - 错误对象
   */
  onError?: (error: Error) => void;
}

/**
 * ASR 服务配置选项
 */
export interface ASRServiceOptions {
  /**
   * 事件回调
   */
  events?: ASRServiceEvents;
}

/**
 * ASR 服务接口
 * 单会话模式：每个实例只管理一次语音识别
 */
export interface IASRService {
  /**
   * 启动 ASR 识别会话
   * 建立 ASR 连接并开始处理音频流
   */
  start(): Promise<void>;

  /**
   * 处理音频数据
   * 将 Opus 音频数据推入流中，由 ASR 引擎消费
   * @param audioData - 裸 Opus 音频数据
   */
  handleAudioData(audioData: Uint8Array): Promise<void>;

  /**
   * 结束 ASR 识别会话
   * 结束音频流并等待识别完成
   */
  end(): Promise<void>;

  /**
   * 销毁服务
   * 清理所有资源
   */
  destroy(): void;
}

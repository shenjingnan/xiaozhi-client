/**
 * ASR 服务接口
 * 定义语音识别服务的方法和事件
 */

/**
 * ASR 服务事件回调
 */
export interface ASRServiceEvents {
  /**
   * 识别结果回调
   * @param deviceId - 设备 ID
   * @param text - 识别文本
   * @param isFinal - 是否为最终结果
   */
  onResult?: (deviceId: string, text: string, isFinal: boolean) => void;

  /**
   * 错误回调
   * @param deviceId - 设备 ID
   * @param error - 错误对象
   */
  onError?: (deviceId: string, error: Error) => void;

  /**
   * 连接关闭回调
   * @param deviceId - 设备 ID
   */
  onClose?: (deviceId: string) => void;
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
 * 定义语音识别所需的方法
 */
export interface IASRService {
  /**
   * 准备 ASR 服务
   * 只准备配置和缓冲区，不建立连接
   * 用于在连接建立前缓存音频数据
   * @param deviceId - 设备 ID
   */
  prepare(deviceId: string): Promise<void>;

  /**
   * 建立 ASR 连接
   * 建立 WebSocket 连接并开始处理音频流
   * @param deviceId - 设备 ID
   */
  connect(deviceId: string): Promise<void>;

  /**
   * 初始化 ASR 语音识别服务（已弃用，请使用 prepare + connect）
   * 如果已存在 ASR 客户端且已连接，则跳过初始化
   * @param deviceId - 设备 ID
   * @deprecated 使用 prepare() + connect() 替代
   */
  init(deviceId: string): Promise<void>;

  /**
   * 处理音频数据
   * 将音频数据推入队列，由 listen() 异步生成器消费
   * 如果连接未建立，数据会被缓存直到连接建立
   * @param deviceId - 设备 ID
   * @param audioData - 裸 Opus 音频数据
   */
  handleAudioData(deviceId: string, audioData: Uint8Array): Promise<void>;

  /**
   * 结束 ASR 语音识别
   * 标记音频结束，由 listen() 任务自动处理关闭
   * @param deviceId - 设备 ID
   */
  end(deviceId: string): Promise<void>;

  /**
   * 重置 ASR 服务状态
   * 清理资源但保留配置，准备下一次语音交互
   * @param deviceId - 设备 ID
   */
  reset(deviceId: string): Promise<void>;

  /**
   * 销毁服务
   * 清理所有设备资源
   */
  destroy(): void;
}

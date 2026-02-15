/**
 * 语音会话服务接口
 * 用于解耦 ESP32 服务与语音处理逻辑
 */

/**
 * 语音会话服务接口
 * 定义语音处理所需的方法
 */
export interface IVoiceSessionService {
  /**
   * 处理唤醒词检测
   * @param deviceId - 设备ID
   * @param wakeWord - 唤醒词
   * @param mode - 监听模式
   */
  handleWakeWord?(
    deviceId: string,
    wakeWord: string,
    mode: "auto" | "manual" | "realtime"
  ): Promise<void>;

  /**
   * 开始语音会话
   * @param deviceId - 设备ID
   * @param mode - 监听模式
   * @returns 会话ID
   */
  startSession?(
    deviceId: string,
    mode: "auto" | "manual" | "realtime"
  ): Promise<string>;

  /**
   * 处理音频数据
   * @param deviceId - 设备ID
   * @param audioData - 音频数据
   */
  handleAudioData?(deviceId: string, audioData: Uint8Array): Promise<void>;

  /**
   * 中断语音会话
   * @param deviceId - 设备ID
   * @param reason - 中断原因
   */
  abortSession?(deviceId: string, reason?: string): Promise<void>;

  /**
   * 销毁服务
   */
  destroy(): void;
}

/**
 * 空实现语音会话服务
 * 用于 OTA 和连接管理分支，不提供语音处理功能
 */
export class NoOpVoiceSessionService implements IVoiceSessionService {
  destroy(): void {
    // 空实现
  }
}

/**
 * TTS 服务接口
 * 定义语音合成服务的方法和回调
 */

import type { ESP32Connection } from "@/lib/esp32/connection.js";

/**
 * 发送回调函数类型
 * 用于将 Opus 包发送到硬件设备
 */
export type SendCallback = (
  opusPacket: Buffer,
  metadata: {
    index: number;
    size: number;
    duration: number;
    timestamp: number;
  }
) => Promise<void>;

/**
 * TTS 服务配置选项
 */
export interface TTSServiceOptions {
  /**
   * 获取设备连接的回调
   */
  getConnection?: (deviceId: string) => ESP32Connection | undefined;
}

/**
 * TTS 服务接口
 * 定义语音合成所需的方法
 */
export interface ITTSService {
  /**
   * 处理 TTS 数据
   * 首次收到音频数据时触发流式 TTS
   * @param deviceId - 设备 ID
   * @param text - 要转换为语音的文本
   */
  speak(deviceId: string, text: string): Promise<void>;

  /**
   * 处理音频缓冲区
   * 将完整的 OGG Opus 数据解封装为 Opus 包并通过回调发送
   * @param audioBuffer - 完整的 OGG Opus 数据
   * @param sendCallback - 发送到硬件的回调函数
   * @returns 包含包数量和总时长的结果
   */
  processAudioBuffer(
    audioBuffer: Buffer,
    sendCallback: SendCallback
  ): Promise<{ packetCount: number; totalDuration: number }>;

  /**
   * 清理设备状态
   * 注意：不清理 ttsCompleted，让它保持标记防止重复触发
   * @param deviceId - 设备 ID
   */
  cleanup(deviceId: string): void;

  /**
   * 销毁服务
   * 清理所有设备资源
   */
  destroy(): void;
}

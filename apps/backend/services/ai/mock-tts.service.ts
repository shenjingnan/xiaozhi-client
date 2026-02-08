/**
 * Mock TTS服务实现
 * 用于开发和测试阶段的模拟文本转语音服务
 */

import { promises as fs } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { logger } from "@/Logger.js";
import type { ITTSService } from "./ai-service.interface.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Mock TTS服务
 * 返回预加载的测试音频文件，用于流程验证
 */
export class MockTTSService implements ITTSService {
  /** 音频数据缓存 */
  private audioData: Uint8Array | null = null;
  /** 音频文件路径 */
  private readonly audioFilePath: string;
  /** 是否已初始化 */
  private initialized = false;

  constructor() {
    // 测试音频文件路径（相对于当前文件）
    this.audioFilePath = join(__dirname, "../test.ogg");
  }

  /**
   * 初始化TTS服务
   * 加载测试音频文件
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    try {
      logger.info(`[MockTTSService] 加载测试音频: ${this.audioFilePath}`);
      const buffer = await fs.readFile(this.audioFilePath);

      // 暂时直接返回整个Ogg文件
      // TODO: 未来可以提取纯Opus数据
      this.audioData = new Uint8Array(buffer);

      this.initialized = true;
      logger.info(
        `[MockTTSService] 测试音频加载完成，大小: ${this.audioData.length} 字节`
      );
    } catch (error) {
      logger.error("[MockTTSService] 加载测试音频失败:", error);
      throw new Error("测试音频文件加载失败", { cause: error });
    }
  }

  /**
   * 文本转语音（TTS）
   * 实际返回预加载的测试音频
   * @param text - 要转换的文本（此参数未使用，仅用于模拟）
   * @returns 测试音频数据
   */
  async synthesize(text: string): Promise<Uint8Array> {
    if (!this.initialized) {
      await this.initialize();
    }

    if (!this.audioData) {
      throw new Error("TTS音频数据未初始化");
    }

    logger.debug(
      `[MockTTSService] 模拟TTS合成，输入: "${text}"，返回测试音频（${this.audioData.length} 字节）`
    );

    // 模拟网络延迟
    await this.delay(150);

    return this.audioData;
  }

  /**
   * 模拟延迟
   * @param ms - 延迟毫秒数
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * 获取音频数据大小
   * @returns 音频数据大小（字节）
   */
  getAudioDataSize(): number {
    return this.audioData?.length ?? 0;
  }
}

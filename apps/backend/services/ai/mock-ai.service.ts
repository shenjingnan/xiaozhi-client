/**
 * Mock AI服务实现
 * 用于开发和测试阶段的模拟STT和LLM服务
 */

import { logger } from "@/Logger.js";
import type { IAIService } from "./ai-service.interface.js";

/**
 * Mock AI服务
 * 返回固定的模拟数据，用于流程验证
 */
export class MockAIService implements IAIService {
  /** 模拟的STT识别结果 */
  private readonly mockSTTResult = "测试语音输入";

  /** 模拟的LLM回复 */
  private readonly mockLLMResponse = "你好！我是小智助手，很高兴为你服务。";

  /**
   * 语音识别（STT）
   * 实际返回固定的模拟文本
   * @param _audioData - 音频数据（此参数未使用，仅用于模拟）
   * @returns 固定的模拟识别结果
   */
  async recognize(_audioData: Uint8Array): Promise<string> {
    logger.debug(
      `[MockAIService] 模拟STT识别，返回固定文本: "${this.mockSTTResult}"`
    );
    // 模拟网络延迟
    await this.delay(100);
    return this.mockSTTResult;
  }

  /**
   * 文本生成（LLM）
   * 实际返回固定的模拟回复
   * @param text - 用户输入的文本（此参数未使用，仅用于模拟）
   * @returns 固定的模拟回复
   */
  async generateResponse(text: string): Promise<string> {
    logger.debug(
      `[MockAIService] 模拟LLM生成，输入: "${text}"，返回固定回复: "${this.mockLLMResponse}"`
    );
    // 模拟网络延迟
    await this.delay(200);
    return this.mockLLMResponse;
  }

  /**
   * 模拟延迟
   * @param ms - 延迟毫秒数
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

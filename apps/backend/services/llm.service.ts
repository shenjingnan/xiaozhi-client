/**
 * LLM 服务
 * 提供基于 OpenAI SDK 的大语言模型调用封装
 */

import { configManager } from "@xiaozhi-client/config";
import { logger } from "@/Logger.js";
import OpenAI from "openai";

// 默认系统提示词，用于语音助手场景
const DEFAULT_SYSTEM_PROMPT =
  "你是一个友好的语音助手，请用简洁的中文回答用户的问题。";

function removeThinkTags(content: string): string {
  // 移除 <think>...</think> 及其内容
  return content.replace(/<think>[\s\S]*?<\/think>/g, '').trim();
}

// LLM 服务类
export class LLMService {
  private client: OpenAI | null = null;
  private model: string = "";

  constructor() {
    this.initClient();
  }

  /**
   * 初始化 OpenAI 客户端
   */
  private initClient(): void {
    const config = configManager.getLLMConfig();

    if (!config || !configManager.isLLMConfigValid()) {
      logger.warn(
        "[LLMService] LLM 配置未找到或无效，请检查配置文件中的 llm 配置项"
      );
      return;
    }

    this.model = config.model;
    this.client = new OpenAI({
      apiKey: config.apiKey,
      baseURL: config.baseURL,
    });

    logger.info(`[LLMService] OpenAI 客户端已初始化，模型: ${this.model}`);
  }

  /**
   * 检查 LLM 服务是否可用
   */
  isAvailable(): boolean {
    return this.client !== null;
  }

  /**
   * 调用 LLM 获取回复
   * @param userMessage - 用户消息
   * @returns LLM 回复文本
   */
  async chat(userMessage: string): Promise<string> {
    if (!this.client) {
      logger.error("[LLMService] LLM 客户端未初始化");
      return "抱歉，我暂时无法回答";
    }

    try {
      const response = await this.client.chat.completions.create({
        model: this.model,
        messages: [
          { role: "system", content: DEFAULT_SYSTEM_PROMPT },
          { role: "user", content: userMessage },
        ],
      });

      let content = response.choices[0]?.message?.content || "";
      content = removeThinkTags(content);

      if (!content) {
        logger.warn("[LLMService] LLM 返回空内容");
        return "抱歉，我暂时无法回答";
      }

      logger.debug(
        `[LLMService] LLM 调用成功，输入长度: ${userMessage.length}，输出长度: ${content.length}`
      );

      return content;
    } catch (error) {
      logger.error("[LLMService] LLM 调用失败:", error);
      return "抱歉，我暂时无法回答";
    }
  }
}

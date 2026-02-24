/**
 * LLM 服务
 * 提供基于 OpenAI SDK 的大语言模型调用封装
 */

import { configManager } from "@xiaozhi-client/config";
import OpenAI from "openai";

// 默认系统提示词，用于语音助手场景
const DEFAULT_SYSTEM_PROMPT =
  "你是一个友好的语音助手，请用简洁的中文回答用户的问题。";

// LLM 服务类
export class LLMService {
  private client: OpenAI | null = null;

  constructor() {
    this.initClient();
  }

  /**
   * 初始化 OpenAI 客户端
   */
  private initClient(): void {
    const config = configManager.getLLMConfig();

    if (!config) {
      console.warn(
        "[LLMService] LLM 配置未找到，请检查配置文件中的 llm 配置项"
      );
      return;
    }

    this.client = new OpenAI({
      apiKey: config.apiKey,
      baseURL: config.baseURL,
    });

    console.log(`[LLMService] OpenAI 客户端已初始化，模型: ${config.model}`);
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
      console.error("[LLMService] LLM 客户端未初始化");
      return "抱歉，我暂时无法回答";
    }

    try {
      const config = configManager.getLLMConfig();

      const response = await this.client.chat.completions.create({
        model: config!.model,
        messages: [
          { role: "system", content: DEFAULT_SYSTEM_PROMPT },
          { role: "user", content: userMessage },
        ],
      });

      const content = response.choices[0]?.message?.content || "";

      if (!content) {
        console.warn("[LLMService] LLM 返回空内容");
        return "抱歉，我暂时无法回答";
      }

      console.log(
        `[LLMService] LLM 调用成功，输入: ${userMessage.substring(0, 50)}..., 输出: ${content.substring(0, 50)}...`
      );

      return content;
    } catch (error) {
      console.error("[LLMService] LLM 调用失败:", error);
      return "抱歉，我暂时无法回答";
    }
  }
}

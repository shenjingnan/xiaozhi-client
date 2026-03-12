/**
 * LLM 服务
 * 提供基于 OpenAI SDK 的大语言模型调用封装
 */

import { logger } from "@/Logger.js";
import { resolvePrompt } from "@/utils/prompt-utils.js";
import { configManager } from "@xiaozhi-client/config";
import OpenAI from "openai";

function removeThinkTags(content: string): string {
  // 移除 <think>...</think> 及其内容
  return content.replace(/<think>[\s\S]*?<\/think>/g, "").trim();
}

// LLM 服务类
export class LLMService {
  private client: OpenAI | null = null;
  private model = "";

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
   * 重新初始化客户端（如果当前客户端不可用但配置有效）
   * 用于支持配置热更新
   */
  private reinitClient(): void {
    // 如果客户端已存在，不需要重新初始化
    if (this.client !== null) {
      return;
    }

    // 如果客户端不存在但配置有效，尝试初始化
    if (configManager.isLLMConfigValid()) {
      logger.info("[LLMService] 检测到配置更新，重新初始化客户端");
      this.initClient();
    }
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
    // 在调用前检查并尝试重新初始化（支持配置热更新）
    this.reinitClient();

    if (!this.client) {
      logger.error("[LLMService] LLM 客户端未初始化");
      return "抱歉，我暂时无法回答";
    }

    try {
      // 获取 LLM 配置中的提示词配置并解析
      const llmConfig = configManager.getLLMConfig();
      const systemPrompt = resolvePrompt(llmConfig?.prompt);

      const response = await this.client.chat.completions.create({
        model: this.model,
        messages: [
          { role: "system", content: systemPrompt },
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

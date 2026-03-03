/**
 * LLM 服务单元测试
 * 测试基于 OpenAI SDK 的大语言模型调用封装
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LLMService } from "../llm.service.js";

// Mock Logger
vi.mock("../../Logger.js", () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
}));

// Mock configManager - 使用默认空值
vi.mock("@xiaozhi-client/config", () => ({
  configManager: {
    getLLMConfig: vi.fn().mockReturnValue(null),
    isLLMConfigValid: vi.fn().mockReturnValue(false),
  },
}));

// Mock resolvePrompt
vi.mock("../../utils/prompt-utils.js", () => ({
  resolvePrompt: vi.fn().mockReturnValue("你是一个友好的语音助手，请用简洁的中文回答用户的问题。"),
}));

// Mock OpenAI
vi.mock("openai", () => ({
  default: vi.fn().mockImplementation(() => ({
    chat: {
      completions: {
        create: vi.fn(),
      },
    },
  })),
}));

describe("LLMService", () => {
  let mockLogger: any;

  beforeEach(async () => {
    vi.clearAllMocks();

    // Mock Logger
    mockLogger = {
      debug: vi.fn(),
      info: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
    };
    const { logger } = await import("../../Logger.js");
    Object.assign(logger, mockLogger);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("初始化", () => {
    it("配置有效时应正确初始化 OpenAI 客户端", async () => {
      const validConfig = {
        apiKey: "test-api-key",
        baseURL: "https://api.openai.com/v1",
        model: "gpt-4",
        prompt: "你是一个友好的助手",
      };

      const { configManager } = await import("@xiaozhi-client/config");
      vi.mocked(configManager.getLLMConfig).mockReturnValue(validConfig);
      vi.mocked(configManager.isLLMConfigValid).mockReturnValue(true);

      const service = new LLMService();

      const OpenAI = (await import("openai")).default;
      expect(OpenAI).toHaveBeenCalledWith({
        apiKey: "test-api-key",
        baseURL: "https://api.openai.com/v1",
      });
      expect(mockLogger.info).toHaveBeenCalledWith(
        "[LLMService] OpenAI 客户端已初始化，模型: gpt-4"
      );
      expect(service.isAvailable()).toBe(true);
    });

    it("配置不存在时应不初始化客户端", () => {
      const service = new LLMService();

      expect(mockLogger.warn).toHaveBeenCalledWith(
        "[LLMService] LLM 配置未找到或无效，请检查配置文件中的 llm 配置项"
      );
      expect(service.isAvailable()).toBe(false);
    });

    it("配置无效时应不初始化客户端", async () => {
      const invalidConfig = {
        apiKey: "",
        baseURL: "",
        model: "",
      };

      const { configManager } = await import("@xiaozhi-client/config");
      vi.mocked(configManager.getLLMConfig).mockReturnValue(invalidConfig);
      vi.mocked(configManager.isLLMConfigValid).mockReturnValue(false);

      const service = new LLMService();

      expect(mockLogger.warn).toHaveBeenCalledWith(
        "[LLMService] LLM 配置未找到或无效，请检查配置文件中的 llm 配置项"
      );
      expect(service.isAvailable()).toBe(false);
    });
  });

  describe("isAvailable", () => {
    it("客户端已初始化时应返回 true", async () => {
      const validConfig = {
        apiKey: "test-api-key",
        baseURL: "https://api.openai.com/v1",
        model: "gpt-4",
      };

      const { configManager } = await import("@xiaozhi-client/config");
      vi.mocked(configManager.getLLMConfig).mockReturnValue(validConfig);
      vi.mocked(configManager.isLLMConfigValid).mockReturnValue(true);

      const service = new LLMService();

      expect(service.isAvailable()).toBe(true);
    });

    it("客户端未初始化时应返回 false", () => {
      const service = new LLMService();

      expect(service.isAvailable()).toBe(false);
    });
  });

  describe("chat", () => {
    it("成功调用 LLM 并返回响应", async () => {
      const validConfig = {
        apiKey: "test-api-key",
        baseURL: "https://api.openai.com/v1",
        model: "gpt-4",
        prompt: "你是一个友好的助手",
      };

      const { configManager } = await import("@xiaozhi-client/config");
      vi.mocked(configManager.getLLMConfig).mockReturnValue(validConfig);
      vi.mocked(configManager.isLLMConfigValid).mockReturnValue(true);

      // 创建 mock client
      const mockClient = {
        chat: {
          completions: {
            create: vi.fn().mockResolvedValue({
              choices: [
                {
                  message: {
                    content: "你好！有什么我可以帮助你的吗？",
                  },
                },
              ],
            }),
          },
        },
      };

      const OpenAI = (await import("openai")).default;
      vi.mocked(OpenAI).mockReturnValue(mockClient as any);

      const service = new LLMService();
      const userMessage = "你好";

      const result = await service.chat(userMessage);

      expect(result).toBe("你好！有什么我可以帮助你的吗？");
      expect(mockClient.chat.completions.create).toHaveBeenCalledWith({
        model: "gpt-4",
        messages: [
          { role: "system", content: "你是一个友好的语音助手，请用简洁的中文回答用户的问题。" },
          { role: "user", content: userMessage },
        ],
      });
      expect(mockLogger.debug).toHaveBeenCalledWith(
        "[LLMService] LLM 调用成功，输入长度: 2，输出长度: 15"
      );
    });

    it("客户端未初始化时应返回友好错误消息", () => {
      const service = new LLMService();

      const result = service.chat("你好");

      return result.then((output) => {
        expect(output).toBe("抱歉，我暂时无法回答");
        expect(mockLogger.error).toHaveBeenCalledWith("[LLMService] LLM 客户端未初始化");
      });
    });

    it("LLM 返回空内容时应返回友好错误消息", async () => {
      const validConfig = {
        apiKey: "test-api-key",
        baseURL: "https://api.openai.com/v1",
        model: "gpt-4",
      };

      const { configManager } = await import("@xiaozhi-client/config");
      vi.mocked(configManager.getLLMConfig).mockReturnValue(validConfig);
      vi.mocked(configManager.isLLMConfigValid).mockReturnValue(true);

      const mockClient = {
        chat: {
          completions: {
            create: vi.fn().mockResolvedValue({
              choices: [
                {
                  message: {
                    content: null,
                  },
                },
              ],
            }),
          },
        },
      };

      const OpenAI = (await import("openai")).default;
      vi.mocked(OpenAI).mockReturnValue(mockClient as any);

      const service = new LLMService();

      const result = await service.chat("你好");

      expect(result).toBe("抱歉，我暂时无法回答");
      expect(mockLogger.warn).toHaveBeenCalledWith("[LLMService] LLM 返回空内容");
    });

    it("LLM 返回空字符串时应返回友好错误消息", async () => {
      const validConfig = {
        apiKey: "test-api-key",
        baseURL: "https://api.openai.com/v1",
        model: "gpt-4",
      };

      const { configManager } = await import("@xiaozhi-client/config");
      vi.mocked(configManager.getLLMConfig).mockReturnValue(validConfig);
      vi.mocked(configManager.isLLMConfigValid).mockReturnValue(true);

      const mockClient = {
        chat: {
          completions: {
            create: vi.fn().mockResolvedValue({
              choices: [
                {
                  message: {
                    content: "",
                  },
                },
              ],
            }),
          },
        },
      };

      const OpenAI = (await import("openai")).default;
      vi.mocked(OpenAI).mockReturnValue(mockClient as any);

      const service = new LLMService();

      const result = await service.chat("你好");

      expect(result).toBe("抱歉，我暂时无法回答");
      expect(mockLogger.warn).toHaveBeenCalledWith("[LLMService] LLM 返回空内容");
    });

    it("API 调用失败时应记录错误并返回友好消息", async () => {
      const validConfig = {
        apiKey: "test-api-key",
        baseURL: "https://api.openai.com/v1",
        model: "gpt-4",
      };

      const { configManager } = await import("@xiaozhi-client/config");
      vi.mocked(configManager.getLLMConfig).mockReturnValue(validConfig);
      vi.mocked(configManager.isLLMConfigValid).mockReturnValue(true);

      const mockClient = {
        chat: {
          completions: {
            create: vi.fn().mockRejectedValue(new Error("API 调用失败")),
          },
        },
      };

      const OpenAI = (await import("openai")).default;
      vi.mocked(OpenAI).mockReturnValue(mockClient as any);

      const service = new LLMService();

      const result = await service.chat("你好");

      expect(result).toBe("抱歉，我暂时无法回答");
      expect(mockLogger.error).toHaveBeenCalledWith(
        "[LLMService] LLM 调用失败:",
        expect.any(Error)
      );
    });

    it("应该正确移除 think 标签及其内容", async () => {
      const validConfig = {
        apiKey: "test-api-key",
        baseURL: "https://api.openai.com/v1",
        model: "gpt-4",
      };

      const { configManager } = await import("@xiaozhi-client/config");
      vi.mocked(configManager.getLLMConfig).mockReturnValue(validConfig);
      vi.mocked(configManager.isLLMConfigValid).mockReturnValue(true);

      const mockClient = {
        chat: {
          completions: {
            create: vi.fn().mockResolvedValue({
              choices: [
                {
                  message: {
                    content: "这是思考过程这是实际回答内容",
                  },
                },
              ],
            }),
          },
        },
      };

      const OpenAI = (await import("openai")).default;
      vi.mocked(OpenAI).mockReturnValue(mockClient as any);

      const service = new LLMService();

      const result = await service.chat("你好");

      expect(result).toBe("这是实际回答内容");
      expect(mockLogger.debug).toHaveBeenCalledWith(
        "[LLMService] LLM 调用成功，输入长度: 2，输出长度: 9"
      );
    });

    it("应该移除多行 think 标签内容", async () => {
      const validConfig = {
        apiKey: "test-api-key",
        baseURL: "https://api.openai.com/v1",
        model: "gpt-4",
      };

      const { configManager } = await import("@xiaozhi-client/config");
      vi.mocked(configManager.getLLMConfig).mockReturnValue(validConfig);
      vi.mocked(configManager.isLLMConfigValid).mockReturnValue(true);

      const mockClient = {
        chat: {
          completions: {
            create: vi.fn().mockResolvedValue({
              choices: [
                {
                  message: {
                    content: "第一行思考\n第二行思考\n这是回答",
                  },
                },
              ],
            }),
          },
        },
      };

      const OpenAI = (await import("openai")).default;
      vi.mocked(OpenAI).mockReturnValue(mockClient as any);

      const service = new LLMService();

      const result = await service.chat("你好");

      expect(result).toBe("这是回答");
    });

    it("多个 think 标签时应全部移除", async () => {
      const validConfig = {
        apiKey: "test-api-key",
        baseURL: "https://api.openai.com/v1",
        model: "gpt-4",
      };

      const { configManager } = await import("@xiaozhi-client/config");
      vi.mocked(configManager.getLLMConfig).mockReturnValue(validConfig);
      vi.mocked(configManager.isLLMConfigValid).mockReturnValue(true);

      const mockClient = {
        chat: {
          completions: {
            create: vi.fn().mockResolvedValue({
              choices: [
                {
                  message: {
                    content: "第一次思考\n第一次回答\n第二次思考\n第二次回答",
                  },
                },
              ],
            }),
          },
        },
      };

      const OpenAI = (await import("openai")).default;
      vi.mocked(OpenAI).mockReturnValue(mockClient as any);

      const service = new LLMService();

      const result = await service.chat("复杂问题");

      expect(result).toBe("第一次回答\n第二次回答");
    });

    it("think 标签前后有内容时应正确处理", async () => {
      const validConfig = {
        apiKey: "test-api-key",
        baseURL: "https://api.openai.com/v1",
        model: "gpt-4",
      };

      const { configManager } = await import("@xiaozhi-client/config");
      vi.mocked(configManager.getLLMConfig).mockReturnValue(validConfig);
      vi.mocked(configManager.isLLMConfigValid).mockReturnValue(true);

      const mockClient = {
        chat: {
          completions: {
            create: vi.fn().mockResolvedValue({
              choices: [
                {
                  message: {
                    content: "前面内容思考内容\n后面内容",
                  },
                },
              ],
            }),
          },
        },
      };

      const OpenAI = (await import("openai")).default;
      vi.mocked(OpenAI).mockReturnValue(mockClient as any);

      const service = new LLMService();

      const result = await service.chat("你好");

      expect(result).toBe("前面内容后面内容");
    });
  });

  describe("removeThinkTags 辅助函数测试", () => {
    it("应该正确移除单个 think 标签及其内容", async () => {
      const validConfig = {
        apiKey: "test-api-key",
        baseURL: "https://api.openai.com/v1",
        model: "gpt-4",
      };

      const { configManager } = await import("@xiaozhi-client/config");
      vi.mocked(configManager.getLLMConfig).mockReturnValue(validConfig);
      vi.mocked(configManager.isLLMConfigValid).mockReturnValue(true);

      const mockClient = {
        chat: {
          completions: {
            create: vi.fn().mockResolvedValue({
              choices: [
                {
                  message: {
                    content: "这是思考过程这是实际内容",
                  },
                },
              ],
            }),
          },
        },
      };

      const OpenAI = (await import("openai")).default;
      vi.mocked(OpenAI).mockReturnValue(mockClient as any);

      const service = new LLMService();

      const result = await service.chat("测试");

      expect(result).toBe("这是实际内容");
    });

    it("应该保留非 think 标签内容", async () => {
      const validConfig = {
        apiKey: "test-api-key",
        baseURL: "https://api.openai.com/v1",
        model: "gpt-4",
      };

      const { configManager } = await import("@xiaozhi-client/config");
      vi.mocked(configManager.getLLMConfig).mockReturnValue(validConfig);
      vi.mocked(configManager.isLLMConfigValid).mockReturnValue(true);

      const mockClient = {
        chat: {
          completions: {
            create: vi.fn().mockResolvedValue({
              choices: [
                {
                  message: {
                    content: "<other>其他标签</other>保留内容",
                  },
                },
              ],
            }),
          },
        },
      };

      const OpenAI = (await import("openai")).default;
      vi.mocked(OpenAI).mockReturnValue(mockClient as any);

      const service = new LLMService();

      const result = await service.chat("测试");

      expect(result).toBe("<other>其他标签</other>保留内容");
    });

    it("应该处理没有 think 标签的字符串", async () => {
      const validConfig = {
        apiKey: "test-api-key",
        baseURL: "https://api.openai.com/v1",
        model: "gpt-4",
      };

      const { configManager } = await import("@xiaozhi-client/config");
      vi.mocked(configManager.getLLMConfig).mockReturnValue(validConfig);
      vi.mocked(configManager.isLLMConfigValid).mockReturnValue(true);

      const mockClient = {
        chat: {
          completions: {
            create: vi.fn().mockResolvedValue({
              choices: [
                {
                  message: {
                    content: "普通文本内容没有特殊标签",
                  },
                },
              ],
            }),
          },
        },
      };

      const OpenAI = (await import("openai")).default;
      vi.mocked(OpenAI).mockReturnValue(mockClient as any);

      const service = new LLMService();

      const result = await service.chat("测试");

      expect(result).toBe("普通文本内容没有特殊标签");
    });

    it("应该处理只有 think 标签的字符串", async () => {
      const validConfig = {
        apiKey: "test-api-key",
        baseURL: "https://api.openai.com/v1",
        model: "gpt-4",
      };

      const { configManager } = await import("@xiaozhi-client/config");
      vi.mocked(configManager.getLLMConfig).mockReturnValue(validConfig);
      vi.mocked(configManager.isLLMConfigValid).mockReturnValue(true);

      const mockClient = {
        chat: {
          completions: {
            create: vi.fn().mockResolvedValue({
              choices: [
                {
                  message: {
                    content: "只有思考过程",
                  },
                },
              ],
            }),
          },
        },
      };

      const OpenAI = (await import("openai")).default;
      vi.mocked(OpenAI).mockReturnValue(mockClient as any);

      const service = new LLMService();

      const result = await service.chat("测试");

      expect(result).toBe("抱歉，我暂时无法回答");
      expect(mockLogger.warn).toHaveBeenCalledWith("[LLMService] LLM 返回空内容");
    });

    it("应该处理包含特殊字符的 think 标签内容", async () => {
      const validConfig = {
        apiKey: "test-api-key",
        baseURL: "https://api.openai.com/v1",
        model: "gpt-4",
      };

      const { configManager } = await import("@xiaozhi-client/config");
      vi.mocked(configManager.getLLMConfig).mockReturnValue(validConfig);
      vi.mocked(configManager.isLLMConfigValid).mockReturnValue(true);

      const mockClient = {
        chat: {
          completions: {
            create: vi.fn().mockResolvedValue({
              choices: [
                {
                  message: {
                    content: "思考: 1+1=2\n数学符号: @#$%^&*()实际内容",
                  },
                },
              ],
            }),
          },
        },
      };

      const OpenAI = (await import("openai")).default;
      vi.mocked(OpenAI).mockReturnValue(mockClient as any);

      const service = new LLMService();

      const result = await service.chat("测试");

      expect(result).toBe("实际内容");
    });

    it("应该处理 think 标签内容中包含换行符", async () => {
      const validConfig = {
        apiKey: "test-api-key",
        baseURL: "https://api.openai.com/v1",
        model: "gpt-4",
      };

      const { configManager } = await import("@xiaozhi-client/config");
      vi.mocked(configManager.getLLMConfig).mockReturnValue(validConfig);
      vi.mocked(configManager.isLLMConfigValid).mockReturnValue(true);

      const mockClient = {
        chat: {
          completions: {
            create: vi.fn().mockResolvedValue({
              choices: [
                {
                  message: {
                    content: "多行思考\n第一行\n第二行\n多行回答",
                  },
                },
              ],
            }),
          },
        },
      };

      const OpenAI = (await import("openai")).default;
      vi.mocked(OpenAI).mockReturnValue(mockClient as any);

      const service = new LLMService();

      const result = await service.chat("测试");

      expect(result).toBe("多行回答");
    });
  });

  describe("边界情况", () => {
    it("应该处理非常长的用户消息", async () => {
      const validConfig = {
        apiKey: "test-api-key",
        baseURL: "https://api.openai.com/v1",
        model: "gpt-4",
      };

      const { configManager } = await import("@xiaozhi-client/config");
      vi.mocked(configManager.getLLMConfig).mockReturnValue(validConfig);
      vi.mocked(configManager.isLLMConfigValid).mockReturnValue(true);

      const mockClient = {
        chat: {
          completions: {
            create: vi.fn().mockResolvedValue({
              choices: [{ message: { content: "回复" } }],
            }),
          },
        },
      };

      const OpenAI = (await import("openai")).default;
      vi.mocked(OpenAI).mockReturnValue(mockClient as any);

      const service = new LLMService();
      const longMessage = "a".repeat(10000);

      const result = await service.chat(longMessage);

      expect(result).toBe("回复");
      expect(mockClient.chat.completions.create).toHaveBeenCalledWith({
        model: "gpt-4",
        messages: [
          { role: "system", content: expect.any(String) },
          { role: "user", content: longMessage },
        ],
      });
      expect(mockLogger.debug).toHaveBeenCalledWith(
        "[LLMService] LLM 调用成功，输入长度: 10000，输出长度: 2"
      );
    });

    it("应该处理特殊字符的用户消息", async () => {
      const validConfig = {
        apiKey: "test-api-key",
        baseURL: "https://api.openai.com/v1",
        model: "gpt-4",
      };

      const { configManager } = await import("@xiaozhi-client/config");
      vi.mocked(configManager.getLLMConfig).mockReturnValue(validConfig);
      vi.mocked(configManager.isLLMConfigValid).mockReturnValue(true);

      const mockClient = {
        chat: {
          completions: {
            create: vi.fn().mockResolvedValue({
              choices: [{ message: { content: "回复" } }],
            }),
          },
        },
      };

      const OpenAI = (await import("openai")).default;
      vi.mocked(OpenAI).mockReturnValue(mockClient as any);

      const service = new LLMService();
      const specialMessage = "特殊字符: \n\t\r中文 emoji \u{1F600}";

      const result = await service.chat(specialMessage);

      expect(result).toBe("回复");
    });
  });

  describe("集成场景", () => {
    it("完整聊天流程应正常工作", async () => {
      const validConfig = {
        apiKey: "test-api-key",
        baseURL: "https://api.openai.com/v1",
        model: "gpt-4",
        prompt: "你是一个友好的助手",
      };

      const { configManager } = await import("@xiaozhi-client/config");
      vi.mocked(configManager.getLLMConfig).mockReturnValue(validConfig);
      vi.mocked(configManager.isLLMConfigValid).mockReturnValue(true);

      const mockClient = {
        chat: {
          completions: {
            create: vi.fn().mockResolvedValue({
              choices: [
                {
                  message: {
                    content: "分析问题\n这是详细回答",
                  },
                },
              ],
            }),
          },
        },
      };

      const OpenAI = (await import("openai")).default;
      vi.mocked(OpenAI).mockReturnValue(mockClient as any);

      const service = new LLMService();

      // 验证服务可用
      expect(service.isAvailable()).toBe(true);

      // 发送消息
      const result = await service.chat("你好");

      // 验证结果
      expect(result).toBe("这是详细回答");

      // 验证 API 调用
      expect(mockClient.chat.completions.create).toHaveBeenCalledTimes(1);
      expect(mockClient.chat.completions.create).toHaveBeenCalledWith({
        model: "gpt-4",
        messages: [
          { role: "system", content: "你是一个友好的语音助手，请用简洁的中文回答用户的问题。" },
          { role: "user", content: "你好" },
        ],
      });
    });

    it("多个连续请求应正确处理", async () => {
      const validConfig = {
        apiKey: "test-api-key",
        baseURL: "https://api.openai.com/v1",
        model: "gpt-4",
      };

      const { configManager } = await import("@xiaozhi-client/config");
      vi.mocked(configManager.getLLMConfig).mockReturnValue(validConfig);
      vi.mocked(configManager.isLLMConfigValid).mockReturnValue(true);

      const mockClient = {
        chat: {
          completions: {
            create: vi.fn()
              .mockResolvedValueOnce({
                choices: [{ message: { content: "回答1" } }],
              })
              .mockResolvedValueOnce({
                choices: [{ message: { content: "回答2" } }],
              })
              .mockResolvedValueOnce({
                choices: [{ message: { content: "回答3" } }],
              }),
          },
        },
      };

      const OpenAI = (await import("openai")).default;
      vi.mocked(OpenAI).mockReturnValue(mockClient as any);

      const service = new LLMService();

      const result1 = await service.chat("问题1");
      const result2 = await service.chat("问题2");
      const result3 = await service.chat("问题3");

      expect(result1).toBe("回答1");
      expect(result2).toBe("回答2");
      expect(result3).toBe("回答3");

      expect(mockClient.chat.completions.create).toHaveBeenCalledTimes(3);
    });
  });
});

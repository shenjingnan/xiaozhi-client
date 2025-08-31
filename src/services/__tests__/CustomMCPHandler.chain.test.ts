#!/usr/bin/env node

/**
 * CustomMCPHandler 链式处理器测试
 * 测试链式工具的各种场景
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ChainHandlerConfig } from "../../configManager.js";
import { CustomMCPHandler } from "../CustomMCPHandler.js";

// Mock configManager
vi.mock("../../configManager.js", () => ({
  configManager: {
    getCustomMCPTools: vi.fn(),
    isToolEnabled: vi.fn(),
    hasValidCustomMCPTools: vi.fn(),
    validateCustomMCPTools: vi.fn(),
  },
}));

// Mock logger
vi.mock("../../Logger.js", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

describe("CustomMCPHandler 链式处理器测试", () => {
  let handler: CustomMCPHandler;

  const mockTool1 = {
    name: "tool1",
    description: "第一个工具",
    inputSchema: {
      type: "object",
      properties: {
        input: { type: "string" },
      },
    },
    handler: {
      type: "proxy" as const,
      platform: "coze" as const,
      config: { workflow_id: "test1" },
    },
  };

  const mockTool2 = {
    name: "tool2",
    description: "第二个工具",
    inputSchema: {
      type: "object",
      properties: {
        data: { type: "string" },
      },
    },
    handler: {
      type: "proxy" as const,
      platform: "coze" as const,
      config: { workflow_id: "test2" },
    },
  };

  const mockTool3 = {
    name: "tool3",
    description: "第三个工具",
    inputSchema: {
      type: "object",
      properties: {
        result: { type: "string" },
      },
    },
    handler: {
      type: "proxy" as const,
      platform: "coze" as const,
      config: { workflow_id: "test3" },
    },
  };

  const mockSequentialChainTool = {
    name: "sequential_chain",
    description: "顺序链式工具",
    inputSchema: {
      type: "object",
      properties: {
        input: { type: "string" },
      },
    },
    handler: {
      type: "chain" as const,
      tools: ["tool1", "tool2", "tool3"],
      mode: "sequential" as const,
      error_handling: "stop" as const,
    } as ChainHandlerConfig,
  };

  const mockParallelChainTool = {
    name: "parallel_chain",
    description: "并行链式工具",
    inputSchema: {
      type: "object",
      properties: {
        input: { type: "string" },
      },
    },
    handler: {
      type: "chain" as const,
      tools: ["tool1", "tool2", "tool3"],
      mode: "parallel" as const,
      error_handling: "continue" as const,
    } as ChainHandlerConfig,
  };

  beforeEach(() => {
    handler = new CustomMCPHandler();
    vi.clearAllMocks();

    // Mock fetch for Coze API calls
    global.fetch = vi.fn();
  });

  describe("顺序执行链式工具", () => {
    it("应该按顺序执行所有工具", async () => {
      // Mock 成功的 API 响应
      vi.mocked(global.fetch)
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              data: { execute_status: "success", output: "结果1" },
            }),
        } as any)
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              data: { execute_status: "success", output: "结果2" },
            }),
        } as any)
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              data: { execute_status: "success", output: "最终结果" },
            }),
        } as any);

      handler.initialize([
        mockTool1,
        mockTool2,
        mockTool3,
        mockSequentialChainTool,
      ]);

      const result = await handler.callTool("sequential_chain", {
        input: "初始输入",
      });

      expect(result.isError).toBe(false);
      expect(result.content).toHaveLength(3); // 三个工具的结果
      expect(result.content[0].text).toBe("结果1");
      expect(result.content[1].text).toBe("结果2");
      expect(result.content[2].text).toBe("最终结果");

      // 验证 API 被调用了三次
      expect(global.fetch).toHaveBeenCalledTimes(3);
    });

    it("应该将前一个工具的输出作为下一个工具的输入", async () => {
      // Mock 返回 JSON 格式的响应
      vi.mocked(global.fetch)
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              data: {
                execute_status: "success",
                output: '{"processed": "data1"}',
              },
            }),
        } as any)
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              data: { execute_status: "success", output: "最终处理结果" },
            }),
        } as any);

      const twoStepChain = {
        ...mockSequentialChainTool,
        handler: {
          ...mockSequentialChainTool.handler,
          tools: ["tool1", "tool2"],
        },
      };

      handler.initialize([mockTool1, mockTool2, twoStepChain]);

      await handler.callTool("sequential_chain", { input: "初始输入" });

      // 验证第二个工具接收到了第一个工具的输出
      const secondCall = vi.mocked(global.fetch).mock.calls[1];
      const secondRequestBody = JSON.parse(secondCall[1]?.body as string);

      expect(secondRequestBody.processed).toBe("data1");
    });

    it("应该在工具失败时停止执行（stop 模式）", async () => {
      // 第一个工具成功，第二个工具失败
      vi.mocked(global.fetch)
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              data: { execute_status: "success", output: "结果1" },
            }),
        } as any)
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              data: { execute_status: "failed", error_message: "工具2失败" },
            }),
        } as any);

      handler.initialize([
        mockTool1,
        mockTool2,
        mockTool3,
        mockSequentialChainTool,
      ]);

      const result = await handler.callTool("sequential_chain", {
        input: "测试输入",
      });

      expect(result.isError).toBe(true); // 因为有工具失败
      expect(result.content).toHaveLength(2); // 只有两个工具的结果
      expect(result.content[1].text).toContain("工具2失败");

      // 验证第三个工具没有被调用
      expect(global.fetch).toHaveBeenCalledTimes(2);
    });

    it("应该在重试模式下重试失败的工具", async () => {
      const retryChain = {
        ...mockSequentialChainTool,
        handler: {
          ...mockSequentialChainTool.handler,
          tools: ["tool1"],
          error_handling: "retry" as const,
        },
      };

      // 第一次失败，重试成功
      vi.mocked(global.fetch)
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              data: { execute_status: "failed", error_message: "临时失败" },
            }),
        } as any)
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              data: { execute_status: "success", output: "重试成功" },
            }),
        } as any);

      handler.initialize([mockTool1, retryChain]);

      const result = await handler.callTool("sequential_chain", {
        input: "重试测试",
      });

      expect(result.isError).toBe(false);
      expect(result.content).toHaveLength(1);
      expect(result.content[0].text).toBe("重试成功");

      // 验证工具被调用了两次（原始调用 + 重试）
      expect(global.fetch).toHaveBeenCalledTimes(2);
    });

    it("应该在继续模式下跳过失败的工具", async () => {
      const continueChain = {
        ...mockSequentialChainTool,
        handler: {
          ...mockSequentialChainTool.handler,
          error_handling: "continue" as const,
        },
      };

      // 第一个成功，第二个失败，第三个成功
      vi.mocked(global.fetch)
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              data: { execute_status: "success", output: "结果1" },
            }),
        } as any)
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              data: { execute_status: "failed", error_message: "工具2失败" },
            }),
        } as any)
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              data: { execute_status: "success", output: "结果3" },
            }),
        } as any);

      handler.initialize([mockTool1, mockTool2, mockTool3, continueChain]);

      const result = await handler.callTool("sequential_chain", {
        input: "继续测试",
      });

      expect(result.isError).toBe(true); // 因为有工具失败
      expect(result.content).toHaveLength(3); // 所有三个工具都被执行
      expect(result.content[0].text).toBe("结果1");
      expect(result.content[1].text).toContain("工具2失败");
      expect(result.content[2].text).toBe("结果3");

      // 验证所有工具都被调用
      expect(global.fetch).toHaveBeenCalledTimes(3);
    });
  });

  describe("并行执行链式工具", () => {
    it("应该并行执行所有工具", async () => {
      // Mock 所有工具成功
      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            data: { execute_status: "success", output: "并行结果" },
          }),
      } as any);

      handler.initialize([
        mockTool1,
        mockTool2,
        mockTool3,
        mockParallelChainTool,
      ]);

      const startTime = Date.now();
      const result = await handler.callTool("parallel_chain", {
        input: "并行测试",
      });
      const endTime = Date.now();

      expect(result.isError).toBe(false);
      expect(result.content).toHaveLength(3); // 三个工具的结果

      // 验证所有工具都被调用
      expect(global.fetch).toHaveBeenCalledTimes(3);

      // 验证执行时间相对较短（并行执行）
      expect(endTime - startTime).toBeLessThan(1000);
    });

    it("应该处理并行执行中的部分失败", async () => {
      // 第一个和第三个成功，第二个失败
      vi.mocked(global.fetch)
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              data: { execute_status: "success", output: "结果1" },
            }),
        } as any)
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              data: { execute_status: "failed", error_message: "工具2失败" },
            }),
        } as any)
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              data: { execute_status: "success", output: "结果3" },
            }),
        } as any);

      handler.initialize([
        mockTool1,
        mockTool2,
        mockTool3,
        mockParallelChainTool,
      ]);

      const result = await handler.callTool("parallel_chain", {
        input: "并行失败测试",
      });

      expect(result.isError).toBe(true); // 因为有工具失败
      expect(result.content).toHaveLength(3);

      // 验证成功和失败的结果都被包含
      const textResults = result.content.map((c) => c.text);
      expect(textResults).toContain("结果1");
      expect(textResults.some((text) => text.includes("工具2失败"))).toBe(true);
      expect(textResults).toContain("结果3");
    });

    it("应该处理并行执行中的异常", async () => {
      // 第一个成功，第二个抛出异常，第三个成功
      vi.mocked(global.fetch)
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              data: { execute_status: "success", output: "结果1" },
            }),
        } as any)
        .mockRejectedValueOnce(new Error("网络错误"))
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              data: { execute_status: "success", output: "结果3" },
            }),
        } as any);

      handler.initialize([
        mockTool1,
        mockTool2,
        mockTool3,
        mockParallelChainTool,
      ]);

      const result = await handler.callTool("parallel_chain", {
        input: "并行异常测试",
      });

      expect(result.isError).toBe(true);
      expect(result.content).toHaveLength(3);

      // 验证异常被正确处理
      const textResults = result.content.map((c) => c.text);
      expect(textResults).toContain("结果1");
      expect(textResults.some((text) => text.includes("执行异常"))).toBe(true);
      expect(textResults).toContain("结果3");
    });
  });

  describe("错误处理", () => {
    it("应该处理引用不存在的工具", async () => {
      const invalidChain = {
        ...mockSequentialChainTool,
        handler: {
          ...mockSequentialChainTool.handler,
          tools: ["nonexistent_tool"],
        },
      };

      handler.initialize([invalidChain]);

      const result = await handler.callTool("sequential_chain", {
        input: "无效工具测试",
      });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain(
        "不存在于当前 CustomMCP 工具集中"
      );
    });

    it("应该处理空的工具列表", async () => {
      const emptyChain = {
        ...mockSequentialChainTool,
        handler: {
          ...mockSequentialChainTool.handler,
          tools: [],
        },
      };

      handler.initialize([emptyChain]);

      const result = await handler.callTool("sequential_chain", {
        input: "空列表测试",
      });

      expect(result.isError).toBe(false);
      expect(result.content).toHaveLength(0);
    });

    it("应该处理链式工具调用中的异常", async () => {
      // Mock 一个会抛出异常的情况
      vi.mocked(global.fetch).mockRejectedValue(new Error("严重错误"));

      handler.initialize([mockTool1, mockSequentialChainTool]);

      const result = await handler.callTool("sequential_chain", {
        input: "异常测试",
      });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("链式工具调用失败");
    });
  });

  describe("参数传递", () => {
    it("应该将相同参数传递给并行执行的所有工具", async () => {
      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            data: { execute_status: "success", output: "成功" },
          }),
      } as any);

      handler.initialize([
        mockTool1,
        mockTool2,
        mockTool3,
        mockParallelChainTool,
      ]);

      const testArgs = {
        input: "并行参数测试",
        metadata: { user: "test" },
      };

      await handler.callTool("parallel_chain", testArgs);

      // 验证所有工具都接收到了相同的参数
      expect(global.fetch).toHaveBeenCalledTimes(3);

      for (let i = 0; i < 3; i++) {
        const call = vi.mocked(global.fetch).mock.calls[i];
        const requestBody = JSON.parse(call[1]?.body as string);
        expect(requestBody.query).toBe(JSON.stringify(testArgs));
      }
    });

    it("应该处理文本输出到 JSON 输入的转换失败", async () => {
      // 第一个工具返回无效的 JSON
      vi.mocked(global.fetch)
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              data: { execute_status: "success", output: "无效的 JSON 文本" },
            }),
        } as any)
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              data: { execute_status: "success", output: "第二个工具结果" },
            }),
        } as any);

      const twoStepChain = {
        ...mockSequentialChainTool,
        handler: {
          ...mockSequentialChainTool.handler,
          tools: ["tool1", "tool2"],
        },
      };

      handler.initialize([mockTool1, mockTool2, twoStepChain]);

      const result = await handler.callTool("sequential_chain", {
        input: "JSON 转换测试",
      });

      expect(result.isError).toBe(false);

      // 验证第二个工具接收到了包装后的输入
      const secondCall = vi.mocked(global.fetch).mock.calls[1];
      const secondRequestBody = JSON.parse(secondCall[1]?.body as string);

      expect(secondRequestBody.input).toBe("无效的 JSON 文本");
    });
  });
});

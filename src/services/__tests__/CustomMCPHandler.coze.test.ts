#!/usr/bin/env node

/**
 * CustomMCPHandler Coze 代理处理器测试
 * 测试 Coze API 代理功能的各种场景
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ProxyHandlerConfig } from "../../configManager.js";
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

// Mock fetch
global.fetch = vi.fn();

describe("CustomMCPHandler Coze 代理处理器测试", () => {
  let handler: CustomMCPHandler;

  const mockCozeWorkflowTool = {
    name: "test_coze_workflow",
    description: "测试 Coze 工作流",
    inputSchema: {
      type: "object",
      properties: {
        input: {
          type: "string",
          description: "用户输入",
        },
      },
      required: ["input"],
    },
    handler: {
      type: "proxy" as const,
      platform: "coze" as const,
      config: {
        workflow_id: "7513776469241741352",
        api_key: "test-api-key",
        base_url: "https://api.coze.cn",
        timeout: 30000,
      },
    } as ProxyHandlerConfig,
  };

  const mockCozeBotTool = {
    name: "test_coze_bot",
    description: "测试 Coze 聊天机器人",
    inputSchema: {
      type: "object",
      properties: {
        input: {
          type: "string",
          description: "用户输入",
        },
      },
      required: ["input"],
    },
    handler: {
      type: "proxy" as const,
      platform: "coze" as const,
      config: {
        bot_id: "7513776469241741353",
        api_key: "test-api-key",
        base_url: "https://api.coze.cn",
        timeout: 30000,
      },
    } as ProxyHandlerConfig,
  };

  beforeEach(() => {
    handler = new CustomMCPHandler();
    vi.clearAllMocks();
  });

  describe("Coze 工作流调用", () => {
    it("应该成功调用 Coze 工作流", async () => {
      const mockResponse = {
        data: {
          execute_status: "success",
          output: "工作流执行成功的结果",
        },
      };

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      } as Response);

      handler.initialize([mockCozeWorkflowTool]);

      const result = await handler.callTool("test_coze_workflow", {
        input: "测试输入",
      });

      expect(result.isError).toBe(false);
      expect(result.content).toHaveLength(1);
      expect(result.content[0].text).toBe("工作流执行成功的结果");

      // 验证请求参数
      expect(fetch).toHaveBeenCalledWith(
        "https://api.coze.cn/v1/workflow/run",
        expect.objectContaining({
          method: "POST",
          headers: expect.objectContaining({
            "Content-Type": "application/json",
            Authorization: "Bearer test-api-key",
          }),
          body: expect.stringContaining("7513776469241741352"),
        })
      );
    });

    it("应该处理工作流执行失败的情况", async () => {
      const mockResponse = {
        data: {
          execute_status: "failed",
          error_message: "工作流执行失败",
        },
      };

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      } as Response);

      handler.initialize([mockCozeWorkflowTool]);

      const result = await handler.callTool("test_coze_workflow", {
        input: "测试输入",
      });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("工作流执行失败");
    });

    it("应该处理工作流执行中的状态", async () => {
      const mockResponse = {
        data: {
          execute_status: "running",
        },
      };

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      } as Response);

      handler.initialize([mockCozeWorkflowTool]);

      const result = await handler.callTool("test_coze_workflow", {
        input: "测试输入",
      });

      expect(result.isError).toBe(false);
      expect(result.content[0].text).toContain("工作流状态: running");
    });
  });

  describe("Coze 聊天机器人调用", () => {
    it("应该成功调用 Coze 聊天机器人", async () => {
      const mockResponse = {
        messages: [
          {
            content: "这是机器人的回复",
            role: "assistant",
          },
        ],
      };

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      } as Response);

      handler.initialize([mockCozeBotTool]);

      const result = await handler.callTool("test_coze_bot", {
        input: "你好",
      });

      expect(result.isError).toBe(false);
      expect(result.content).toHaveLength(1);
      expect(result.content[0].text).toBe("这是机器人的回复");

      // 验证请求参数
      expect(fetch).toHaveBeenCalledWith(
        "https://api.coze.cn/v3/chat",
        expect.objectContaining({
          method: "POST",
          headers: expect.objectContaining({
            "Content-Type": "application/json",
            Authorization: "Bearer test-api-key",
          }),
          body: expect.stringContaining("7513776469241741353"),
        })
      );
    });

    it("应该处理空的聊天机器人响应", async () => {
      const mockResponse = {
        messages: [],
      };

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      } as Response);

      handler.initialize([mockCozeBotTool]);

      const result = await handler.callTool("test_coze_bot", {
        input: "你好",
      });

      expect(result.isError).toBe(false);
      expect(result.content[0].text).toBe('{\n  "messages": []\n}');
    });
  });

  describe("错误处理", () => {
    it("应该处理网络请求失败", async () => {
      vi.mocked(fetch).mockRejectedValueOnce(new Error("网络连接失败"));

      handler.initialize([mockCozeWorkflowTool]);

      const result = await handler.callTool("test_coze_workflow", {
        input: "测试输入",
      });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("Coze 工作流调用失败");
      expect(result.content[0].text).toContain("网络连接失败");
    });

    it("应该处理 HTTP 错误状态", async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: false,
        status: 401,
        text: () => Promise.resolve("Unauthorized"),
      } as Response);

      handler.initialize([mockCozeWorkflowTool]);

      const result = await handler.callTool("test_coze_workflow", {
        input: "测试输入",
      });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("Coze API 请求失败 (401)");
    });

    it("应该处理请求超时", async () => {
      // 模拟超时
      vi.mocked(fetch).mockImplementationOnce(() => {
        return new Promise((_, reject) => {
          setTimeout(() => reject(new Error("AbortError")), 100);
        });
      });

      const timeoutTool = {
        ...mockCozeWorkflowTool,
        handler: {
          ...mockCozeWorkflowTool.handler,
          config: {
            ...mockCozeWorkflowTool.handler.config,
            timeout: 50, // 很短的超时时间
          },
        },
      };

      handler.initialize([timeoutTool]);

      const result = await handler.callTool("test_coze_workflow", {
        input: "测试输入",
      });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("调用失败");
    });

    it("应该处理缺少必要配置的情况", async () => {
      const invalidTool = {
        ...mockCozeWorkflowTool,
        handler: {
          ...mockCozeWorkflowTool.handler,
          config: {
            // 缺少 workflow_id 和 bot_id
            api_key: "test-api-key",
          },
        },
      };

      handler.initialize([invalidTool]);

      const result = await handler.callTool("test_coze_workflow", {
        input: "测试输入",
      });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain(
        "必须提供 workflow_id 或 bot_id"
      );
    });
  });

  describe("参数处理", () => {
    it("应该正确处理复杂参数", async () => {
      const mockResponse = {
        data: {
          execute_status: "success",
          output: "处理成功",
        },
      };

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      } as Response);

      handler.initialize([mockCozeWorkflowTool]);

      const complexArgs = {
        input: "主要输入",
        metadata: {
          user_id: "12345",
          session_id: "abcdef",
        },
        options: ["option1", "option2"],
      };

      await handler.callTool("test_coze_workflow", complexArgs);

      // 验证请求体包含所有参数
      const callArgs = vi.mocked(fetch).mock.calls[0];
      const requestBody = JSON.parse(callArgs[1]?.body as string);

      expect(requestBody.query).toBe("主要输入");
      expect(requestBody.metadata).toEqual(complexArgs.metadata);
      expect(requestBody.options).toEqual(complexArgs.options);
    });

    it("应该处理没有 input 字段的参数", async () => {
      const mockResponse = {
        data: {
          execute_status: "success",
          output: "处理成功",
        },
      };

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      } as Response);

      handler.initialize([mockCozeWorkflowTool]);

      const args = {
        query: "直接查询",
        type: "search",
      };

      await handler.callTool("test_coze_workflow", args);

      // 验证参数处理：query 字段会覆盖序列化的值，其他字段也被添加
      const callArgs = vi.mocked(fetch).mock.calls[0];
      const requestBody = JSON.parse(callArgs[1]?.body as string);

      // query 字段会覆盖序列化的值
      expect(requestBody.query).toBe("直接查询");
      expect(requestBody.type).toBe("search");
    });
  });
});

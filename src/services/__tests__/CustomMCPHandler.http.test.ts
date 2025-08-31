#!/usr/bin/env node

/**
 * CustomMCPHandler HTTP 处理器测试
 * 测试 HTTP 工具的各种场景
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import type { HttpHandlerConfig } from "../../configManager.js";
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

describe("CustomMCPHandler HTTP 处理器测试", () => {
  let handler: CustomMCPHandler;

  const mockHttpTool = {
    name: "test_http_api",
    description: "测试 HTTP API 调用",
    inputSchema: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "查询参数",
        },
      },
      required: ["query"],
    },
    handler: {
      type: "http" as const,
      url: "https://api.example.com/search",
      method: "POST" as const,
      headers: {
        "X-Custom-Header": "test-value",
      },
      timeout: 30000,
      auth: {
        type: "bearer" as const,
        token: "test-token",
      },
    } as HttpHandlerConfig,
  };

  const mockGetTool = {
    name: "test_get_api",
    description: "测试 GET API 调用",
    inputSchema: {
      type: "object",
      properties: {
        id: {
          type: "string",
          description: "资源 ID",
        },
      },
      required: ["id"],
    },
    handler: {
      type: "http" as const,
      url: "https://api.example.com/resource",
      method: "GET" as const,
      auth: {
        type: "api_key" as const,
        api_key: "test-api-key",
        api_key_header: "X-API-Key",
      },
    } as HttpHandlerConfig,
  };

  beforeEach(() => {
    handler = new CustomMCPHandler();
    vi.clearAllMocks();
  });

  describe("POST 请求", () => {
    it("应该成功发送 POST 请求", async () => {
      const mockResponse = {
        success: true,
        data: {
          results: ["result1", "result2"],
        },
      };

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        headers: new Map([["content-type", "application/json"]]),
        json: () => Promise.resolve(mockResponse),
      } as any);

      handler.initialize([mockHttpTool]);

      const result = await handler.callTool("test_http_api", {
        query: "test search",
      });

      expect(result.isError).toBe(false);
      expect(result.content).toHaveLength(1);
      expect(result.content[0].text).toContain("result1");

      // 验证请求参数
      expect(fetch).toHaveBeenCalledWith(
        "https://api.example.com/search",
        expect.objectContaining({
          method: "POST",
          headers: expect.objectContaining({
            "Content-Type": "application/json",
            Authorization: "Bearer test-token",
            "X-Custom-Header": "test-value",
          }),
          body: JSON.stringify({ query: "test search" }),
        })
      );
    });

    it("应该处理模板变量替换", async () => {
      const templateTool = {
        ...mockHttpTool,
        handler: {
          ...mockHttpTool.handler,
          body_template: '{"search": "{{query}}", "user": "{{user_id}}"}',
        },
      };

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        headers: new Map([["content-type", "application/json"]]),
        json: () => Promise.resolve({ success: true }),
      } as any);

      handler.initialize([templateTool]);

      await handler.callTool("test_http_api", {
        query: "test search",
        user_id: "12345",
      });

      const callArgs = vi.mocked(fetch).mock.calls[0];
      const requestBody = callArgs[1]?.body as string;

      expect(requestBody).toBe('{"search": "test search", "user": "12345"}');
    });
  });

  describe("GET 请求", () => {
    it("应该成功发送 GET 请求并将参数添加到查询字符串", async () => {
      const mockResponse = {
        id: "123",
        name: "Test Resource",
      };

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        headers: new Map([["content-type", "application/json"]]),
        json: () => Promise.resolve(mockResponse),
      } as any);

      handler.initialize([mockGetTool]);

      const result = await handler.callTool("test_get_api", {
        id: "123",
        filter: "active",
      });

      expect(result.isError).toBe(false);
      expect(result.content[0].text).toContain("Test Resource");

      // 验证 URL 包含查询参数
      const callArgs = vi.mocked(fetch).mock.calls[0];
      const url = callArgs[0] as string;

      expect(url).toContain("id=123");
      expect(url).toContain("filter=active");
      expect(callArgs[1]?.method).toBe("GET");
      expect(callArgs[1]?.body).toBeUndefined();
    });

    it("应该正确设置 API Key 认证", async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        headers: new Map([["content-type", "application/json"]]),
        json: () => Promise.resolve({}),
      } as any);

      handler.initialize([mockGetTool]);

      await handler.callTool("test_get_api", { id: "123" });

      const callArgs = vi.mocked(fetch).mock.calls[0];
      const headers = callArgs[1]?.headers as Record<string, string>;

      expect(headers["X-API-Key"]).toBe("test-api-key");
    });
  });

  describe("认证方式", () => {
    it("应该支持 Basic 认证", async () => {
      const basicAuthTool = {
        ...mockHttpTool,
        handler: {
          ...mockHttpTool.handler,
          auth: {
            type: "basic" as const,
            username: "testuser",
            password: "testpass",
          },
        },
      };

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        headers: new Map([["content-type", "application/json"]]),
        json: () => Promise.resolve({}),
      } as any);

      handler.initialize([basicAuthTool]);

      await handler.callTool("test_http_api", { query: "test" });

      const callArgs = vi.mocked(fetch).mock.calls[0];
      const headers = callArgs[1]?.headers as Record<string, string>;

      // 验证 Basic 认证头
      expect(headers.Authorization).toBe(`Basic ${btoa("testuser:testpass")}`);
    });

    it("应该处理没有认证的情况", async () => {
      const noAuthTool = {
        ...mockHttpTool,
        handler: {
          ...mockHttpTool.handler,
          auth: undefined,
        },
      };

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        headers: new Map([["content-type", "application/json"]]),
        json: () => Promise.resolve({}),
      } as any);

      handler.initialize([noAuthTool]);

      await handler.callTool("test_http_api", { query: "test" });

      const callArgs = vi.mocked(fetch).mock.calls[0];
      const headers = callArgs[1]?.headers as Record<string, string>;

      expect(headers.Authorization).toBeUndefined();
    });
  });

  describe("响应处理", () => {
    it("应该处理文本响应", async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        headers: new Map([["content-type", "text/plain"]]),
        text: () => Promise.resolve("Plain text response"),
      } as any);

      handler.initialize([mockHttpTool]);

      const result = await handler.callTool("test_http_api", { query: "test" });

      expect(result.isError).toBe(false);
      expect(result.content[0].text).toBe("Plain text response");
    });

    it("应该使用响应映射提取数据", async () => {
      const mappingTool = {
        ...mockHttpTool,
        handler: {
          ...mockHttpTool.handler,
          response_mapping: {
            data_path: "data.results",
          },
        },
      };

      const mockResponse = {
        status: "success",
        data: {
          results: ["extracted", "data"],
        },
      };

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        headers: new Map([["content-type", "application/json"]]),
        json: () => Promise.resolve(mockResponse),
      } as any);

      handler.initialize([mappingTool]);

      const result = await handler.callTool("test_http_api", { query: "test" });

      expect(result.isError).toBe(false);
      expect(result.content[0].text).toContain("extracted");
      expect(result.content[0].text).toContain("data");
    });
  });

  describe("错误处理和重试", () => {
    it("应该处理 HTTP 错误状态", async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: false,
        status: 404,
        headers: new Map([["content-type", "application/json"]]),
        json: () => Promise.resolve({ error: "Not found" }),
      } as any);

      handler.initialize([mockHttpTool]);

      const result = await handler.callTool("test_http_api", { query: "test" });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("HTTP 请求失败 (404)");
    });

    it("应该实现重试机制", async () => {
      const retryTool = {
        ...mockHttpTool,
        handler: {
          ...mockHttpTool.handler,
          retry_count: 2,
          retry_delay: 100,
        },
      };

      // 前两次失败，第三次成功
      vi.mocked(fetch)
        .mockRejectedValueOnce(new Error("Network error"))
        .mockRejectedValueOnce(new Error("Network error"))
        .mockResolvedValueOnce({
          ok: true,
          headers: new Map([["content-type", "application/json"]]),
          json: () => Promise.resolve({ success: true }),
        } as any);

      handler.initialize([retryTool]);

      const result = await handler.callTool("test_http_api", { query: "test" });

      expect(result.isError).toBe(false);
      expect(fetch).toHaveBeenCalledTimes(3);
    });

    it("应该在重试次数用完后失败", async () => {
      const retryTool = {
        ...mockHttpTool,
        handler: {
          ...mockHttpTool.handler,
          retry_count: 1,
          retry_delay: 50,
        },
      };

      vi.mocked(fetch)
        .mockRejectedValueOnce(new Error("Network error"))
        .mockRejectedValueOnce(new Error("Network error"));

      handler.initialize([retryTool]);

      const result = await handler.callTool("test_http_api", { query: "test" });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("Network error");
      expect(fetch).toHaveBeenCalledTimes(2);
    });

    it("应该处理请求超时", async () => {
      const timeoutTool = {
        ...mockHttpTool,
        handler: {
          ...mockHttpTool.handler,
          timeout: 100,
        },
      };

      vi.mocked(fetch).mockImplementationOnce(() => {
        return new Promise((_, reject) => {
          setTimeout(() => reject(new Error("Request timeout")), 200);
        });
      });

      handler.initialize([timeoutTool]);

      const result = await handler.callTool("test_http_api", { query: "test" });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("Request timeout");
    });
  });

  describe("参数验证", () => {
    it("应该处理空参数", async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        headers: new Map([["content-type", "application/json"]]),
        json: () => Promise.resolve({}),
      } as any);

      handler.initialize([mockHttpTool]);

      const result = await handler.callTool("test_http_api", {});

      expect(result.isError).toBe(false);

      const callArgs = vi.mocked(fetch).mock.calls[0];
      const requestBody = JSON.parse(callArgs[1]?.body as string);

      expect(requestBody).toEqual({});
    });

    it("应该过滤 null 和 undefined 的查询参数", async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        headers: new Map([["content-type", "application/json"]]),
        json: () => Promise.resolve({}),
      } as any);

      handler.initialize([mockGetTool]);

      await handler.callTool("test_get_api", {
        id: "123",
        filter: null,
        sort: undefined,
        active: true,
      });

      const callArgs = vi.mocked(fetch).mock.calls[0];
      const url = callArgs[0] as string;

      expect(url).toContain("id=123");
      expect(url).toContain("active=true");
      expect(url).not.toContain("filter=");
      expect(url).not.toContain("sort=");
    });
  });
});

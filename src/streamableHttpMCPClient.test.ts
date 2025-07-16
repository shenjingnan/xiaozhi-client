import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  type StreamableHTTPMCPServerConfig,
  configManager,
} from "./configManager";
import { StreamableHTTPMCPClient } from "./streamableHttpMCPClient";

// Mock node-fetch
vi.mock("node-fetch", () => ({
  default: vi.fn(),
}));

// Mock configManager
vi.mock("./configManager", () => ({
  configManager: {
    isToolEnabled: vi.fn().mockReturnValue(true),
    getServerToolsConfig: vi.fn().mockReturnValue({}),
    updateServerToolsConfig: vi.fn(),
  },
}));

// Mock logger
vi.mock("./logger", () => ({
  logger: {
    withTag: () => ({
      info: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
    }),
  },
}));

describe("StreamableHTTPMCPClient", () => {
  let client: StreamableHTTPMCPClient;
  let mockFetch: any;
  const mockConfig: StreamableHTTPMCPServerConfig = {
    url: "https://example.com/mcp",
  };

  beforeEach(async () => {
    // 获取 mock 的 fetch
    const nodeFetch = await import("node-fetch");
    mockFetch = nodeFetch.default;
    mockFetch.mockClear();

    client = new StreamableHTTPMCPClient("test-server", mockConfig);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("constructor", () => {
    it("应该正确初始化客户端", () => {
      expect(client).toBeDefined();
      expect(client.initialized).toBe(false);
      expect(client.tools).toEqual([]);
      expect(client.originalTools).toEqual([]);
    });
  });

  describe("generatePrefixedToolName", () => {
    it("应该生成带前缀的工具名称", () => {
      const originalName = "test_tool";
      const prefixedName = (client as any).generatePrefixedToolName(
        originalName
      );
      expect(prefixedName).toBe("test_server_xzcli_test_tool");
    });

    it("应该处理带连字符的服务名", () => {
      const clientWithHyphen = new StreamableHTTPMCPClient(
        "test-server-name",
        mockConfig
      );
      const originalName = "test_tool";
      const prefixedName = (clientWithHyphen as any).generatePrefixedToolName(
        originalName
      );
      expect(prefixedName).toBe("test_server_name_xzcli_test_tool");
    });
  });

  describe("getOriginalToolName", () => {
    it("应该从带前缀的名称中提取原始名称", () => {
      const prefixedName = "test_server_xzcli_test_tool";
      const originalName = client.getOriginalToolName(prefixedName);
      expect(originalName).toBe("test_tool");
    });

    it("应该处理无效的前缀名称", () => {
      const invalidName = "invalid_name";
      const result = client.getOriginalToolName(invalidName);
      expect(result).toBeNull();
    });
  });

  describe("sendRequest", () => {
    it("应该发送正确格式的 JSON-RPC 请求", async () => {
      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({
          jsonrpc: "2.0",
          id: 1,
          result: { test: "data" },
        }),
      };
      mockFetch.mockResolvedValue(mockResponse);

      const result = await (client as any).sendRequest("test/method", {
        param: "value",
      });

      expect(mockFetch).toHaveBeenCalledWith(mockConfig.url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json, text/event-stream",
        },
        body: expect.stringContaining('"method":"test/method"'),
      });

      expect(result).toEqual({ test: "data" });
    });

    it("应该处理 HTTP 错误", async () => {
      const mockResponse = {
        ok: false,
        status: 500,
      };
      mockFetch.mockResolvedValue(mockResponse);

      await expect(
        (client as any).sendRequest("test/method", {})
      ).rejects.toThrow("HTTP error! status: 500");
    });

    it("应该处理 JSON-RPC 错误", async () => {
      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({
          jsonrpc: "2.0",
          id: 1,
          error: {
            code: -32601,
            message: "Method not found",
          },
        }),
      };
      mockFetch.mockResolvedValue(mockResponse);

      await expect(
        (client as any).sendRequest("test/method", {})
      ).rejects.toThrow("JSON-RPC error: Method not found (code: -32601)");
    });
  });

  describe("start", () => {
    it("应该成功初始化客户端并获取工具列表", async () => {
      const mockTools = [
        { name: "tool1", description: "Tool 1" },
        { name: "tool2", description: "Tool 2" },
      ];

      const responses = [
        // initialize 响应
        {
          jsonrpc: "2.0",
          id: 1,
          result: {
            protocolVersion: "2024-11-05",
            capabilities: {},
          },
        },
        // notifications/initialized 响应（现在是通知，可能返回空响应或错误）
        {
          ok: true, // HTTP 200 但可能没有有意义的JSON响应
        },
        // tools/list 响应
        {
          jsonrpc: "2.0",
          id: 2, // 现在是id 2因为通知不占用id
          result: {
            tools: mockTools,
          },
        },
      ];

      let callIndex = 0;
      mockFetch.mockImplementation(() => {
        const response = responses[callIndex++];
        if (callIndex === 2) {
          // notifications/initialized 调用 - 返回空响应
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({}),
          });
        }
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(response),
        });
      });

      await client.start();

      expect(client.initialized).toBe(true);
      expect(client.originalTools).toEqual(mockTools);
      expect(client.tools).toHaveLength(2);
      expect(client.tools[0].name).toBe("test_server_xzcli_tool1");
      expect(client.tools[1].name).toBe("test_server_xzcli_tool2");

      // 验证配置更新被调用
      expect(configManager.updateServerToolsConfig).toHaveBeenCalledWith(
        "test-server",
        {
          tool1: {
            description: "Tool 1",
            enable: true,
          },
          tool2: {
            description: "Tool 2",
            enable: true,
          },
        }
      );
    });

    it("应该处理初始化失败", async () => {
      mockFetch.mockRejectedValue(new Error("Network error"));

      await expect(client.start()).rejects.toThrow("Network error");
      expect(client.initialized).toBe(false);
    });
  });

  describe("refreshTools", () => {
    it("应该刷新工具列表", async () => {
      const mockTools = [
        { name: "tool1", description: "Tool 1" },
        { name: "tool3", description: "Tool 3" },
      ];

      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({
          jsonrpc: "2.0",
          id: 1,
          result: {
            tools: mockTools,
          },
        }),
      };
      mockFetch.mockResolvedValue(mockResponse);

      await client.refreshTools();

      expect(client.originalTools).toEqual(mockTools);
      expect(client.tools).toHaveLength(2);
    });

    it("应该处理刷新失败", async () => {
      mockFetch.mockRejectedValue(new Error("Refresh failed"));

      // refreshTools 不会抛出错误，只会记录日志
      await expect(client.refreshTools()).resolves.not.toThrow();
    });

    it("应该在刷新工具时更新配置", async () => {
      const mockTools = [
        { name: "tool1", description: "Tool 1" },
        { name: "tool2", description: "Tool 2" },
      ];

      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({
          jsonrpc: "2.0",
          id: 1,
          result: {
            tools: mockTools,
          },
        }),
      };
      mockFetch.mockResolvedValue(mockResponse);

      await client.refreshTools();

      // 验证配置更新被调用
      expect(configManager.updateServerToolsConfig).toHaveBeenCalledWith(
        "test-server",
        {
          tool1: {
            description: "Tool 1",
            enable: true,
          },
          tool2: {
            description: "Tool 2",
            enable: true,
          },
        }
      );
    });
  });

  describe("callTool", () => {
    beforeEach(async () => {
      // 先初始化客户端
      client.originalTools = [{ name: "test_tool" }];
      client.tools = [{ name: "test_server_xzcli_test_tool" }];
      client.initialized = true;
    });

    it("应该成功调用工具", async () => {
      const mockResult = { output: "Success" };
      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({
          jsonrpc: "2.0",
          id: 1,
          result: mockResult,
        }),
      };
      mockFetch.mockResolvedValue(mockResponse);

      const result = await client.callTool("test_server_xzcli_test_tool", {
        input: "test",
      });

      expect(mockFetch).toHaveBeenCalledWith(mockConfig.url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json, text/event-stream",
        },
        body: expect.stringContaining('"name":"test_tool"'),
      });

      expect(result).toEqual(mockResult);
    });

    it("应该处理无效的工具名称", async () => {
      await expect(client.callTool("invalid_tool_name", {})).rejects.toThrow(
        "无效的工具名称格式：invalid_tool_name"
      );
    });

    it("应该处理工具调用失败", async () => {
      mockFetch.mockRejectedValue(new Error("Tool call failed"));

      await expect(
        client.callTool("test_server_xzcli_test_tool", {})
      ).rejects.toThrow("Tool call failed");
    });
  });

  describe("stop", () => {
    it("应该正确停止客户端", async () => {
      client.initialized = true;

      await client.stop();

      expect(client.initialized).toBe(false);
    });
  });

  describe("配置类型支持", () => {
    it("应该支持带 type 字段的配置", () => {
      const configWithType: StreamableHTTPMCPServerConfig = {
        type: "streamable-http",
        url: "https://example.com/mcp",
      };

      const clientWithType = new StreamableHTTPMCPClient(
        "test",
        configWithType
      );
      expect(clientWithType).toBeDefined();
    });

    it("应该支持不带 type 字段的配置", () => {
      const configWithoutType: StreamableHTTPMCPServerConfig = {
        url: "https://example.com/mcp",
      };

      const clientWithoutType = new StreamableHTTPMCPClient(
        "test",
        configWithoutType
      );
      expect(clientWithoutType).toBeDefined();
    });
  });
});

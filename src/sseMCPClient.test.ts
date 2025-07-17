import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SSEMCPServerConfig } from "./configManager";
import { SSEMCPClient } from "./sseMCPClient";

// Mock dependencies
vi.mock("@modelcontextprotocol/sdk/client/index.js", () => ({
  Client: vi.fn().mockImplementation(() => ({
    connect: vi.fn(),
    listTools: vi.fn(),
    callTool: vi.fn(),
    close: vi.fn(),
  })),
}));

vi.mock("@modelcontextprotocol/sdk/client/sse.js", () => ({
  SSEClientTransport: vi.fn(),
}));

vi.mock("eventsource", () => ({
  EventSource: vi.fn(),
}));

vi.mock("./configManager", () => ({
  configManager: {
    isToolEnabled: vi.fn().mockReturnValue(true),
    getServerToolsConfig: vi.fn().mockReturnValue({}),
    updateServerToolsConfig: vi.fn(),
  },
}));

vi.mock("./logger", () => ({
  logger: {
    withTag: vi.fn().mockReturnValue({
      info: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
    }),
  },
}));

describe("SSEMCPClient", () => {
  let client: SSEMCPClient;
  let mockConfig: SSEMCPServerConfig;

  beforeEach(() => {
    mockConfig = {
      type: "sse",
      url: "https://example.com/sse",
    };
    client = new SSEMCPClient("test-sse", mockConfig);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("构造函数", () => {
    it("应该正确初始化客户端", () => {
      expect(client).toBeDefined();
      expect(client.initialized).toBe(false);
      expect(client.tools).toEqual([]);
      expect(client.originalTools).toEqual([]);
    });
  });

  describe("getOriginalToolName", () => {
    it("应该正确提取原始工具名称", () => {
      const prefixedName = "test_sse_xzcli_search";
      const originalName = client.getOriginalToolName(prefixedName);
      expect(originalName).toBe("search");
    });

    it("应该处理带连字符的服务名称", () => {
      const clientWithHyphens = new SSEMCPClient(
        "test-sse-service",
        mockConfig
      );
      const prefixedName = "test_sse_service_xzcli_search";
      const originalName = clientWithHyphens.getOriginalToolName(prefixedName);
      expect(originalName).toBe("search");
    });

    it("应该对无效格式返回 null", () => {
      const invalidName = "invalid_tool_name";
      const originalName = client.getOriginalToolName(invalidName);
      expect(originalName).toBeNull();
    });
  });

  describe("start", () => {
    it("应该成功启动 SSE 客户端", async () => {
      const { Client } = await import(
        "@modelcontextprotocol/sdk/client/index.js"
      );
      const { SSEClientTransport } = await import(
        "@modelcontextprotocol/sdk/client/sse.js"
      );

      const mockClient = {
        connect: vi.fn().mockResolvedValue(undefined),
        listTools: vi.fn().mockResolvedValue({
          tools: [
            { name: "search", description: "Search tool" },
            { name: "weather", description: "Weather tool" },
          ],
        }),
      };

      vi.mocked(Client).mockImplementation(() => mockClient as any);
      vi.mocked(SSEClientTransport).mockImplementation(() => ({}) as any);

      await client.start();

      expect(client.initialized).toBe(true);
      expect(client.originalTools).toHaveLength(2);
      expect(client.tools).toHaveLength(2);
      expect(SSEClientTransport).toHaveBeenCalledWith(new URL(mockConfig.url));
      expect(mockClient.connect).toHaveBeenCalled();
    });

    it("应该处理启动失败的情况", async () => {
      const { Client } = await import(
        "@modelcontextprotocol/sdk/client/index.js"
      );

      const mockClient = {
        connect: vi.fn().mockRejectedValue(new Error("Connection failed")),
      };

      vi.mocked(Client).mockImplementation(() => mockClient as any);

      await expect(client.start()).rejects.toThrow("Connection failed");
      expect(client.initialized).toBe(false);
    });
  });

  describe("callTool", () => {
    beforeEach(async () => {
      const { Client } = await import(
        "@modelcontextprotocol/sdk/client/index.js"
      );
      const mockClient = {
        connect: vi.fn().mockResolvedValue(undefined),
        listTools: vi.fn().mockResolvedValue({
          tools: [{ name: "search", description: "Search tool" }],
        }),
        callTool: vi.fn().mockResolvedValue({ result: "success" }),
      };

      vi.mocked(Client).mockImplementation(() => mockClient as any);
      await client.start();
    });

    it("应该成功调用工具", async () => {
      const { Client } = await import(
        "@modelcontextprotocol/sdk/client/index.js"
      );
      const mockClient = vi.mocked(Client).mock.results[0].value;

      const result = await client.callTool("test_sse_xzcli_search", {
        query: "test",
      });

      expect(mockClient.callTool).toHaveBeenCalledWith({
        name: "search",
        arguments: { query: "test" },
      });
      expect(result).toEqual({ result: "success" });
    });

    it("应该处理无效工具名称", async () => {
      await expect(client.callTool("invalid_tool", {})).rejects.toThrow(
        "无效的工具名称格式：invalid_tool"
      );
    });

    it("应该处理未初始化的客户端", async () => {
      const uninitializedClient = new SSEMCPClient("test", mockConfig);

      await expect(
        uninitializedClient.callTool("test_sse_xzcli_search", {})
      ).rejects.toThrow("客户端未初始化");
    });
  });

  describe("stop", () => {
    it("应该成功停止客户端", async () => {
      const { Client } = await import(
        "@modelcontextprotocol/sdk/client/index.js"
      );
      const mockClient = {
        connect: vi.fn().mockResolvedValue(undefined),
        listTools: vi.fn().mockResolvedValue({ tools: [] }),
        close: vi.fn().mockResolvedValue(undefined),
      };

      vi.mocked(Client).mockImplementation(() => mockClient as any);
      await client.start();
      await client.stop();

      expect(mockClient.close).toHaveBeenCalled();
      expect(client.initialized).toBe(false);
    });

    it("应该处理停止过程中的错误", async () => {
      const { Client } = await import(
        "@modelcontextprotocol/sdk/client/index.js"
      );
      const mockClient = {
        connect: vi.fn().mockResolvedValue(undefined),
        listTools: vi.fn().mockResolvedValue({ tools: [] }),
        close: vi.fn().mockRejectedValue(new Error("Close failed")),
      };

      vi.mocked(Client).mockImplementation(() => mockClient as any);
      await client.start();

      // 应该不抛出错误，只是记录日志
      await expect(client.stop()).resolves.not.toThrow();
      expect(client.initialized).toBe(false);
    });
  });

  describe("refreshTools", () => {
    it("应该成功刷新工具列表", async () => {
      const { Client } = await import(
        "@modelcontextprotocol/sdk/client/index.js"
      );
      const mockClient = {
        connect: vi.fn().mockResolvedValue(undefined),
        listTools: vi
          .fn()
          .mockResolvedValueOnce({ tools: [{ name: "tool1" }] })
          .mockResolvedValueOnce({
            tools: [{ name: "tool1" }, { name: "tool2" }],
          }),
      };

      vi.mocked(Client).mockImplementation(() => mockClient as any);
      await client.start();

      expect(client.originalTools).toHaveLength(1);

      await client.refreshTools();

      expect(client.originalTools).toHaveLength(2);
      expect(mockClient.listTools).toHaveBeenCalledTimes(2);
    });

    it("应该处理未初始化的客户端", async () => {
      await expect(client.refreshTools()).rejects.toThrow("客户端未初始化");
    });
  });
});

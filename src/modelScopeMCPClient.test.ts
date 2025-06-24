import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SSEMCPServerConfig } from "./configManager";
import { ModelScopeMCPClient } from "./modelScopeMCPClient";

// Mock dependencies
vi.mock("@modelcontextprotocol/sdk/client/index.js", () => ({
  Client: vi.fn().mockImplementation(() => ({
    connect: vi.fn().mockResolvedValue(undefined),
    close: vi.fn().mockResolvedValue(undefined),
    listTools: vi.fn().mockResolvedValue({
      tools: [
        {
          name: "test-tool",
          description: "A test tool",
          inputSchema: {
            type: "object",
            properties: {
              input: { type: "string" },
            },
          },
        },
      ],
    }),
    callTool: vi.fn().mockResolvedValue({
      content: [{ type: "text", text: "Tool result" }],
    }),
  })),
}));

vi.mock("@modelcontextprotocol/sdk/client/sse.js", () => ({
  SSEClientTransport: vi.fn().mockImplementation(() => ({})),
}));

vi.mock("eventsource", () => ({
  EventSource: vi.fn().mockImplementation(() => ({})),
}));

describe("ModelScopeMCPClient", () => {
  let client: ModelScopeMCPClient;
  const testConfig: SSEMCPServerConfig = {
    type: "sse",
    url: "https://mcp.api-inference.modelscope.net/test/sse",
  };
  let originalToken: string | undefined;

  beforeEach(() => {
    // 保存原始环境变量
    originalToken = process.env.MODELSCOPE_API_TOKEN;
    // 设置环境变量
    process.env.MODELSCOPE_API_TOKEN = "test-token";
    client = new ModelScopeMCPClient("test-server", testConfig);
  });

  afterEach(() => {
    // 恢复原始环境变量
    if (originalToken === undefined) {
      process.env.MODELSCOPE_API_TOKEN = undefined as any;
    } else {
      process.env.MODELSCOPE_API_TOKEN = originalToken;
    }
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

  describe("start", () => {
    it("应该成功启动客户端", async () => {
      await client.start();

      expect(client.initialized).toBe(true);
      expect(client.tools).toHaveLength(1);
      expect(client.tools[0].name).toBe("test_server_xzcli_test-tool");
      expect(client.originalTools).toHaveLength(1);
      expect(client.originalTools[0].name).toBe("test-tool");
    });

    it("应该在没有 API Token 时抛出错误", async () => {
      process.env.MODELSCOPE_API_TOKEN = "" as any;

      await expect(client.start()).rejects.toThrow(
        "未设置 MODELSCOPE_API_TOKEN 环境变量"
      );
    });

    it("应该处理连接失败", async () => {
      const { Client } = await import(
        "@modelcontextprotocol/sdk/client/index.js"
      );
      const mockConnect = vi
        .fn()
        .mockRejectedValue(new Error("Connection failed"));
      (Client as any).mockImplementation(() => ({
        connect: mockConnect,
      }));

      await expect(client.start()).rejects.toThrow("Connection failed");
      expect(client.initialized).toBe(false);
    });
  });

  describe("getOriginalToolName", () => {
    it("应该正确解析带前缀的工具名称", () => {
      const prefixedName = "test_server_xzcli_my-tool";
      const originalName = client.getOriginalToolName(prefixedName);
      expect(originalName).toBe("my-tool");
    });

    it("应该对无效的前缀返回 null", () => {
      const invalidName = "invalid_prefix_my-tool";
      const originalName = client.getOriginalToolName(invalidName);
      expect(originalName).toBeNull();
    });

    it("应该处理带连字符的服务器名称", () => {
      const clientWithHyphen = new ModelScopeMCPClient(
        "test-server-name",
        testConfig
      );
      const prefixedName = "test_server_name_xzcli_my-tool";
      const originalName = clientWithHyphen.getOriginalToolName(prefixedName);
      expect(originalName).toBe("my-tool");
    });
  });

  describe("callTool", () => {
    beforeEach(async () => {
      // 重置 mock
      vi.clearAllMocks();
      const { Client } = await import(
        "@modelcontextprotocol/sdk/client/index.js"
      );
      (Client as any).mockImplementation(() => ({
        connect: vi.fn().mockResolvedValue(undefined),
        close: vi.fn().mockResolvedValue(undefined),
        listTools: vi.fn().mockResolvedValue({
          tools: [
            {
              name: "test-tool",
              description: "A test tool",
              inputSchema: {
                type: "object",
                properties: {
                  input: { type: "string" },
                },
              },
            },
          ],
        }),
        callTool: vi.fn().mockResolvedValue({
          content: [{ type: "text", text: "Tool result" }],
        }),
      }));

      // 重新创建客户端并启动
      client = new ModelScopeMCPClient("test-server", testConfig);
      await client.start();
    });

    it("应该成功调用工具", async () => {
      const result = await client.callTool("test_server_xzcli_test-tool", {
        input: "test",
      });

      expect(result).toEqual({
        content: [{ type: "text", text: "Tool result" }],
      });
    });

    it("应该在客户端未初始化时抛出错误", async () => {
      await client.stop();

      await expect(
        client.callTool("test_server_xzcli_test-tool", {})
      ).rejects.toThrow("客户端未初始化");
    });

    it("应该在工具名称格式无效时抛出错误", async () => {
      await expect(client.callTool("invalid-tool-name", {})).rejects.toThrow(
        "无效的工具名称格式"
      );
    });
  });

  describe("refreshTools", () => {
    beforeEach(async () => {
      // 重置 mock
      vi.clearAllMocks();
      const { Client } = await import(
        "@modelcontextprotocol/sdk/client/index.js"
      );
      (Client as any).mockImplementation(() => ({
        connect: vi.fn().mockResolvedValue(undefined),
        close: vi.fn().mockResolvedValue(undefined),
        listTools: vi.fn().mockResolvedValue({
          tools: [
            {
              name: "test-tool",
              description: "A test tool",
              inputSchema: {
                type: "object",
                properties: {
                  input: { type: "string" },
                },
              },
            },
          ],
        }),
        callTool: vi.fn().mockResolvedValue({
          content: [{ type: "text", text: "Tool result" }],
        }),
      }));

      // 重新创建客户端并启动
      client = new ModelScopeMCPClient("test-server", testConfig);
      await client.start();
    });

    it("应该刷新工具列表", async () => {
      const { Client } = await import(
        "@modelcontextprotocol/sdk/client/index.js"
      );
      const mockListTools = vi.fn().mockResolvedValue({
        tools: [
          {
            name: "new-tool",
            description: "A new tool",
          },
        ],
      });

      const mockClient = (client as any).client;
      mockClient.listTools = mockListTools;

      await client.refreshTools();

      expect(client.tools).toHaveLength(1);
      expect(client.tools[0].name).toBe("test_server_xzcli_new-tool");
    });

    it("应该处理刷新工具失败的情况", async () => {
      const mockClient = (client as any).client;
      mockClient.listTools = vi
        .fn()
        .mockRejectedValue(new Error("List tools failed"));

      await client.refreshTools();

      expect(client.tools).toEqual([]);
      expect(client.originalTools).toEqual([]);
    });
  });

  describe("stop", () => {
    beforeEach(async () => {
      // 重置 mock
      vi.clearAllMocks();
      const { Client } = await import(
        "@modelcontextprotocol/sdk/client/index.js"
      );
      (Client as any).mockImplementation(() => ({
        connect: vi.fn().mockResolvedValue(undefined),
        close: vi.fn().mockResolvedValue(undefined),
        listTools: vi.fn().mockResolvedValue({
          tools: [
            {
              name: "test-tool",
              description: "A test tool",
              inputSchema: {
                type: "object",
                properties: {
                  input: { type: "string" },
                },
              },
            },
          ],
        }),
        callTool: vi.fn().mockResolvedValue({
          content: [{ type: "text", text: "Tool result" }],
        }),
      }));

      // 重新创建客户端并启动
      client = new ModelScopeMCPClient("test-server", testConfig);
      await client.start();
    });

    it("应该正确停止客户端", async () => {
      await client.stop();

      expect(client.initialized).toBe(false);
    });

    it("应该处理停止时的错误", async () => {
      const mockClient = (client as any).client;
      mockClient.close = vi.fn().mockRejectedValue(new Error("Close failed"));

      // 不应该抛出错误
      await expect(client.stop()).resolves.not.toThrow();
      expect(client.initialized).toBe(false);
    });
  });
});

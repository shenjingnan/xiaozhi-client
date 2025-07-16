import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { type SSEMCPServerConfig, configManager } from "./configManager";
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

// Mock configManager
vi.mock("./configManager", async () => {
  const actual =
    await vi.importActual<typeof import("./configManager")>("./configManager");
  return {
    ...actual,
    configManager: {
      getModelScopeApiKey: vi.fn().mockReturnValue("test-token"),
      isToolEnabled: vi.fn().mockReturnValue(true),
      getServerToolsConfig: vi.fn().mockReturnValue({}),
      updateServerToolsConfig: vi.fn(),
    },
  };
});

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
    // 清除环境变量，确保使用 mock 的配置
    process.env.MODELSCOPE_API_TOKEN = undefined as any;

    // 重置 mock
    vi.mocked(configManager.getModelScopeApiKey).mockReturnValue("test-token");
    vi.mocked(configManager.isToolEnabled).mockReturnValue(true);
    vi.mocked(configManager.getServerToolsConfig).mockReturnValue({});
    vi.mocked(configManager.updateServerToolsConfig).mockImplementation(
      () => {}
    );

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
      vi.mocked(configManager.getModelScopeApiKey).mockReturnValue("");

      await expect(client.start()).rejects.toThrow("未设置 ModelScope API Key");
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

    it("应该刷新工具列表并更新配置", async () => {
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
      expect(client.originalTools).toHaveLength(1);
      expect(client.originalTools[0].name).toBe("new-tool");

      // 验证配置更新被调用
      expect(configManager.updateServerToolsConfig).toHaveBeenCalledWith(
        "test-server",
        {
          "new-tool": {
            description: "A new tool",
            enable: true,
          },
        }
      );
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

  describe("filterEnabledTools", () => {
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
              name: "enabled-tool",
              description: "An enabled tool",
            },
            {
              name: "disabled-tool",
              description: "A disabled tool",
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

    it("应该过滤出启用的工具", async () => {
      // 设置 mock：enabled-tool 启用，disabled-tool 禁用
      vi.mocked(configManager.isToolEnabled).mockImplementation(
        (serverName: string, toolName: string) => {
          return toolName === "enabled-tool";
        }
      );

      await client.refreshTools();

      expect(client.tools).toHaveLength(1);
      expect(client.tools[0].name).toBe("test_server_xzcli_enabled-tool");
      expect(client.originalTools).toHaveLength(2); // 原始工具列表不变
    });

    it("应该在无法解析工具名称时默认启用工具", async () => {
      // 创建一个无效前缀的工具
      const invalidPrefixedTool = {
        name: "invalid_prefix_tool",
        description: "Invalid prefixed tool",
      };

      // 直接调用 filterEnabledTools 方法
      const result = (client as any).filterEnabledTools([invalidPrefixedTool]);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual(invalidPrefixedTool);
    });
  });

  describe("updateToolsConfig", () => {
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
              name: "tool1",
              description: "First tool",
            },
            {
              name: "tool2",
              description: "Second tool",
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

    it("应该更新工具配置", async () => {
      // 设置现有配置为空
      vi.mocked(configManager.getServerToolsConfig).mockReturnValue({});

      await client.refreshTools();

      expect(configManager.updateServerToolsConfig).toHaveBeenCalledWith(
        "test-server",
        {
          tool1: {
            description: "First tool",
            enable: true,
          },
          tool2: {
            description: "Second tool",
            enable: true,
          },
        }
      );
    });

    it("应该保留现有工具的启用状态", async () => {
      // 设置现有配置
      vi.mocked(configManager.getServerToolsConfig).mockReturnValue({
        tool1: {
          description: "Old description",
          enable: false, // 已禁用
        },
      });

      await client.refreshTools();

      expect(configManager.updateServerToolsConfig).toHaveBeenCalledWith(
        "test-server",
        {
          tool1: {
            description: "First tool", // 描述会更新
            enable: false, // 启用状态保持不变
          },
          tool2: {
            description: "Second tool",
            enable: true, // 新工具默认启用
          },
        }
      );
    });

    it("应该在没有配置变化时跳过更新", async () => {
      // 先调用一次 refreshTools 来建立初始配置
      await client.refreshTools();

      // 清除之前的调用记录
      vi.mocked(configManager.updateServerToolsConfig).mockClear();

      // 设置现有配置与新配置相同
      vi.mocked(configManager.getServerToolsConfig).mockReturnValue({
        tool1: {
          description: "First tool",
          enable: true,
        },
        tool2: {
          description: "Second tool",
          enable: true,
        },
      });

      // 再次调用 refreshTools
      await client.refreshTools();

      // 应该不会调用更新方法
      expect(configManager.updateServerToolsConfig).not.toHaveBeenCalled();
    });

    it("应该处理更新配置时的错误", async () => {
      // 设置更新方法抛出错误
      vi.mocked(configManager.updateServerToolsConfig).mockImplementation(
        () => {
          throw new Error("Update failed");
        }
      );

      // 不应该抛出错误，应该被捕获并记录
      await expect(client.refreshTools()).resolves.not.toThrow();
    });
  });
});

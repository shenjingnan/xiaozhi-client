import { EventEmitter } from "node:events";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { WebServer } from "../../WebServer.js";

// 模拟 configManager
vi.mock("@xiaozhi-client/config", () => ({
  configManager: {
    configExists: vi.fn().mockReturnValue(true),
    getConfig: vi.fn().mockReturnValue({}),
    getMcpEndpoint: vi.fn().mockReturnValue(""),
    getMcpServers: vi.fn().mockReturnValue({}),
    updateMcpEndpoint: vi.fn(),
    updateMcpServer: vi.fn(),
    removeMcpServer: vi.fn(),
    updateConnectionConfig: vi.fn(),
    updateModelScopeConfig: vi.fn(),
    updateWebUIConfig: vi.fn(),
    getWebUIPort: vi.fn().mockReturnValue(3001),
    setToolEnabled: vi.fn(),
    removeServerToolsConfig: vi.fn(),
    cleanupInvalidServerToolsConfig: vi.fn(),
    getToolCallLogConfig: vi.fn().mockReturnValue({}),
    getConfigDir: vi.fn().mockReturnValue("/tmp"),
    getLLMConfig: vi.fn(() => null),
    isLLMConfigValid: vi.fn(() => false),
    getTTSConfig: vi.fn(() => ({})),
    getASRConfig: vi.fn(() => ({})),
  },
}));

// Mock MCPMessageHandler 和 MCPServiceManager
vi.mock("@/lib/mcp", () => ({
  MCPMessageHandler: vi.fn().mockImplementation(() => ({
    handleMessage: vi.fn().mockImplementation((message) => {
      return Promise.resolve({
        jsonrpc: "2.0",
        result: {
          protocolVersion: "2024-11-05",
          capabilities: {},
          serverInfo: { name: "xiaozhi-client", version: "1.0.0" },
        },
        id: message.id, // 返回请求中的 ID
      });
    }),
  })),

  MCPServiceManager: vi.fn().mockImplementation(() => {
    const instance = {
      start: vi.fn().mockResolvedValue(undefined),
      stop: vi.fn().mockResolvedValue(undefined),
      isRunning: true,
      tools: new Map(),
      services: new Map(),
      on: vi.fn(),
      off: vi.fn(),
      emit: vi.fn(),
      removeAllListeners: vi.fn(),
      listTools: vi.fn().mockResolvedValue([]),
      callTool: vi.fn().mockResolvedValue({ content: [] }),
      addService: vi.fn(),
      removeService: vi.fn(),
      getServiceStatus: vi.fn().mockReturnValue("connected"),
      getAllTools: vi.fn().mockReturnValue([]),
      stopAllServices: vi.fn().mockResolvedValue(undefined),
      whenReady: vi.fn().mockResolvedValue(undefined),
    };
    Object.setPrototypeOf(instance, EventEmitter.prototype);
    return instance;
  }),
}));

describe("MCPRouteHandler 集成测试", () => {
  let webServer: WebServer;
  let serverPort: number;
  let baseUrl: string;

  beforeAll(async () => {
    // 使用随机端口避免冲突
    serverPort = 9000 + Math.floor(Math.random() * 1000);
    baseUrl = `http://localhost:${serverPort}`;

    webServer = new WebServer(serverPort);
    await webServer.start();

    // 等待服务器完全启动
    await new Promise((resolve) => setTimeout(resolve, 1000));
  });

  afterAll(async () => {
    if (webServer) {
      await webServer.stop();
    }
  });

  describe("MCP 端点可用性", () => {
    it("应该响应 /mcp 端点的 POST 请求", async () => {
      const response = await fetch(`${baseUrl}/mcp`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "MCP-Protocol-Version": "2024-11-05",
        },
        body: JSON.stringify({
          jsonrpc: "2.0",
          method: "initialize",
          id: 1,
          params: {
            protocolVersion: "2024-11-05",
            capabilities: {},
            clientInfo: { name: "test-client", version: "1.0.0" },
          },
        }),
      });

      expect(response.status).toBe(200);
      expect(response.headers.get("content-type")).toBe("application/json");
      expect(response.headers.get("mcp-protocol-version")).toBe("2024-11-05");

      const result = await response.json();
      expect(result).toHaveProperty("jsonrpc", "2.0");
      expect(result).toHaveProperty("result");
      expect(result).toHaveProperty("id", 1);
    });
  });

  describe("错误处理", () => {
    it("应该对无效的 JSON-RPC 返回 400", async () => {
      const response = await fetch(`${baseUrl}/mcp`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          invalid: "message",
        }),
      });

      expect(response.status).toBe(400);
      const result = await response.json();
      expect(result).toHaveProperty("jsonrpc", "2.0");
      expect(result).toHaveProperty("error");
      expect(result.error.code).toBe(-32600);
    });

    it("应该对无效的 content-type 返回 400", async () => {
      const response = await fetch(`${baseUrl}/mcp`, {
        method: "POST",
        headers: {
          "Content-Type": "text/plain",
        },
        body: "invalid content",
      });

      expect(response.status).toBe(400);
      const result = await response.json();
      expect(result).toHaveProperty("jsonrpc", "2.0");
      expect(result).toHaveProperty("error");
      expect(result.error.code).toBe(-32600);
    });

    it("应该对格式错误的 JSON 返回 400", async () => {
      const response = await fetch(`${baseUrl}/mcp`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: "{ invalid json",
      });

      expect(response.status).toBe(400);
      const result = await response.json();
      expect(result).toHaveProperty("jsonrpc", "2.0");
      expect(result).toHaveProperty("error");
      expect(result.error.code).toBe(-32700);
    });
  });

  describe("协议符合性", () => {
    it("应该包含必需的 MCP 头", async () => {
      const response = await fetch(`${baseUrl}/mcp`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          jsonrpc: "2.0",
          method: "ping",
          id: "test-123",
        }),
      });

      expect(response.headers.get("mcp-protocol-version")).toBe("2024-11-05");
      expect(response.headers.get("content-type")).toBe("application/json");
    });

    it("应该处理不同的消息 ID 类型", async () => {
      // 测试字符串 ID
      let response = await fetch(`${baseUrl}/mcp`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          jsonrpc: "2.0",
          method: "ping",
          id: "string-id",
        }),
      });

      let result = await response.json();
      expect(result.id).toBe("string-id");

      // 测试数字 ID
      response = await fetch(`${baseUrl}/mcp`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          jsonrpc: "2.0",
          method: "ping",
          id: 42,
        }),
      });

      result = await response.json();
      expect(result.id).toBe(42);

      // 测试 null ID
      response = await fetch(`${baseUrl}/mcp`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          jsonrpc: "2.0",
          method: "ping",
          id: null,
        }),
      });

      result = await response.json();
      expect(result.id).toBe(null);
    });
  });

  describe("性能和限制", () => {
    it("应该处理合理大小的消息", async () => {
      const largeParams = {
        data: "x".repeat(1000), // 1KB 数据
      };

      const response = await fetch(`${baseUrl}/mcp`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          jsonrpc: "2.0",
          method: "test",
          id: 1,
          params: largeParams,
        }),
      });

      expect(response.status).toBe(200);
    });

    it("应该拒绝过大的消息", async () => {
      const oversizedParams = {
        data: "x".repeat(2 * 1024 * 1024), // 2MB 数据
      };

      const response = await fetch(`${baseUrl}/mcp`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          jsonrpc: "2.0",
          method: "test",
          id: 1,
          params: oversizedParams,
        }),
      });

      expect(response.status).toBe(400);
      const result = await response.json();
      expect(result.error.code).toBe(-32600);
      expect(result.error.message).toContain("too large");
    });
  });
});

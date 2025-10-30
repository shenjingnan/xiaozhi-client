/**
 * 阶段二传输层抽象验收测试
 * 验证 TransportAdapter、StdioAdapter 和 HTTPAdapter 的功能
 */

import request from "supertest";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { configManager } from "../../configManager.js";
import { MCPMessageHandler } from "../../core/MCPMessageHandler.js";
import { MCPServiceManager } from "../../services/MCPServiceManager.js";
import { HTTPAdapter } from "../HTTPAdapter.js";
import { StdioAdapter } from "../StdioAdapter.js";
import { ConnectionState, TransportAdapter } from "../TransportAdapter.js";

// Mock process.stdin and process.stdout for stdio tests
const mockStdin = {
  setEncoding: vi.fn(),
  on: vi.fn(),
  removeListener: vi.fn(),
};

const mockStdout = {
  write: vi.fn(),
};

const mockStderr = {
  write: vi.fn(),
};

// Mock process object
const mockProcess = {
  stdin: mockStdin,
  stdout: mockStdout,
  stderr: mockStderr,
  on: vi.fn(),
  exit: vi.fn(),
  uptime: vi.fn(() => 123.456), // Mock uptime 方法
  cwd: vi.fn(() => "/test/mock/directory"), // Mock cwd 方法，ConfigManager 需要用到
  env: {
    XIAOZHI_DAEMON: "false", // 设置默认值避免 Logger 初始化失败
    NODE_ENV: "test",
  },
};

// Mock global process
vi.stubGlobal("process", mockProcess);

describe("传输层抽象验收测试", () => {
  let serviceManager: MCPServiceManager;
  let messageHandler: MCPMessageHandler;

  beforeEach(() => {
    // Mock ConfigManager 方法以避免依赖真实配置文件
    vi.spyOn(configManager, "configExists").mockReturnValue(true);
    vi.spyOn(configManager, "getConfig").mockReturnValue({
      mcpEndpoint: "ws://localhost:8080",
      mcpServers: {},
      connection: {
        heartbeatInterval: 30000,
        heartbeatTimeout: 10000,
        reconnectInterval: 5000,
      },
      toolCallLog: {
        maxRecords: 100,
      },
    } as any);
    vi.spyOn(configManager, "getToolCallLogConfig").mockReturnValue({
      maxRecords: 100,
    });

    serviceManager = new MCPServiceManager();
    messageHandler = new MCPMessageHandler(serviceManager);

    // 清除所有 mock 调用
    vi.clearAllMocks();
  });

  afterEach(() => {
    // 恢复所有 mock
    vi.restoreAllMocks();
  });

  describe("TransportAdapter 抽象基类", () => {
    class TestAdapter extends TransportAdapter {
      async initialize(): Promise<void> {
        this.setState(ConnectionState.CONNECTING);
      }

      async start(): Promise<void> {
        this.setState(ConnectionState.CONNECTED);
      }

      async stop(): Promise<void> {
        this.setState(ConnectionState.DISCONNECTED);
      }

      async sendMessage(): Promise<void> {
        // Test implementation
      }
    }

    test("应该正确初始化基类属性", () => {
      const adapter = new TestAdapter(messageHandler, { name: "test" });

      expect(adapter.getConnectionId()).toMatch(/^test_\d+_[a-z0-9]+$/);
      expect(adapter.getState()).toBe(ConnectionState.DISCONNECTED);
      expect(adapter.getConfig().name).toBe("test");
      expect(adapter.getMessageHandler()).toBe(messageHandler);
    });

    test("应该正确管理连接状态", async () => {
      const adapter = new TestAdapter(messageHandler, { name: "test" });

      expect(adapter.getState()).toBe(ConnectionState.DISCONNECTED);

      await adapter.initialize();
      expect(adapter.getState()).toBe(ConnectionState.CONNECTING);

      await adapter.start();
      expect(adapter.getState()).toBe(ConnectionState.CONNECTED);

      await adapter.stop();
      expect(adapter.getState()).toBe(ConnectionState.DISCONNECTED);
    });

    test("应该正确解析 JSON 消息", () => {
      const adapter = new TestAdapter(messageHandler, { name: "test" });

      const validMessage = '{"jsonrpc": "2.0", "method": "test", "id": 1}';
      const parsed = (adapter as any).parseMessage(validMessage);

      expect(parsed).toEqual({
        jsonrpc: "2.0",
        method: "test",
        id: 1,
      });
    });

    test("应该正确处理无效 JSON", () => {
      const adapter = new TestAdapter(messageHandler, { name: "test" });

      const invalidMessage = '{"invalid": json}';
      const parsed = (adapter as any).parseMessage(invalidMessage);

      expect(parsed).toBeNull();
    });

    test("应该正确序列化消息", () => {
      const adapter = new TestAdapter(messageHandler, { name: "test" });

      const message = {
        jsonrpc: "2.0" as const,
        method: "test",
        id: 1,
      };

      const serialized = (adapter as any).serializeMessage(message);
      expect(serialized).toBe('{"jsonrpc":"2.0","method":"test","id":1}');
    });

    test("应该正确创建错误响应", () => {
      const adapter = new TestAdapter(messageHandler, { name: "test" });

      const error = new Error("测试错误");
      const errorResponse = (adapter as any).createErrorResponse(error, 1);

      expect(errorResponse).toEqual({
        jsonrpc: "2.0",
        error: {
          code: -32603,
          message: "测试错误",
          data: {
            stack: error.stack,
          },
        },
        id: 1,
      });
    });
  });

  describe("StdioAdapter", () => {
    let adapter: StdioAdapter;

    beforeEach(() => {
      adapter = new StdioAdapter(messageHandler, { name: "stdio-test" });
    });

    afterEach(async () => {
      if (adapter) {
        await adapter.stop();
      }
    });

    test("应该正确初始化", async () => {
      await adapter.initialize();

      expect(adapter.getState()).toBe(ConnectionState.CONNECTING);
      expect(mockStdin.setEncoding).toHaveBeenCalledWith("utf8");
    });

    test("应该正确启动和停止", async () => {
      await adapter.initialize();
      await adapter.start();

      expect(adapter.getState()).toBe(ConnectionState.CONNECTED);
      expect(adapter.getStatus().isRunning).toBe(true);

      await adapter.stop();

      expect(adapter.getState()).toBe(ConnectionState.DISCONNECTED);
      expect(adapter.getStatus().isRunning).toBe(false);
    });

    test("应该正确发送消息", async () => {
      await adapter.initialize();
      await adapter.start();

      const message = {
        jsonrpc: "2.0" as const,
        result: { status: "ok" },
        id: 1,
      };

      await adapter.sendMessage(message);

      expect(mockStdout.write).toHaveBeenCalledWith(
        '{"jsonrpc":"2.0","result":{"status":"ok"},"id":1}\n'
      );
    });

    test("应该正确处理配置", () => {
      const customAdapter = new StdioAdapter(messageHandler, {
        name: "custom-stdio",
        encoding: "ascii",
        bufferSize: 2048,
      });

      const status = customAdapter.getStatus();
      expect(status.encoding).toBe("ascii");
    });

    test("应该能够清空缓冲区", () => {
      adapter.clearBuffer();
      expect(adapter.getStatus().bufferSize).toBe(0);
    });
  });

  describe("HTTPAdapter", () => {
    let adapter: HTTPAdapter;
    let port: number;

    beforeEach(() => {
      // 使用随机端口避免冲突
      port = 3000 + Math.floor(Math.random() * 1000);
      adapter = new HTTPAdapter(messageHandler, {
        name: "http-test",
        port,
        host: "localhost",
      });
    });

    afterEach(async () => {
      if (adapter) {
        await adapter.stop();
      }
    });

    test("应该正确初始化", async () => {
      await adapter.initialize();

      expect(adapter.getState()).toBe(ConnectionState.CONNECTING);
    });

    test("应该正确启动和停止 HTTP 服务器", async () => {
      await adapter.initialize();
      await adapter.start();

      expect(adapter.getState()).toBe(ConnectionState.CONNECTED);
      expect(adapter.getStatus().isRunning).toBe(true);
      expect(adapter.getStatus().port).toBe(port);

      await adapter.stop();

      expect(adapter.getState()).toBe(ConnectionState.DISCONNECTED);
      expect(adapter.getStatus().isRunning).toBe(false);
    });

    test("应该正确处理 RPC 请求", async () => {
      await adapter.initialize();
      await adapter.start();

      const response = await request(`http://localhost:${port}`)
        .post("/rpc")
        .send({
          jsonrpc: "2.0",
          method: "ping",
          id: 1,
        });

      expect(response.status).toBe(200);
      expect(response.body.jsonrpc).toBe("2.0");
      expect(response.body.result).toBeDefined();
      expect(response.body.result.status).toBe("ok");
      expect(response.body.id).toBe(1);
    });

    test("应该正确处理状态请求", async () => {
      await adapter.initialize();
      await adapter.start();

      const response = await request(`http://localhost:${port}`).get("/status");

      expect(response.status).toBe(200);
      expect(response.body.status).toBe("ok");
      expect(response.body.mode).toBe("mcp-server");
      expect(response.body.clients).toBe(0);
      expect(response.body.enableSSE).toBe(true);
      expect(response.body.enableRPC).toBe(true);
    });

    test("应该正确处理健康检查", async () => {
      await adapter.initialize();
      await adapter.start();

      const response = await request(`http://localhost:${port}`).get("/health");

      expect(response.status).toBe(200);
      expect(response.body.status).toBe("ok");
      expect(response.body.mode).toBe("mcp-server");
      expect(response.body.timestamp).toBeDefined();
    });

    test("应该正确建立 SSE 连接", async () => {
      await adapter.initialize();
      await adapter.start();

      // 只测试 SSE 端点的响应头，不等待数据流
      const response = await request(`http://localhost:${port}`)
        .get("/sse")
        .timeout(500)
        .buffer(false)
        .expect(200);

      expect(response.headers["content-type"]).toContain("text/event-stream");
      expect(response.headers["cache-control"]).toContain("no-cache");
      expect(response.headers.connection).toContain("keep-alive");
    });

    test("应该正确配置 CORS", async () => {
      await adapter.initialize();
      await adapter.start();

      const response = await request(`http://localhost:${port}`).options(
        "/rpc"
      );

      expect(response.headers["access-control-allow-origin"]).toBe("*");
      expect(response.headers["access-control-allow-methods"]).toContain(
        "POST"
      );
      expect(response.headers["access-control-allow-headers"]).toContain(
        "Content-Type"
      );
    });

    test("应该正确处理客户端限制", async () => {
      const limitedAdapter = new HTTPAdapter(messageHandler, {
        name: "limited-http",
        port: port + 1,
        maxClients: 0, // 设置为 0 来测试限制
      });

      try {
        await limitedAdapter.initialize();
        await limitedAdapter.start();

        const response = await request(`http://localhost:${port + 1}`)
          .get("/sse")
          .timeout(1000);

        expect(response.status).toBe(503);
        expect(response.body.error).toContain("客户端连接数已达上限");
      } finally {
        await limitedAdapter.stop();
      }
    }, 2000); // 设置 2 秒超时

    test("应该正确获取客户端状态", () => {
      const status = adapter.getStatus();

      expect(status).toEqual({
        isRunning: false,
        port,
        host: "localhost",
        clientCount: 0,
        maxClients: 100,
        enableSSE: true,
        enableRPC: true,
        connectionId: adapter.getConnectionId(),
        state: ConnectionState.DISCONNECTED,
      });
    });

    test("应该正确获取客户端列表", () => {
      const clients = adapter.getClients();
      expect(Array.isArray(clients)).toBe(true);
      expect(clients.length).toBe(0);
    });
  });

  describe("集成测试", () => {
    test("所有适配器应该使用相同的消息处理器", () => {
      const stdioAdapter = new StdioAdapter(messageHandler);
      const httpAdapter = new HTTPAdapter(messageHandler);

      expect(stdioAdapter.getMessageHandler()).toBe(messageHandler);
      expect(httpAdapter.getMessageHandler()).toBe(messageHandler);
    });

    test("所有适配器应该生成唯一的连接ID", () => {
      const adapter1 = new StdioAdapter(messageHandler, { name: "test1" });
      const adapter2 = new StdioAdapter(messageHandler, { name: "test2" });
      const adapter3 = new HTTPAdapter(messageHandler, { name: "test3" });

      const ids = [
        adapter1.getConnectionId(),
        adapter2.getConnectionId(),
        adapter3.getConnectionId(),
      ];

      // 所有 ID 应该不同
      expect(new Set(ids).size).toBe(3);
    });

    test("所有适配器应该正确实现状态管理", async () => {
      const adapters = [
        new StdioAdapter(messageHandler, { name: "stdio" }),
        new HTTPAdapter(messageHandler, { name: "http", port: 3100 }),
      ];

      for (const adapter of adapters) {
        expect(adapter.getState()).toBe(ConnectionState.DISCONNECTED);

        await adapter.initialize();
        expect(adapter.getState()).toBe(ConnectionState.CONNECTING);

        await adapter.start();
        expect(adapter.getState()).toBe(ConnectionState.CONNECTED);

        await adapter.stop();
        expect(adapter.getState()).toBe(ConnectionState.DISCONNECTED);
      }
    });
  });
});

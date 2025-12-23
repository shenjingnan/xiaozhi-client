/**
 * 阶段二传输层抽象验收测试
 * 验证 TransportAdapter 和 StdioAdapter 的功能
 */

import type { AppConfig } from "@/lib/config/configManager.js";
import { configManager } from "@/lib/config/configManager.js";
import { MCPServiceManager } from "@/lib/mcp/manager.js";
import { MCPMessageHandler } from "@/lib/mcp/message.js";
import type { MCPMessage, MCPResponse } from "@root/types/mcp.js";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
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

  // 测试用子类，暴露受保护的方法供测试使用
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

    // 暴露受保护的方法供测试使用
    public testParseMessage(data: string): MCPMessage | null {
      return this.parseMessage(data);
    }

    public testSerializeMessage(message: MCPMessage | MCPResponse): string {
      return this.serializeMessage(message);
    }

    public testCreateErrorResponse(
      error: Error,
      id: string | number
    ): MCPResponse {
      return this.createErrorResponse(error, id);
    }
  }

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
    } as AppConfig);
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
      const parsed = adapter.testParseMessage(validMessage);

      expect(parsed).toEqual({
        jsonrpc: "2.0",
        method: "test",
        id: 1,
      });
    });

    test("应该正确处理无效 JSON", () => {
      const adapter = new TestAdapter(messageHandler, { name: "test" });

      const invalidMessage = '{"invalid": json}';
      const parsed = adapter.testParseMessage(invalidMessage);

      expect(parsed).toBeNull();
    });

    test("应该正确序列化消息", () => {
      const adapter = new TestAdapter(messageHandler, { name: "test" });

      const message = {
        jsonrpc: "2.0" as const,
        method: "test",
        id: 1,
      };

      const serialized = adapter.testSerializeMessage(message);
      expect(serialized).toBe('{"jsonrpc":"2.0","method":"test","id":1}');
    });

    test("应该正确创建错误响应", () => {
      const adapter = new TestAdapter(messageHandler, { name: "test" });

      const error = new Error("测试错误");
      const errorResponse = adapter.testCreateErrorResponse(error, 1);

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

  describe("集成测试", () => {
    test("StdioAdapter应该正确使用消息处理器", () => {
      const stdioAdapter = new StdioAdapter(messageHandler);

      expect(stdioAdapter.getMessageHandler()).toBe(messageHandler);
    });

    test("多个StdioAdapter应该生成唯一的连接ID", () => {
      const adapter1 = new StdioAdapter(messageHandler, { name: "test1" });
      const adapter2 = new StdioAdapter(messageHandler, { name: "test2" });
      const adapter3 = new StdioAdapter(messageHandler, { name: "test3" });

      const ids = [
        adapter1.getConnectionId(),
        adapter2.getConnectionId(),
        adapter3.getConnectionId(),
      ];

      // 所有 ID 应该不同
      expect(new Set(ids).size).toBe(3);
    });

    test("StdioAdapter应该正确实现状态管理", async () => {
      const adapter = new StdioAdapter(messageHandler, { name: "stdio" });

      expect(adapter.getState()).toBe(ConnectionState.DISCONNECTED);

      await adapter.initialize();
      expect(adapter.getState()).toBe(ConnectionState.CONNECTING);

      await adapter.start();
      expect(adapter.getState()).toBe(ConnectionState.CONNECTED);

      await adapter.stop();
      expect(adapter.getState()).toBe(ConnectionState.DISCONNECTED);
    });
  });
});

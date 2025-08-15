/**
 * 阶段二传输层抽象集成测试
 * 专注于核心功能验证，避免复杂的 mock 和超时问题
 */

import request from "supertest";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { MCPMessageHandler } from "../../core/MCPMessageHandler.js";
import { MCPServiceManager } from "../../services/MCPServiceManager.js";
import { HTTPAdapter } from "../HTTPAdapter.js";
import { ConnectionState, TransportAdapter } from "../TransportAdapter.js";

describe("传输层抽象集成测试", () => {
  let serviceManager: MCPServiceManager;
  let messageHandler: MCPMessageHandler;

  beforeEach(() => {
    serviceManager = new MCPServiceManager();
    messageHandler = new MCPMessageHandler(serviceManager);
  });

  describe("TransportAdapter 抽象基类核心功能", () => {
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

      // 暴露受保护的方法用于测试
      public testParseMessage(data: string) {
        return this.parseMessage(data);
      }

      public testSerializeMessage(message: any) {
        return this.serializeMessage(message);
      }

      public testCreateErrorResponse(error: Error, id?: string | number) {
        return this.createErrorResponse(error, id);
      }
    }

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

    test("应该正确解析和序列化消息", () => {
      const adapter = new TestAdapter(messageHandler, { name: "test" });

      // 测试解析
      const validMessage = '{"jsonrpc": "2.0", "method": "test", "id": 1}';
      const parsed = adapter.testParseMessage(validMessage);
      expect(parsed).toEqual({
        jsonrpc: "2.0",
        method: "test",
        id: 1,
      });

      // 测试序列化
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

      expect(errorResponse.jsonrpc).toBe("2.0");
      expect(errorResponse.error?.code).toBe(-32603);
      expect(errorResponse.error?.message).toBe("测试错误");
      expect(errorResponse.id).toBe(1);
    });

    test("应该生成唯一的连接ID", () => {
      const adapter1 = new TestAdapter(messageHandler, { name: "test1" });
      const adapter2 = new TestAdapter(messageHandler, { name: "test2" });

      expect(adapter1.getConnectionId()).not.toBe(adapter2.getConnectionId());
      expect(adapter1.getConnectionId()).toMatch(/^test1_\d+_[a-z0-9]+$/);
      expect(adapter2.getConnectionId()).toMatch(/^test2_\d+_[a-z0-9]+$/);
    });
  });

  describe("HTTPAdapter 核心功能", () => {
    let adapter: HTTPAdapter;
    let port: number;

    beforeEach(() => {
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

    test("应该正确初始化和启动", async () => {
      await adapter.initialize();
      expect(adapter.getState()).toBe(ConnectionState.CONNECTING);

      await adapter.start();
      expect(adapter.getState()).toBe(ConnectionState.CONNECTED);
      expect(adapter.getStatus().isRunning).toBe(true);
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

    test("应该正确处理 initialize 请求", async () => {
      await adapter.initialize();
      await adapter.start();

      const response = await request(`http://localhost:${port}`)
        .post("/rpc")
        .send({
          jsonrpc: "2.0",
          method: "initialize",
          params: {
            protocolVersion: "2024-11-05",
            capabilities: {},
            clientInfo: {
              name: "test-client",
              version: "1.0.0",
            },
          },
          id: 2,
        });

      expect(response.status).toBe(200);
      expect(response.body.jsonrpc).toBe("2.0");
      expect(response.body.result).toBeDefined();
      expect(response.body.result.serverInfo).toBeDefined();
      expect(response.body.result.serverInfo.name).toBe("xiaozhi-mcp-server");
      expect(response.body.id).toBe(2);
    });

    test("应该正确处理 tools/list 请求", async () => {
      await adapter.initialize();
      await adapter.start();

      const response = await request(`http://localhost:${port}`)
        .post("/rpc")
        .send({
          jsonrpc: "2.0",
          method: "tools/list",
          id: 3,
        });

      expect(response.status).toBe(200);
      expect(response.body.jsonrpc).toBe("2.0");
      expect(response.body.result).toBeDefined();
      expect(response.body.result.tools).toBeDefined();
      expect(Array.isArray(response.body.result.tools)).toBe(true);
      expect(response.body.id).toBe(3);
    });

    test("应该正确处理状态和健康检查", async () => {
      await adapter.initialize();
      await adapter.start();

      // 状态检查
      const statusResponse = await request(`http://localhost:${port}`).get(
        "/status"
      );
      expect(statusResponse.status).toBe(200);
      expect(statusResponse.body.status).toBe("ok");
      expect(statusResponse.body.mode).toBe("mcp-server"); // 从用户角度看，这是 MCP 服务器的状态

      // 健康检查
      const healthResponse = await request(`http://localhost:${port}`).get(
        "/health"
      );
      expect(healthResponse.status).toBe(200);
      expect(healthResponse.body.status).toBe("ok");
      expect(healthResponse.body.mode).toBe("mcp-server"); // 从用户角度看，这是 MCP 服务器的健康状态
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
    });

    test("应该正确获取适配器状态", () => {
      const status = adapter.getStatus();

      expect(status.isRunning).toBe(false);
      expect(status.port).toBe(port);
      expect(status.host).toBe("localhost");
      expect(status.clientCount).toBe(0);
      expect(status.enableSSE).toBe(true);
      expect(status.enableRPC).toBe(true);
      expect(status.state).toBe(ConnectionState.DISCONNECTED);
    });

    test("性能测试：响应时间应该保持优秀", async () => {
      await adapter.initialize();
      await adapter.start();

      const startTime = Date.now();

      const response = await request(`http://localhost:${port}`)
        .post("/rpc")
        .send({
          jsonrpc: "2.0",
          method: "ping",
          id: 4,
        });

      const endTime = Date.now();
      const responseTime = endTime - startTime;

      expect(response.status).toBe(200);
      expect(responseTime).toBeLessThan(100); // 响应时间应该小于 100ms

      console.log(`HTTP 适配器响应时间: ${responseTime}ms`);
    });
  });

  describe("传输层抽象架构验证", () => {
    test("所有适配器应该使用相同的消息处理器", () => {
      const httpAdapter = new HTTPAdapter(messageHandler, { name: "http" });

      expect(httpAdapter.getMessageHandler()).toBe(messageHandler);
    });

    test("适配器配置应该正确传递", () => {
      const config = {
        name: "custom-http",
        port: 4000,
        host: "127.0.0.1",
        enableSSE: false,
        enableRPC: true,
        maxClients: 50,
      };

      const adapter = new HTTPAdapter(messageHandler, config);
      const status = adapter.getStatus();

      expect(status.port).toBe(4000);
      expect(status.host).toBe("127.0.0.1");
      expect(status.enableSSE).toBe(false);
      expect(status.enableRPC).toBe(true);
      expect(status.maxClients).toBe(50);
    });

    test("错误处理应该统一", async () => {
      const adapter = new HTTPAdapter(messageHandler, {
        name: "error-test",
        port: 3200,
      });

      await adapter.initialize();
      await adapter.start();

      const response = await request("http://localhost:3200")
        .post("/rpc")
        .send({
          jsonrpc: "2.0",
          method: "unknown_method",
          id: 5,
        });

      expect(response.status).toBe(200);
      expect(response.body.jsonrpc).toBe("2.0");
      expect(response.body.error).toBeDefined();
      expect(response.body.error.code).toBe(-32601); // Method not found
      expect(response.body.id).toBe(5);

      await adapter.stop();
    });
  });
});

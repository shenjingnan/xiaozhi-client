/**
 * WebSocket 适配器测试
 * 阶段四：WebSocket 集成和性能测试
 */

import { MCPServiceManager } from "@services/MCPServiceManager.js";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { MCPMessageHandler } from "../../core/MCPMessageHandler.js";
import { ConnectionState } from "../TransportAdapter.js";
import type { WebSocketConfig } from "../WebSocketAdapter.js";
import { WebSocketAdapter, WebSocketState } from "../WebSocketAdapter.js";

describe("WebSocket 适配器测试", () => {
  let serviceManager: MCPServiceManager;
  let messageHandler: MCPMessageHandler;
  let adapter: WebSocketAdapter;

  beforeEach(async () => {
    serviceManager = new MCPServiceManager();
    messageHandler = new MCPMessageHandler(serviceManager);
  });

  afterEach(async () => {
    if (adapter) {
      await adapter.stop();
    }
    // MCPServiceManager 不需要显式停止
  });

  describe("基础功能测试", () => {
    test("应该正确初始化客户端模式", async () => {
      const config: WebSocketConfig = {
        name: "test-ws-client",
        endpointUrl: "ws://localhost:8080",
        mode: "client",
        compression: true,
      };

      adapter = new WebSocketAdapter(messageHandler, config);

      // 验证初始状态
      expect(adapter.getConnectionId()).toContain("test-ws-client");
      expect(adapter.getState()).toBe(ConnectionState.DISCONNECTED);

      const status = adapter.getStatus();
      expect(status.mode).toBe("client");
      expect(status.endpointUrl).toBe("ws://localhost:8080");
      expect(status.compression).toBe(true);
      expect(status.connectionCount).toBe(0);
    });

    test("应该正确初始化服务器模式", async () => {
      const config: WebSocketConfig = {
        name: "test-ws-server",
        endpointUrl: "ws://localhost:8081",
        mode: "server",
        maxConnections: 50,
      };

      adapter = new WebSocketAdapter(messageHandler, config);

      const status = adapter.getStatus();
      expect(status.mode).toBe("server");
      expect(status.endpointUrl).toBe("ws://localhost:8081");
      expect(status.connectionCount).toBe(0);
    });

    test("应该正确处理配置验证", () => {
      // 无效的端点URL
      expect(() => {
        new WebSocketAdapter(messageHandler, {
          name: "invalid",
          endpointUrl: "invalid-url",
        });
      }).not.toThrow(); // 构造函数不验证，在初始化时验证

      // 有效配置
      expect(() => {
        new WebSocketAdapter(messageHandler, {
          name: "valid",
          endpointUrl: "ws://localhost:8080",
          mode: "client",
        });
      }).not.toThrow();
    });
  });

  describe("连接管理测试", () => {
    test("应该正确管理连接状态", async () => {
      const config: WebSocketConfig = {
        name: "test-connection",
        endpointUrl: "ws://localhost:8082",
        mode: "client",
        reconnect: {
          enabled: false, // 禁用重连以便测试
        },
      };

      adapter = new WebSocketAdapter(messageHandler, config);

      // 初始状态
      expect(adapter.getState()).toBe(ConnectionState.DISCONNECTED);
      expect(adapter.getStatus().wsState).toBe(WebSocketState.DISCONNECTED);

      // 注意：实际连接会失败，但我们可以测试状态变化逻辑
      try {
        await adapter.initialize();
      } catch (error) {
        // 预期会失败，因为没有实际的 WebSocket 服务器
        expect(error).toBeDefined();
      }
    });

    test("应该正确处理重连配置", () => {
      const config: WebSocketConfig = {
        name: "test-reconnect",
        endpointUrl: "ws://localhost:8083",
        reconnect: {
          enabled: true,
          maxAttempts: 3,
          initialInterval: 1000,
          maxInterval: 5000,
          backoffStrategy: "exponential",
          backoffMultiplier: 2,
          timeout: 5000,
          jitter: true,
        },
      };

      adapter = new WebSocketAdapter(messageHandler, config);
      const status = adapter.getStatus();

      expect(status.reconnectAttempts).toBe(0);
    });
  });

  describe("性能优化测试", () => {
    test("应该支持消息批处理", async () => {
      const config: WebSocketConfig = {
        name: "test-batch",
        endpointUrl: "ws://localhost:8084",
        mode: "client",
        batchSize: 5,
        batchTimeout: 100,
      };

      adapter = new WebSocketAdapter(messageHandler, config);

      const status = adapter.getStatus();
      expect(status.batchQueueSize).toBe(0);

      // 测试批处理队列状态
      // 注意：由于没有实际连接，我们只能测试配置和状态
    });

    test("应该支持压缩配置", () => {
      const configWithCompression: WebSocketConfig = {
        name: "test-compression",
        endpointUrl: "ws://localhost:8085",
        compression: true,
      };

      const adapterWithCompression = new WebSocketAdapter(
        messageHandler,
        configWithCompression
      );
      expect(adapterWithCompression.getStatus().compression).toBe(true);

      const configWithoutCompression: WebSocketConfig = {
        name: "test-no-compression",
        endpointUrl: "ws://localhost:8086",
        compression: false,
      };

      const adapterWithoutCompression = new WebSocketAdapter(
        messageHandler,
        configWithoutCompression
      );
      expect(adapterWithoutCompression.getStatus().compression).toBe(false);
    });

    test("应该支持连接数限制", () => {
      const config: WebSocketConfig = {
        name: "test-max-connections",
        endpointUrl: "ws://localhost:8087",
        mode: "server",
        maxConnections: 10,
      };

      adapter = new WebSocketAdapter(messageHandler, config);
      const status = adapter.getStatus();

      expect(status.connectionCount).toBe(0);
      // 最大连接数在服务器模式下生效
    });
  });

  describe("错误处理测试", () => {
    test("应该正确处理连接错误", async () => {
      const config: WebSocketConfig = {
        name: "test-error",
        endpointUrl: "ws://invalid-host:8088",
        mode: "client",
        reconnect: {
          enabled: false,
          timeout: 1000, // 快速超时
        },
      };

      adapter = new WebSocketAdapter(messageHandler, config);

      // 尝试连接到无效地址应该失败
      await expect(adapter.initialize()).rejects.toThrow();

      const status = adapter.getStatus();
      expect(status.wsState).toBe(WebSocketState.FAILED);
    });

    test("应该正确处理无效配置", () => {
      // 测试无效的批处理大小
      expect(() => {
        new WebSocketAdapter(messageHandler, {
          name: "invalid-batch",
          endpointUrl: "ws://localhost:8089",
          batchSize: 0,
        });
      }).not.toThrow(); // 构造函数不验证，使用默认值

      // 测试无效的最大连接数
      expect(() => {
        new WebSocketAdapter(messageHandler, {
          name: "invalid-max-conn",
          endpointUrl: "ws://localhost:8090",
          maxConnections: 0,
        });
      }).not.toThrow(); // 构造函数不验证，使用默认值
    });
  });

  describe("API 兼容性测试", () => {
    test("应该实现 TransportAdapter 接口", () => {
      const config: WebSocketConfig = {
        name: "test-interface",
        endpointUrl: "ws://localhost:8091",
      };

      adapter = new WebSocketAdapter(messageHandler, config);

      // 验证必需的方法存在
      expect(typeof adapter.initialize).toBe("function");
      expect(typeof adapter.start).toBe("function");
      expect(typeof adapter.stop).toBe("function");
      expect(typeof adapter.sendMessage).toBe("function");
      expect(typeof adapter.getConnectionId).toBe("function");
      expect(typeof adapter.getState).toBe("function");
      expect(typeof adapter.getMessageHandler).toBe("function");
    });

    test("应该提供 WebSocket 特有的方法", () => {
      const config: WebSocketConfig = {
        name: "test-specific",
        endpointUrl: "ws://localhost:8092",
      };

      adapter = new WebSocketAdapter(messageHandler, config);

      // 验证 WebSocket 特有的方法
      expect(typeof adapter.getStatus).toBe("function");
      expect(typeof adapter.forceReconnect).toBe("function");
    });
  });

  describe("配置默认值测试", () => {
    test("应该使用正确的默认配置", () => {
      const config: WebSocketConfig = {
        name: "test-defaults",
        endpointUrl: "ws://localhost:8093",
      };

      adapter = new WebSocketAdapter(messageHandler, config);
      const status = adapter.getStatus();

      // 验证默认值
      expect(status.mode).toBe("client");
      expect(status.compression).toBe(false);
      expect(status.batchQueueSize).toBe(0);
      expect(status.reconnectAttempts).toBe(0);
    });

    test("应该正确应用自定义配置", () => {
      const config: WebSocketConfig = {
        name: "test-custom",
        endpointUrl: "ws://localhost:8094",
        mode: "server",
        compression: true,
        batchSize: 20,
        batchTimeout: 200,
        maxConnections: 200,
      };

      adapter = new WebSocketAdapter(messageHandler, config);
      const status = adapter.getStatus();

      expect(status.mode).toBe("server");
      expect(status.compression).toBe(true);
    });
  });
});

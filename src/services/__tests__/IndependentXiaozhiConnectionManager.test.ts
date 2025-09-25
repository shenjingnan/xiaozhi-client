#!/usr/bin/env node

/**
 * IndependentXiaozhiConnectionManager 测试文件
 * 测试独立架构的连接管理器功能
 */

import { EventEmitter } from "node:events";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { WebSocket } from "ws";

// Mock ErrorEvent
global.ErrorEvent = class ErrorEvent extends Event {
  constructor(type: string, init: { error?: Error } = {}) {
    super(type);
    this.error = init.error || null;
  }
  error: Error | null;
} as any;

// Mock 模块
vi.mock("ws", () => ({
  WebSocket: vi.fn().mockImplementation(() => ({
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    send: vi.fn(),
    close: vi.fn(),
    readyState: 1, // OPEN
  })),
}));

vi.mock("../Logger.js", () => ({
  logger: {
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

// 导入被测试的类
import { IndependentXiaozhiConnectionManager } from "../IndependentXiaozhiConnectionManager.js";

describe("IndependentXiaozhiConnectionManager", () => {
  let manager: IndependentXiaozhiConnectionManager;
  let mockWebSocket: any;
  let tools: any[];

  beforeEach(() => {
    // 重置所有 mock
    vi.clearAllMocks();

    // 创建 mock WebSocket 实例
    mockWebSocket = {
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      send: vi.fn(),
      close: vi.fn(),
      readyState: 1, // OPEN
    };

    // 设置 WebSocket 构造函数的返回值
    (WebSocket as any).mockImplementation(() => mockWebSocket);

    // 初始化测试工具数组
    tools = [];

    // 创建管理器实例
    manager = new IndependentXiaozhiConnectionManager({
      reconnectInterval: 1000, // 缩短测试时间
      maxReconnectAttempts: 2, // 减少重试次数
      connectionTimeout: 5000, // 缩短超时时间
    });
  });

  afterEach(async () => {
    // 清理资源
    if (manager) {
      try {
        await manager.cleanup();
      } catch (error) {
        // 忽略清理错误
      }
    }
  });

  describe("实例化和配置", () => {
    it("应该创建 IndependentXiaozhiConnectionManager 实例", () => {
      expect(manager).toBeInstanceOf(IndependentXiaozhiConnectionManager);
      expect(manager).toBeInstanceOf(EventEmitter);
    });

    it("应该使用默认配置创建实例", () => {
      const defaultManager = new IndependentXiaozhiConnectionManager();
      expect(defaultManager).toBeInstanceOf(
        IndependentXiaozhiConnectionManager
      );
    });

    it("应该使用自定义配置创建实例", () => {
      const customManager = new IndependentXiaozhiConnectionManager({
        reconnectInterval: 2000,
        maxReconnectAttempts: 5,
        connectionTimeout: 15000,
      });
      expect(customManager).toBeInstanceOf(IndependentXiaozhiConnectionManager);
    });
  });

  describe("连接管理", () => {
    it("应该能够初始化连接管理器", async () => {
      const endpoint = "ws://localhost:8080";
      const tools: any[] = [];
      // 端点将在initialize方法中通过配置添加
      // 这里只测试初始化过程
      await expect(
        manager.initialize([endpoint], tools)
      ).resolves.not.toThrow();
    });

    it("应该在初始化失败时抛出错误", async () => {
      // 模拟连接创建失败
      vi.spyOn(manager as any, "createConnection").mockRejectedValue(
        new Error("连接失败")
      );

      const endpoint = "ws://localhost:8080";
      const tools: any[] = [];

      await expect(manager.initialize([endpoint], tools)).rejects.toThrow(
        "连接失败"
      );
    });

    it("应该能够获取连接状态", async () => {
      const endpoint = "ws://localhost:8080";
      const testTools: any[] = [];

      // 初始化前
      const statusBefore = manager.getConnectionStatus();
      expect(statusBefore).toHaveLength(0);

      // 模拟初始化成功
      vi.spyOn(manager as any, "createConnection").mockResolvedValue({});
      await manager.initialize([endpoint], testTools);

      // 初始化后
      const statusAfter = manager.getConnectionStatus();
      expect(statusAfter).toHaveLength(1);
      expect(statusAfter[0].endpoint).toBe(endpoint);
    });

    it("应该能够发送消息到指定端点", async () => {
      const endpoint = "ws://localhost:8080";
      const testTools: any[] = [];

      // 模拟初始化成功
      vi.spyOn(manager as any, "createConnection").mockResolvedValue({
        send: vi.fn(),
        readyState: 1,
      });
      await manager.initialize([endpoint], testTools);

      const message = { type: "test", data: "hello" };
      await expect(
        manager.sendMessage(endpoint, message)
      ).resolves.not.toThrow();
    });

    it("应该在发送消息到未连接端点时抛出错误", async () => {
      const endpoint = "ws://localhost:8080";

      const message = { type: "test", data: "hello" };
      await expect(manager.sendMessage(endpoint, message)).rejects.toThrow(
        "接入点不存在"
      );
    });
  });

  describe("独立管理每个端点的连接", () => {
    it("应该为每个端点创建独立的连接", async () => {
      const endpoints = [
        "ws://localhost:8080",
        "ws://localhost:8081",
        "ws://localhost:8082",
      ];
      const testTools: any[] = [];

      // 模拟连接创建
      const createConnectionSpy = vi
        .spyOn(manager as any, "createConnection")
        .mockResolvedValue({
          send: vi.fn(),
          readyState: 1,
        });

      await manager.initialize(endpoints, testTools);

      // 应该为每个端点创建连接
      expect(createConnectionSpy).toHaveBeenCalledTimes(endpoints.length);

      // 检查每个端点的连接状态
      const status = manager.getConnectionStatus();
      expect(status).toHaveLength(endpoints.length);
      for (const endpoint of endpoints) {
        const endpointStatus = status.find((s) => s.endpoint === endpoint);
        expect(endpointStatus).toBeDefined();
      }
    });

    it("应该独立管理每个端点的连接状态", async () => {
      const endpoints = ["ws://localhost:8080", "ws://localhost:8081"];

      for (const endpoint of endpoints) {
        manager.addEndpoint(endpoint);
      }

      // 模拟第一个连接成功，第二个连接失败
      vi.spyOn(manager as any, "createConnection")
        .mockImplementationOnce(() =>
          Promise.resolve({
            send: vi.fn(),
            readyState: 1,
          })
        )
        .mockImplementationOnce(() => Promise.reject(new Error("连接失败")));

      await manager.initialize([endpoint], tools);

      const status = manager.getConnectionStatus();
      expect(status).toHaveLength(2);

      // 第一个端点应该连接成功
      const firstStatus = status.find((s) => s.endpoint === endpoints[0]);
      expect(firstStatus).toBeDefined();
      expect(firstStatus?.connected).toBe(true);

      // 第二个端点应该连接失败
      const secondStatus = status.find((s) => s.endpoint === endpoints[1]);
      expect(secondStatus).toBeDefined();
      expect(secondStatus?.connected).toBe(false);
    });

    it("应该能够独立断开特定端点的连接", async () => {
      const endpoints = ["ws://localhost:8080", "ws://localhost:8081"];

      for (const endpoint of endpoints) {
        manager.addEndpoint(endpoint);
      }

      // 模拟连接创建
      const mockConnections: any = {};
      vi.spyOn(manager as any, "createConnection").mockImplementation(
        (endpoint: string) => {
          const mockConnection = {
            send: vi.fn(),
            readyState: 1,
            close: vi.fn(),
          };
          mockConnections[endpoint] = mockConnection;
          return Promise.resolve(mockConnection);
        }
      );

      await manager.initialize([endpoint], tools);

      // 断开第一个端点
      await manager.disconnectEndpoint(endpoints[0]);

      // 检查第一个端点的连接状态
      const firstStatus = manager
        .getConnectionStatus()
        .find((s) => s.endpoint === endpoints[0]);
      expect(firstStatus?.connected).toBe(false);

      // 检查第二个端点是否仍然连接
      const secondStatus = manager
        .getConnectionStatus()
        .find((s) => s.endpoint === endpoints[1]);
      expect(secondStatus?.connected).toBe(true);

      // 验证第一个连接的 close 方法被调用
      expect(mockConnections[endpoints[0]].close).toHaveBeenCalled();
    });
  });

  describe("正确处理端点失败状态", () => {
    it("应该正确处理连接失败的情况", async () => {
      const endpoint = "ws://localhost:8080";
      manager.addEndpoint(endpoint);

      // 模拟连接失败
      vi.spyOn(manager as any, "createConnection").mockRejectedValue(
        new Error("连接超时")
      );

      await manager.initialize([endpoint], tools);

      const status = manager.getConnectionStatus();
      expect(status).toHaveLength(1);
      expect(status[0].endpoint).toBe(endpoint);
      expect(status[0].connected).toBe(false);
      expect(status[0].lastError).toBe("连接超时");
    });

    it("应该正确处理连接断开的情况", async () => {
      const endpoint = "ws://localhost:8080";
      manager.addEndpoint(endpoint);

      // 模拟连接对象
      const mockConnection = {
        send: vi.fn(),
        readyState: 1,
        close: vi.fn(),
      };

      vi.spyOn(manager as any, "createConnection").mockResolvedValue(
        mockConnection
      );

      await manager.initialize([endpoint], tools);

      // 模拟连接断开
      const handleCloseSpy = vi.fn();
      manager.on("endpointDisconnected", handleCloseSpy);

      // 触发连接断开事件
      const closeEvent = new Event("close");
      for (const [event, handler] of mockConnection.addEventListener.mock
        .calls) {
        if (event === "close") {
          handler(closeEvent);
        }
      }

      expect(handleCloseSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          endpoint,
          reason: "连接被服务器关闭",
        })
      );
    });

    it("应该能够处理连接错误", async () => {
      const endpoint = "ws://localhost:8080";
      manager.addEndpoint(endpoint);

      // 模拟连接对象
      const mockConnection = {
        send: vi.fn(),
        readyState: 1,
        close: vi.fn(),
      };

      vi.spyOn(manager as any, "createConnection").mockResolvedValue(
        mockConnection
      );

      await manager.initialize([endpoint], tools);

      // 模拟连接错误
      const handleErrorSpy = vi.fn();
      manager.on("endpointError", handleErrorSpy);

      // 触发错误事件
      const errorEvent = new ErrorEvent("error", {
        error: new Error("网络错误"),
      });
      for (const [event, handler] of mockConnection.addEventListener.mock
        .calls) {
        if (event === "error") {
          handler(errorEvent);
        }
      }

      expect(handleErrorSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          endpoint,
          error: expect.any(Error),
        })
      );
    });

    it("应该能够检测连接状态变化", async () => {
      const endpoint = "ws://localhost:8080";
      manager.addEndpoint(endpoint);

      // 模拟连接对象
      const mockConnection = {
        send: vi.fn(),
        readyState: 1,
        close: vi.fn(),
      };

      vi.spyOn(manager as any, "createConnection").mockResolvedValue(
        mockConnection
      );

      await manager.initialize([endpoint], tools);

      // 检查初始状态
      const initialStatus = manager.getConnectionStatus();
      expect(initialStatus[0].connected).toBe(true);

      // 模拟连接断开
      mockConnection.readyState = 3; // CLOSED

      // 再次检查状态
      const updatedStatus = manager.getConnectionStatus();
      expect(updatedStatus[0].connected).toBe(false);
    });
  });

  describe("执行固定间隔重连", () => {
    it("应该在连接失败时执行重连", async () => {
      const endpoint = "ws://localhost:8080";
      manager.addEndpoint(endpoint);

      let connectionAttempts = 0;

      // 模拟连接创建
      vi.spyOn(manager as any, "createConnection").mockImplementation(() => {
        connectionAttempts++;
        if (connectionAttempts <= 2) {
          return Promise.reject(new Error("连接失败"));
        }
        return Promise.resolve({
          send: vi.fn(),
          readyState: 1,
        });
      });

      // 启动定时器模拟
      vi.useFakeTimers();

      await manager.initialize([endpoint], tools);

      // 等待重连间隔
      await vi.advanceTimersByTimeAsync(1000);

      // 等待再次重连
      await vi.advanceTimersByTimeAsync(1000);

      // 验证重连次数
      expect(connectionAttempts).toBe(3); // 初始尝试 + 2次重连

      vi.useRealTimers();
    });

    it("应该限制最大重连次数", async () => {
      const endpoint = "ws://localhost:8080";
      manager.addEndpoint(endpoint);

      let connectionAttempts = 0;

      // 模拟连接创建 - 总是失败
      vi.spyOn(manager as any, "createConnection").mockImplementation(() => {
        connectionAttempts++;
        return Promise.reject(new Error("连接失败"));
      });

      // 启动定时器模拟
      vi.useFakeTimers();

      await manager.initialize([endpoint], tools);

      // 等待超过最大重连次数的时间
      await vi.advanceTimersByTimeAsync(5000); // 5秒

      // 验证重连次数不超过最大限制
      expect(connectionAttempts).toBe(3); // 初始尝试 + 2次重连（maxReconnectAttempts = 2）

      vi.useRealTimers();
    });

    it("应该在连接成功后停止重连", async () => {
      const endpoint = "ws://localhost:8080";
      manager.addEndpoint(endpoint);

      let connectionAttempts = 0;

      // 模拟连接创建 - 第二次尝试成功
      vi.spyOn(manager as any, "createConnection").mockImplementation(() => {
        connectionAttempts++;
        if (connectionAttempts === 1) {
          return Promise.reject(new Error("连接失败"));
        }
        return Promise.resolve({
          send: vi.fn(),
          readyState: 1,
        });
      });

      // 启动定时器模拟
      vi.useFakeTimers();

      await manager.initialize([endpoint], tools);

      // 等待重连
      await vi.advanceTimersByTimeAsync(1000);

      // 验证重连次数
      expect(connectionAttempts).toBe(2); // 初始尝试 + 1次重连

      // 等待更长时间，不应该有更多重连
      await vi.advanceTimersByTimeAsync(3000);

      // 验证重连次数没有增加
      expect(connectionAttempts).toBe(2);

      vi.useRealTimers();
    });

    it("应该使用固定的重连间隔", async () => {
      const endpoint = "ws://localhost:8080";
      manager.addEndpoint(endpoint);

      let connectionAttempts = 0;
      const reconnectTimes: number[] = [];

      // 模拟连接创建 - 总是失败
      vi.spyOn(manager as any, "createConnection").mockImplementation(() => {
        connectionAttempts++;
        reconnectTimes.push(Date.now());
        return Promise.reject(new Error("连接失败"));
      });

      // 启动定时器模拟
      vi.useFakeTimers();
      const startTime = Date.now();

      await manager.initialize([endpoint], tools);

      // 等待多次重连
      await vi.advanceTimersByTimeAsync(1000);
      await vi.advanceTimersByTimeAsync(1000);

      // 验证重连间隔
      expect(reconnectTimes).toHaveLength(3); // 初始尝试 + 2次重连

      // 检查重连间隔是否接近配置的间隔（1000ms）
      for (let i = 1; i < reconnectTimes.length; i++) {
        const interval = reconnectTimes[i] - reconnectTimes[i - 1];
        expect(interval).toBeCloseTo(1000, 0); // 允许小的误差
      }

      vi.useRealTimers();
    });
  });

  describe("验证无负载均衡行为", () => {
    it("应该为每个端点创建独立连接，不进行负载均衡", async () => {
      const endpoints = [
        "ws://localhost:8080",
        "ws://localhost:8081",
        "ws://localhost:8082",
      ];

      for (const endpoint of endpoints) {
        manager.addEndpoint(endpoint);
      }

      // 模拟连接创建
      const connectionMap = new Map<string, any>();
      vi.spyOn(manager as any, "createConnection").mockImplementation(
        (endpoint: string) => {
          const connection = {
            send: vi.fn(),
            readyState: 1,
            close: vi.fn(),
          };
          connectionMap.set(endpoint, connection);
          return Promise.resolve(connection);
        }
      );

      await manager.initialize([endpoint], tools);

      // 验证每个端点都有独立的连接
      expect(connectionMap.size).toBe(endpoints.length);
      for (const endpoint of endpoints) {
        expect(connectionMap.has(endpoint)).toBe(true);
      }

      // 验证连接之间没有负载均衡逻辑
      const status = manager.getConnectionStatus();
      for (const endpointStatus of status) {
        expect(endpointStatus).toHaveProperty("endpoint");
        expect(endpointStatus).toHaveProperty("connected");
        expect(endpointStatus).not.toHaveProperty("load"); // 没有负载信息
        expect(endpointStatus).not.toHaveProperty("priority"); // 没有优先级
      }
    });

    it("应该直接访问指定端点，不进行路由选择", async () => {
      const endpoints = ["ws://localhost:8080", "ws://localhost:8081"];

      for (const endpoint of endpoints) {
        manager.addEndpoint(endpoint);
      }

      // 模拟连接创建
      const connectionMap = new Map<string, any>();
      vi.spyOn(manager as any, "createConnection").mockImplementation(
        (endpoint: string) => {
          const connection = {
            send: vi.fn(),
            readyState: 1,
            close: vi.fn(),
          };
          connectionMap.set(endpoint, connection);
          return Promise.resolve(connection);
        }
      );

      await manager.initialize([endpoint], tools);

      // 直接访问指定端点
      const message = { type: "test", data: "hello" };
      await manager.sendMessage(endpoints[0], message);

      // 验证消息发送到正确的端点
      const targetConnection = connectionMap.get(endpoints[0]);
      expect(targetConnection?.send).toHaveBeenCalledWith(
        JSON.stringify(message)
      );

      // 验证其他连接没有被使用
      const otherConnection = connectionMap.get(endpoints[1]);
      expect(otherConnection?.send).not.toHaveBeenCalled();
    });

    it("不应该有故障转移逻辑", async () => {
      const endpoints = ["ws://localhost:8080", "ws://localhost:8081"];

      for (const endpoint of endpoints) {
        manager.addEndpoint(endpoint);
      }

      // 模拟第一个连接失败，第二个连接成功
      vi.spyOn(manager as any, "createConnection").mockImplementation(
        (endpoint: string) => {
          if (endpoint === endpoints[0]) {
            return Promise.reject(new Error("连接失败"));
          }
          return Promise.resolve({
            send: vi.fn(),
            readyState: 1,
            close: vi.fn(),
          });
        }
      );

      await manager.initialize([endpoint], tools);

      const status = manager.getConnectionStatus();

      // 第一个端点应该处于失败状态
      const firstStatus = status.find((s) => s.endpoint === endpoints[0]);
      expect(firstStatus?.connected).toBe(false);

      // 第二个端点应该正常连接
      const secondStatus = status.find((s) => s.endpoint === endpoints[1]);
      expect(secondStatus?.connected).toBe(true);

      // 验证没有故障转移逻辑
      // 如果有故障转移，第一个端点的状态可能会被第二个端点替代
      // 但在独立架构中，每个端点保持自己的状态
      expect(status).toHaveLength(2); // 两个端点都存在
    });

    it("应该保持每个端点的独立性", async () => {
      const endpoints = ["ws://localhost:8080", "ws://localhost:8081"];

      for (const endpoint of endpoints) {
        manager.addEndpoint(endpoint);
      }

      // 模拟连接创建
      const connectionMap = new Map<string, any>();
      vi.spyOn(manager as any, "createConnection").mockImplementation(
        (endpoint: string) => {
          const connection = {
            send: vi.fn(),
            readyState: 1,
            close: vi.fn(),
            lastMessage: null as any,
          };

          // 保存发送的消息
          connection.send = vi.fn((message: string) => {
            connection.lastMessage = JSON.parse(message);
          });

          connectionMap.set(endpoint, connection);
          return Promise.resolve(connection);
        }
      );

      await manager.initialize([endpoint], tools);

      // 向不同端点发送不同的消息
      await manager.sendMessage(endpoints[0], {
        type: "test1",
        data: "message1",
      });
      await manager.sendMessage(endpoints[1], {
        type: "test2",
        data: "message2",
      });

      // 验证每个端点接收到自己的消息
      const firstConnection = connectionMap.get(endpoints[0]);
      const secondConnection = connectionMap.get(endpoints[1]);

      expect(firstConnection?.lastMessage).toEqual({
        type: "test1",
        data: "message1",
      });
      expect(secondConnection?.lastMessage).toEqual({
        type: "test2",
        data: "message2",
      });

      // 验证消息没有交叉
      expect(firstConnection?.lastMessage).not.toEqual(
        secondConnection?.lastMessage
      );
    });
  });

  describe("事件处理", () => {
    it("应该在端点连接成功时发出事件", async () => {
      const endpoint = "ws://localhost:8080";
      manager.addEndpoint(endpoint);

      const eventSpy = vi.fn();
      manager.on("endpointConnected", eventSpy);

      // 模拟连接创建
      vi.spyOn(manager as any, "createConnection").mockResolvedValue({
        send: vi.fn(),
        readyState: 1,
      });

      await manager.initialize([endpoint], tools);

      expect(eventSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          endpoint,
          timestamp: expect.any(Date),
        })
      );
    });

    it("应该在端点断开连接时发出事件", async () => {
      const endpoint = "ws://localhost:8080";
      manager.addEndpoint(endpoint);

      const eventSpy = vi.fn();
      manager.on("endpointDisconnected", eventSpy);

      // 模拟连接创建
      const mockConnection = {
        send: vi.fn(),
        readyState: 1,
        close: vi.fn(),
      };

      vi.spyOn(manager as any, "createConnection").mockResolvedValue(
        mockConnection
      );

      await manager.initialize([endpoint], tools);

      // 模拟连接断开
      await manager.disconnectEndpoint(endpoint);

      expect(eventSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          endpoint,
          reason: expect.any(String),
          timestamp: expect.any(Date),
        })
      );
    });

    it("应该在端点连接失败时发出事件", async () => {
      const endpoint = "ws://localhost:8080";
      manager.addEndpoint(endpoint);

      const eventSpy = vi.fn();
      manager.on("endpointError", eventSpy);

      // 模拟连接失败
      vi.spyOn(manager as any, "createConnection").mockRejectedValue(
        new Error("连接失败")
      );

      await manager.initialize([endpoint], tools);

      expect(eventSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          endpoint,
          error: expect.any(Error),
          timestamp: expect.any(Date),
        })
      );
    });
  });

  describe("资源清理", () => {
    it("应该能够清理所有资源", async () => {
      const endpoints = ["ws://localhost:8080", "ws://localhost:8081"];

      for (const endpoint of endpoints) {
        manager.addEndpoint(endpoint);
      }

      // 模拟连接创建
      const mockConnections: any = {};
      vi.spyOn(manager as any, "createConnection").mockImplementation(
        (endpoint: string) => {
          const mockConnection = {
            send: vi.fn(),
            readyState: 1,
            close: vi.fn(),
          };
          mockConnections[endpoint] = mockConnection;
          return Promise.resolve(mockConnection);
        }
      );

      await manager.initialize([endpoint], tools);

      // 清理资源
      await manager.cleanup();

      // 验证所有连接都被关闭
      for (const connection of Object.values(mockConnections)) {
        expect(connection.close).toHaveBeenCalled();
      }

      // 验证状态被重置
      const status = manager.getConnectionStatus();
      expect(status).toHaveLength(0);
    });

    it("应该能够处理清理过程中的错误", async () => {
      const endpoint = "ws://localhost:8080";
      manager.addEndpoint(endpoint);

      // 模拟连接创建
      const mockConnection = {
        send: vi.fn(),
        readyState: 1,
        close: vi.fn().mockRejectedValue(new Error("关闭失败")),
      };

      vi.spyOn(manager as any, "createConnection").mockResolvedValue(
        mockConnection
      );

      await manager.initialize([endpoint], tools);

      // 清理资源应该仍然成功，即使单个连接关闭失败
      await expect(manager.cleanup()).resolves.not.toThrow();
    });
  });

  describe("错误处理", () => {
    it("应该正确处理无效的端点URL", () => {
      const invalidEndpoints = [
        "", // 空字符串
        "not-a-url", // 无效URL
        "http://no-websocket", // 非WebSocket协议
      ];

      for (const endpoint of invalidEndpoints) {
        expect(() => {
          manager.addEndpoint(endpoint);
        }).not.toThrow(); // 不应该抛出错误，但可能会在连接时失败
      }
    });

    it("应该正确处理重复的端点", () => {
      const endpoint = "ws://localhost:8080";

      // 添加同一个端点两次
      manager.addEndpoint(endpoint);
      manager.addEndpoint(endpoint);

      const endpoints = manager.getEndpoints();
      expect(endpoints).toHaveLength(1); // 应该只有一个端点
    });

    it("应该正确处理移除不存在的端点", () => {
      const endpoint = "ws://localhost:8080";

      expect(() => {
        manager.removeEndpoint(endpoint);
      }).not.toThrow(); // 不应该抛出错误
    });

    it("应该正确处理发送消息到不存在的端点", async () => {
      const endpoint = "ws://localhost:8080";
      const message = { type: "test", data: "hello" };

      await expect(manager.sendMessage(endpoint, message)).rejects.toThrow(
        "端点不存在"
      );
    });

    it("应该正确处理在未初始化状态下操作", async () => {
      const endpoint = "ws://localhost:8080";
      manager.addEndpoint(endpoint);

      const message = { type: "test", data: "hello" };

      await expect(manager.sendMessage(endpoint, message)).rejects.toThrow(
        "端点未连接"
      );
    });
  });

  describe("配置验证", () => {
    it("应该验证配置参数", () => {
      // 无效配置
      const invalidConfigs = [
        { reconnectInterval: -1 }, // 负数
        { maxReconnectAttempts: -1 }, // 负数
        { connectionTimeout: -1 }, // 负数
        { reconnectInterval: 0 }, // 零
      ];

      for (const config of invalidConfigs) {
        expect(() => {
          new IndependentXiaozhiConnectionManager(config);
        }).not.toThrow(); // 应该有默认值处理
      }
    });

    it("应该使用默认配置值", () => {
      const defaultManager = new IndependentXiaozhiConnectionManager();

      // 验证默认配置值
      expect(defaultManager.getEndpoints()).toHaveLength(0);
      expect(defaultManager.getConnectionStatus()).toHaveLength(0);
    });

    it("应该接受部分配置", () => {
      const partialConfigManager = new IndependentXiaozhiConnectionManager({
        reconnectInterval: 2000,
      });

      expect(partialConfigManager).toBeInstanceOf(
        IndependentXiaozhiConnectionManager
      );
    });
  });
});

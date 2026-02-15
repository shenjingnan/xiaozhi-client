/**
 * EndpointManager 单元测试
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { EndpointManager } from "../manager.js";
import { Endpoint } from "../endpoint.js";

// Mock Endpoint 类，内联定义到 vi.mock() 中以符合 Vitest 规范
vi.mock("../endpoint.js", () => ({
  Endpoint: class {
    private _connected = false;
    private _initialized = false;

    constructor(private url: string) {}

    getUrl(): string {
      return this.url;
    }

    async connect(): Promise<void> {
      this._connected = true;
      this._initialized = true;
    }

    async disconnect(): Promise<void> {
      this._connected = false;
      this._initialized = false;
    }

    async reconnect(): Promise<void> {
      this._connected = true;
      this._initialized = true;
    }

    isConnected(): boolean {
      return this._connected;
    }
  },
}));

describe("EndpointManager", () => {
  let manager: EndpointManager;
  let mockEndpoints: Endpoint[];

  beforeEach(() => {
    vi.clearAllMocks();

    manager = new EndpointManager({
      defaultReconnectDelay: 1000,
    });

    mockEndpoints = [
      new Endpoint("ws://endpoint1.example.com"),
      new Endpoint("ws://endpoint2.example.com"),
      new Endpoint("ws://endpoint3.example.com"),
    ];
  });

  describe("构造函数", () => {
    it("应该创建 EndpointManager 实例", () => {
      expect(manager).toBeInstanceOf(EndpointManager);
      expect(manager).toBeInstanceOf(require("node:events").EventEmitter);
    });

    it("应该接受可选配置", () => {
      const managerWithConfig = new EndpointManager({
        defaultReconnectDelay: 2000,
      });
      expect(managerWithConfig).toBeDefined();
    });

    it("初始端点列表应该为空", () => {
      expect(manager.getEndpoints()).toEqual([]);
    });
  });

  describe("addEndpoint", () => {
    it("应该成功添加端点", () => {
      manager.addEndpoint(mockEndpoints[0]);

      expect(manager.getEndpoints()).toHaveLength(1);
      expect(manager.getEndpoints()[0]).toBe("ws://endpoint1.example.com");
    });

    it("应该发射 endpointAdded 事件", () => {
      const eventSpy = vi.fn();
      manager.on("endpointAdded", eventSpy);

      manager.addEndpoint(mockEndpoints[0]);

      expect(eventSpy).toHaveBeenCalledWith({
        endpoint: "ws://endpoint1.example.com",
      });
    });

    it("应该添加多个端点", () => {
      manager.addEndpoint(mockEndpoints[0]);
      manager.addEndpoint(mockEndpoints[1]);
      manager.addEndpoint(mockEndpoints[2]);

      expect(manager.getEndpoints()).toHaveLength(3);
    });

    it("应该忽略重复的端点", () => {
      manager.addEndpoint(mockEndpoints[0]);
      manager.addEndpoint(mockEndpoints[0]); // 重复添加

      expect(manager.getEndpoints()).toHaveLength(1);
    });

    it("重复添加端点时不应该发射事件", () => {
      const eventSpy = vi.fn();
      manager.on("endpointAdded", eventSpy);

      manager.addEndpoint(mockEndpoints[0]);
      manager.addEndpoint(mockEndpoints[0]); // 重复添加

      expect(eventSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe("removeEndpoint", () => {
    beforeEach(() => {
      manager.addEndpoint(mockEndpoints[0]);
      manager.addEndpoint(mockEndpoints[1]);
    });

    it("应该成功移除端点", async () => {
      await manager.removeEndpoint(mockEndpoints[0]);

      expect(manager.getEndpoints()).toHaveLength(1);
      expect(manager.getEndpoints()[0]).toBe("ws://endpoint2.example.com");
    });

    it("应该发射 endpointRemoved 事件", async () => {
      const eventSpy = vi.fn();
      manager.on("endpointRemoved", eventSpy);

      await manager.removeEndpoint(mockEndpoints[0]);

      expect(eventSpy).toHaveBeenCalledWith({
        endpoint: "ws://endpoint1.example.com",
      });
    });

    it("移除不存在的端点不应该报错", async () => {
      const nonexistentEndpoint = new Endpoint("ws://nonexistent.com");

      await expect(
        manager.removeEndpoint(nonexistentEndpoint)
      ).resolves.not.toThrow();
    });

    it("移除不存在的端点时不应该发射事件", async () => {
      const eventSpy = vi.fn();
      manager.on("endpointRemoved", eventSpy);

      const nonexistentEndpoint = new Endpoint("ws://nonexistent.com");
      await manager.removeEndpoint(nonexistentEndpoint);

      expect(eventSpy).not.toHaveBeenCalled();
    });
  });

  describe("connect", () => {
    beforeEach(() => {
      manager.addEndpoint(mockEndpoints[0]);
      manager.addEndpoint(mockEndpoints[1]);
      manager.addEndpoint(mockEndpoints[2]);
    });

    it("应该连接所有端点", async () => {
      await manager.connect();

      const status = manager.getConnectionStatus();
      expect(status[0].connected).toBe(true);
      expect(status[1].connected).toBe(true);
      expect(status[2].connected).toBe(true);
    });

    it("应该更新连接状态", async () => {
      await manager.connect();

      expect(manager.isAnyConnected()).toBe(true);
    });

    it("应该处理连接失败", async () => {
      // 创建一个会失败的端点
      const failingEndpoint = new Endpoint("ws://failing.com");
      vi.spyOn(failingEndpoint, "connect").mockRejectedValue(new Error("连接失败"));

      manager.addEndpoint(failingEndpoint);

      await expect(manager.connect()).resolves.toBeUndefined();

      // 其他端点应该仍然连接
      expect(manager.isAnyConnected()).toBe(true);
    });

    it("空端点列表应该不报错", async () => {
      const emptyManager = new EndpointManager();
      await expect(emptyManager.connect()).resolves.toBeUndefined();
    });
  });

  describe("disconnect", () => {
    beforeEach(async () => {
      manager.addEndpoint(mockEndpoints[0]);
      manager.addEndpoint(mockEndpoints[1]);

      await manager.connect();
    });

    it("应该断开所有端点", async () => {
      await manager.disconnect();

      expect(manager.isAnyConnected()).toBe(false);
      const status = manager.getConnectionStatus();
      expect(status[0].connected).toBe(false);
      expect(status[1].connected).toBe(false);
    });

    it("应该重置所有状态", async () => {
      await manager.disconnect();

      const status = manager.getConnectionStatus();
      expect(status[0].initialized).toBe(false);
      expect(status[1].initialized).toBe(false);
    });

    it("空端点列表应该不报错", async () => {
      const emptyManager = new EndpointManager();
      await expect(emptyManager.disconnect()).resolves.toBeUndefined();
    });

    it("重复断开应该不报错", async () => {
      await manager.disconnect();
      await expect(manager.disconnect()).resolves.toBeUndefined();
    });
  });

  describe("getEndpoints", () => {
    it("应该返回所有端点 URL", () => {
      manager.addEndpoint(mockEndpoints[0]);
      manager.addEndpoint(mockEndpoints[1]);
      manager.addEndpoint(mockEndpoints[2]);

      const endpoints = manager.getEndpoints();
      expect(endpoints).toEqual([
        "ws://endpoint1.example.com",
        "ws://endpoint2.example.com",
        "ws://endpoint3.example.com",
      ]);
    });

    it("空列表应该返回空数组", () => {
      expect(manager.getEndpoints()).toEqual([]);
    });

    it("返回的应该是新数组", () => {
      manager.addEndpoint(mockEndpoints[0]);
      const endpoints1 = manager.getEndpoints();
      const endpoints2 = manager.getEndpoints();

      expect(endpoints1).not.toBe(endpoints2);
      expect(endpoints1).toEqual(endpoints2);
    });
  });

  describe("getEndpoint", () => {
    beforeEach(() => {
      manager.addEndpoint(mockEndpoints[0]);
      manager.addEndpoint(mockEndpoints[1]);
    });

    it("应该返回指定 URL 的端点", () => {
      const endpoint = manager.getEndpoint("ws://endpoint1.example.com");
      expect(endpoint).toBe(mockEndpoints[0]);
    });

    it("不存在的端点应该返回 undefined", () => {
      const endpoint = manager.getEndpoint("ws://nonexistent.com");
      expect(endpoint).toBeUndefined();
    });
  });

  describe("getConnectionStatus", () => {
    beforeEach(() => {
      manager.addEndpoint(mockEndpoints[0]);
      manager.addEndpoint(mockEndpoints[1]);
    });

    it("应该返回所有端点的连接状态", () => {
      const status = manager.getConnectionStatus();

      expect(status).toHaveLength(2);
      expect(status[0].endpoint).toBe("ws://endpoint1.example.com");
      expect(status[1].endpoint).toBe("ws://endpoint2.example.com");
    });

    it("连接后应该返回正确的状态", async () => {
      await manager.connect();

      const status = manager.getConnectionStatus();
      expect(status[0].connected).toBe(true);
      expect(status[0].initialized).toBe(true);
      expect(status[0].lastConnected).toBeInstanceOf(Date);
    });

    it("空列表应该返回空数组", () => {
      const emptyManager = new EndpointManager();
      expect(emptyManager.getConnectionStatus()).toEqual([]);
    });
  });

  describe("isAnyConnected", () => {
    beforeEach(() => {
      manager.addEndpoint(mockEndpoints[0]);
      manager.addEndpoint(mockEndpoints[1]);
    });

    it("未连接时应该返回 false", () => {
      expect(manager.isAnyConnected()).toBe(false);
    });

    it("全部连接时应该返回 true", async () => {
      await manager.connect();
      expect(manager.isAnyConnected()).toBe(true);
    });

    it("部分连接时应该返回 true", async () => {
      await mockEndpoints[0].connect();

      const status = manager.getConnectionStatus();
      status[0].connected = true;

      expect(manager.isAnyConnected()).toBe(true);
    });

    it("全部断开时应该返回 false", async () => {
      await manager.connect();
      await manager.disconnect();

      expect(manager.isAnyConnected()).toBe(false);
    });
  });

  describe("isEndpointConnected", () => {
    beforeEach(() => {
      manager.addEndpoint(mockEndpoints[0]);
      manager.addEndpoint(mockEndpoints[1]);
    });

    it("未连接时应该返回 false", () => {
      expect(manager.isEndpointConnected("ws://endpoint1.example.com")).toBe(false);
    });

    it("连接后应该返回 true", async () => {
      await manager.connect();

      expect(manager.isEndpointConnected("ws://endpoint1.example.com")).toBe(true);
    });

    it("不存在的端点应该返回 false", () => {
      expect(manager.isEndpointConnected("ws://nonexistent.com")).toBe(false);
    });
  });

  describe("getEndpointStatus", () => {
    beforeEach(() => {
      manager.addEndpoint(mockEndpoints[0]);
      manager.addEndpoint(mockEndpoints[1]);
    });

    it("应该返回指定端点的状态", () => {
      const status = manager.getEndpointStatus("ws://endpoint1.example.com");

      expect(status).toBeDefined();
      expect(status?.endpoint).toBe("ws://endpoint1.example.com");
      expect(status?.connected).toBe(false);
      expect(status?.initialized).toBe(false);
    });

    it("不存在的端点应该返回 undefined", () => {
      const status = manager.getEndpointStatus("ws://nonexistent.com");
      expect(status).toBeUndefined();
    });

    it("连接后应该更新状态", async () => {
      await manager.connect();

      const status = manager.getEndpointStatus("ws://endpoint1.example.com");
      expect(status?.connected).toBe(true);
      expect(status?.initialized).toBe(true);
      expect(status?.lastConnected).toBeInstanceOf(Date);
    });
  });

  describe("reconnectAll", () => {
    beforeEach(async () => {
      manager.addEndpoint(mockEndpoints[0]);
      manager.addEndpoint(mockEndpoints[1]);

      await manager.connect();
    });

    it("应该重连所有端点", async () => {
      await manager.reconnectAll();

      expect(manager.isAnyConnected()).toBe(true);
    });

    it("应该更新重连后的状态", async () => {
      await manager.reconnectAll();

      const status = manager.getConnectionStatus();
      expect(status[0].connected).toBe(true);
      expect(status[1].connected).toBe(true);
    });

    it("应该处理部分重连失败", async () => {
      // Mock 一个端点重连失败
      vi.spyOn(mockEndpoints[0], "reconnect").mockRejectedValue(new Error("重连失败"));

      await expect(manager.reconnectAll()).resolves.toBeUndefined();

      // 至少有一个端点连接成功
      expect(manager.isAnyConnected()).toBe(true);
    });
  });

  describe("reconnectEndpoint", () => {
    beforeEach(async () => {
      manager.addEndpoint(mockEndpoints[0]);
      manager.addEndpoint(mockEndpoints[1]);

      await manager.connect();
    });

    it("应该重连指定的端点", async () => {
      await manager.reconnectEndpoint("ws://endpoint1.example.com");

      expect(manager.isEndpointConnected("ws://endpoint1.example.com")).toBe(true);
    });

    it("重连不存在的端点应该抛出错误", async () => {
      await expect(
        manager.reconnectEndpoint("ws://nonexistent.com")
      ).rejects.toThrow("接入点不存在");
    });

    it("应该更新重连后的状态", async () => {
      // 先断开
      await mockEndpoints[0].disconnect();

      // 重连
      await manager.reconnectEndpoint("ws://endpoint1.example.com");

      expect(manager.isEndpointConnected("ws://endpoint1.example.com")).toBe(true);
    });
  });

  describe("reconnect", () => {
    beforeEach(async () => {
      manager.addEndpoint(mockEndpoints[0]);
      manager.addEndpoint(mockEndpoints[1]);

      await manager.connect();
    });

    it("应该重连所有端点（不传参数）", async () => {
      await manager.reconnect();

      expect(manager.isAnyConnected()).toBe(true);
      const status = manager.getConnectionStatus();
      expect(status[0].connected).toBe(true);
      expect(status[1].connected).toBe(true);
    });

    it("应该重连单个端点（传入 endpoint 参数）", async () => {
      await manager.reconnect("ws://endpoint1.example.com");

      expect(manager.isEndpointConnected("ws://endpoint1.example.com")).toBe(true);
    });

    it("应该支持自定义延迟参数", async () => {
      const startTime = Date.now();

      await manager.reconnect("ws://endpoint1.example.com", 100);

      const elapsed = Date.now() - startTime;
      expect(elapsed).toBeGreaterThanOrEqual(100);
      expect(manager.isEndpointConnected("ws://endpoint1.example.com")).toBe(true);
    });

    it("重连不存在的端点应该抛出错误", async () => {
      await expect(manager.reconnect("ws://nonexistent.com")).rejects.toThrow(
        "接入点不存在"
      );
    });

    it("重连所有端点后应该更新状态", async () => {
      // 先断开所有连接
      await manager.disconnect();

      // 重连所有端点
      await manager.reconnect();

      const status = manager.getConnectionStatus();
      expect(status[0].connected).toBe(true);
      expect(status[1].connected).toBe(true);
      expect(status[0].initialized).toBe(true);
      expect(status[1].initialized).toBe(true);
      expect(status[0].lastConnected).toBeInstanceOf(Date);
      expect(status[1].lastConnected).toBeInstanceOf(Date);
    });

    it("重连单个端点后应该更新状态", async () => {
      // 先断开单个端点
      await manager.disconnect("ws://endpoint1.example.com");

      // 重连该端点
      await manager.reconnect("ws://endpoint1.example.com");

      const status = manager.getEndpointStatus("ws://endpoint1.example.com");
      expect(status?.connected).toBe(true);
      expect(status?.initialized).toBe(true);
      expect(status?.lastConnected).toBeInstanceOf(Date);
    });
  });

  describe("clearEndpoints", () => {
    beforeEach(async () => {
      manager.addEndpoint(mockEndpoints[0]);
      manager.addEndpoint(mockEndpoints[1]);

      await manager.connect();
    });

    it("应该清除所有端点", async () => {
      await manager.clearEndpoints();

      expect(manager.getEndpoints()).toHaveLength(0);
    });

    it("应该断开所有连接", async () => {
      await manager.clearEndpoints();

      expect(manager.isAnyConnected()).toBe(false);
    });

    it("清除后可以添加新端点", async () => {
      await manager.clearEndpoints();

      const newEndpoint = new Endpoint("ws://new.com");
      manager.addEndpoint(newEndpoint);

      expect(manager.getEndpoints()).toHaveLength(1);
    });
  });

  describe("cleanup", () => {
    beforeEach(async () => {
      manager.addEndpoint(mockEndpoints[0]);
      manager.addEndpoint(mockEndpoints[1]);

      await manager.connect();
    });

    it("应该清理所有资源", async () => {
      await manager.cleanup();

      expect(manager.getEndpoints()).toHaveLength(0);
      expect(manager.isAnyConnected()).toBe(false);
    });

    it("可以多次调用 cleanup", async () => {
      await manager.cleanup();
      await expect(manager.cleanup()).resolves.toBeUndefined();
    });
  });

  describe("setMcpManager", () => {
    it("应该成功设置 MCPManager", () => {
      const mockMcpManager = {
        getAllTools: vi.fn(),
        callTool: vi.fn(),
      };

      manager.setMcpManager(mockMcpManager);

      expect(manager["sharedMCPAdapter"]).toBeDefined();
    });

    it("重复设置应该抛出错误", () => {
      const mockMcpManager = {
        getAllTools: vi.fn(),
        callTool: vi.fn(),
      };

      manager.setMcpManager(mockMcpManager);

      expect(() => {
        manager.setMcpManager(mockMcpManager);
      }).toThrow("MCPManager 已经设置，不能重复设置");
    });

    it("未设置 MCPManager 时添加字符串端点应该抛出错误", () => {
      const managerWithoutMcp = new EndpointManager();

      expect(() => {
        managerWithoutMcp.addEndpoint("ws://example.com");
      }).toThrow("MCPManager 未设置");
    });
  });

  describe("事件发射", () => {
    it("应该正确发射 endpointAdded 事件", () => {
      const spy = vi.fn();
      manager.on("endpointAdded", spy);

      manager.addEndpoint(mockEndpoints[0]);
      manager.addEndpoint(mockEndpoints[1]);

      expect(spy).toHaveBeenCalledTimes(2);
      expect(spy).toHaveBeenNthCalledWith(1, {
        endpoint: "ws://endpoint1.example.com",
      });
      expect(spy).toHaveBeenNthCalledWith(2, {
        endpoint: "ws://endpoint2.example.com",
      });
    });

    it("应该正确发射 endpointRemoved 事件", async () => {
      const spy = vi.fn();
      manager.on("endpointRemoved", spy);

      manager.addEndpoint(mockEndpoints[0]);
      manager.addEndpoint(mockEndpoints[1]);
      await manager.removeEndpoint(mockEndpoints[0]);

      expect(spy).toHaveBeenCalledTimes(1);
      expect(spy).toHaveBeenCalledWith({
        endpoint: "ws://endpoint1.example.com",
      });
    });

    it("多个监听器应该都能收到事件", () => {
      const spy1 = vi.fn();
      const spy2 = vi.fn();

      manager.on("endpointAdded", spy1);
      manager.on("endpointAdded", spy2);

      manager.addEndpoint(mockEndpoints[0]);

      expect(spy1).toHaveBeenCalled();
      expect(spy2).toHaveBeenCalled();
    });
  });

  describe("边界情况", () => {
    it("应该处理大量端点", async () => {
      const endpoints: Endpoint[] = [];
      for (let i = 0; i < 100; i++) {
        const endpoint = new Endpoint(`ws://endpoint${i}.com`);
        endpoints.push(endpoint);
        manager.addEndpoint(endpoint);
      }

      expect(manager.getEndpoints()).toHaveLength(100);

      await manager.connect();
      expect(manager.isAnyConnected()).toBe(true);
    });

    it("应该处理快速添加和移除", async () => {
      for (let i = 0; i < 10; i++) {
        manager.addEndpoint(new Endpoint(`ws://endpoint${i}.com`));
      }

      for (let i = 0; i < 10; i++) {
        if (i % 2 === 0) {
          await manager.removeEndpoint(mockEndpoints[0] || mockEndpoints[i]);
        }
      }

      expect(manager.getEndpoints()).toBeDefined();
    });

    it("应该处理空的管理器", () => {
      const emptyManager = new EndpointManager();

      expect(emptyManager.getEndpoints()).toEqual([]);
      expect(emptyManager.getConnectionStatus()).toEqual([]);
      expect(emptyManager.isAnyConnected()).toBe(false);
    });
  });
});

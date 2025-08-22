import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { WebSocketManager, WebSocketState } from "../WebSocketManager";

// Mock WebSocket
class MockWebSocket {
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSING = 2;
  static CLOSED = 3;

  readyState = MockWebSocket.CONNECTING;
  url: string;
  onopen: ((event: Event) => void) | null = null;
  onclose: ((event: CloseEvent) => void) | null = null;
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;

  constructor(url: string) {
    this.url = url;
    // 模拟异步连接
    setTimeout(() => {
      this.readyState = MockWebSocket.OPEN;
      if (this.onopen) {
        this.onopen(new Event("open"));
      }
    }, 10);
  }

  send(data: string) {
    console.log("MockWebSocket send:", data);
  }

  close() {
    this.readyState = MockWebSocket.CLOSED;
    if (this.onclose) {
      this.onclose(new CloseEvent("close"));
    }
  }

  // 测试辅助方法
  simulateOpen() {
    this.readyState = MockWebSocket.OPEN;
    if (this.onopen) {
      this.onopen(new Event("open"));
    }
  }

  simulateClose() {
    this.readyState = MockWebSocket.CLOSED;
    if (this.onclose) {
      this.onclose(new CloseEvent("close"));
    }
  }

  simulateError() {
    if (this.onerror) {
      this.onerror(new Event("error"));
    }
  }

  simulateMessage(data: any) {
    if (this.onmessage) {
      this.onmessage(
        new MessageEvent("message", { data: JSON.stringify(data) })
      );
    }
  }
}

// Mock localStorage
const mockLocalStorage = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
};

// Mock window.location
const mockLocation = {
  reload: vi.fn(),
  port: "",
  protocol: "http:",
};

// Mock portUtils
vi.mock("../../utils/portUtils", () => ({
  buildWebSocketUrl: vi.fn((port: number) => `ws://localhost:${port}/ws`),
  checkPortAvailability: vi.fn().mockResolvedValue(true),
  extractPortFromUrl: vi.fn((url: string) => {
    const match = url.match(/:(\d+)/);
    return match ? Number.parseInt(match[1]) : null;
  }),
  pollPortUntilAvailable: vi.fn().mockResolvedValue(true),
}));

describe("WebSocketManager", () => {
  let manager: WebSocketManager;

  beforeEach(() => {
    // 重置所有 mock
    vi.clearAllMocks();

    // Mock 全局对象
    global.WebSocket = MockWebSocket as any;
    global.localStorage = mockLocalStorage as any;
    global.window = { location: mockLocation } as any;

    // 重置 localStorage mock
    mockLocalStorage.getItem.mockReturnValue(null);

    // 销毁现有实例
    WebSocketManager.destroy();

    // 获取新实例
    manager = WebSocketManager.getInstance();
  });

  afterEach(() => {
    // 清理
    manager.reset();
    WebSocketManager.destroy();
  });

  describe("单例模式", () => {
    it("应该返回同一个实例", () => {
      const instance1 = WebSocketManager.getInstance();
      const instance2 = WebSocketManager.getInstance();
      expect(instance1).toBe(instance2);
    });

    it("销毁后应该能创建新实例", () => {
      const instance1 = WebSocketManager.getInstance();
      WebSocketManager.destroy();
      const instance2 = WebSocketManager.getInstance();
      expect(instance1).not.toBe(instance2);
    });
  });

  describe("连接管理", () => {
    it("初始状态应该是 DISCONNECTED", () => {
      expect(manager.getState()).toBe(WebSocketState.DISCONNECTED);
      expect(manager.isConnected()).toBe(false);
    });

    it("应该能够成功连接", async () => {
      const stateChanges: WebSocketState[] = [];
      manager.on("stateChange", (state) => stateChanges.push(state));

      const connectPromise = manager.connect("ws://localhost:9999/ws");

      // 等待连接完成
      await connectPromise;

      expect(stateChanges).toEqual([
        WebSocketState.CONNECTING,
        WebSocketState.CONNECTED,
      ]);
      expect(manager.isConnected()).toBe(true);
    });

    it("应该能够断开连接", async () => {
      await manager.connect("ws://localhost:9999/ws");
      expect(manager.isConnected()).toBe(true);

      manager.disconnect();
      expect(manager.getState()).toBe(WebSocketState.DISCONNECTED);
      expect(manager.isConnected()).toBe(false);
    });

    it("重复连接应该被忽略", async () => {
      await manager.connect("ws://localhost:9999/ws");
      expect(manager.isConnected()).toBe(true);

      // 再次连接应该不会改变状态
      await manager.connect("ws://localhost:9999/ws");
      expect(manager.isConnected()).toBe(true);
    });
  });

  describe("事件系统", () => {
    it("应该能够注册和触发事件监听器", () => {
      const mockListener = vi.fn();
      manager.on("stateChange", mockListener);

      // 手动触发状态变化
      (manager as any).setState(WebSocketState.CONNECTING);

      expect(mockListener).toHaveBeenCalledWith(WebSocketState.CONNECTING);
    });

    it("应该能够移除事件监听器", () => {
      const mockListener = vi.fn();
      manager.on("stateChange", mockListener);
      manager.off("stateChange", mockListener);

      // 触发事件
      (manager as any).setState(WebSocketState.CONNECTING);

      expect(mockListener).not.toHaveBeenCalled();
    });

    it("应该能够处理多个监听器", () => {
      const listener1 = vi.fn();
      const listener2 = vi.fn();

      manager.on("stateChange", listener1);
      manager.on("stateChange", listener2);

      (manager as any).setState(WebSocketState.CONNECTING);

      expect(listener1).toHaveBeenCalledWith(WebSocketState.CONNECTING);
      expect(listener2).toHaveBeenCalledWith(WebSocketState.CONNECTING);
    });
  });

  describe("消息处理", () => {
    it("应该能够发送消息", async () => {
      const mockWs = new MockWebSocket("ws://localhost:9999/ws");
      const sendSpy = vi.spyOn(mockWs, "send");

      await manager.connect("ws://localhost:9999/ws");

      // 替换内部 WebSocket 实例
      (manager as any).ws = mockWs;
      mockWs.readyState = MockWebSocket.OPEN;

      const message = { type: "test", data: "hello" };
      manager.send(message);

      expect(sendSpy).toHaveBeenCalledWith(JSON.stringify(message));
    });

    it("未连接时发送消息应该抛出错误", () => {
      expect(() => {
        manager.send({ type: "test" });
      }).toThrow("WebSocket 未连接");
    });

    it("应该能够处理接收到的消息", async () => {
      const configListener = vi.fn();
      const statusListener = vi.fn();

      manager.on("configUpdate", configListener);
      manager.on("statusUpdate", statusListener);

      await manager.connect("ws://localhost:9999/ws");

      const mockWs = (manager as any).ws as MockWebSocket;

      // 模拟接收配置消息
      const configData = { mcpEndpoint: "test", mcpServers: {} };
      mockWs.simulateMessage({ type: "config", data: configData });

      expect(configListener).toHaveBeenCalledWith(configData);

      // 模拟接收状态消息
      const statusData = {
        status: "connected",
        mcpEndpoint: "test",
        activeMCPServers: [],
      };
      mockWs.simulateMessage({ type: "status", data: statusData });

      expect(statusListener).toHaveBeenCalledWith(statusData);
    });
  });

  describe("URL 管理", () => {
    it("应该使用 localStorage 中保存的 URL", () => {
      mockLocalStorage.getItem.mockReturnValue("ws://custom:8888/ws");

      // 销毁现有实例并创建新实例以重新读取 localStorage
      WebSocketManager.destroy();
      const newManager = WebSocketManager.getInstance();
      expect(newManager.getCurrentUrl()).toBe("ws://custom:8888/ws");
    });

    it("应该根据当前页面端口生成默认 URL", () => {
      mockLocation.port = "3000";

      WebSocketManager.destroy();
      const newManager = WebSocketManager.getInstance();

      expect(newManager.getCurrentUrl()).toBe("ws://localhost:3000/ws");
    });

    it("应该能够设置自定义 URL", () => {
      const reloadSpy = vi.spyOn(mockLocation, "reload");

      manager.setCustomUrl("ws://custom:8888/ws");

      expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
        "xiaozhi-ws-url",
        "ws://custom:8888/ws"
      );
      expect(reloadSpy).toHaveBeenCalled();
    });
  });
});

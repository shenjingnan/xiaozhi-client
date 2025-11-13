import { ConnectionState } from "@services/websocket";
import { beforeEach, describe, expect, it } from "vitest";
import { useWebSocketStore } from "../websocket";

describe("WebSocket Store - 连接状态管理", () => {
  beforeEach(() => {
    // 重置 store 状态
    useWebSocketStore.getState().reset();
  });

  describe("连接状态管理", () => {
    it("应该正确设置连接状态", () => {
      const store = useWebSocketStore.getState();

      // 测试设置为连接中
      store.setConnectionState(ConnectionState.CONNECTING);
      expect(useWebSocketStore.getState().connectionState).toBe(
        ConnectionState.CONNECTING
      );

      // 测试设置为已连接
      store.setConnectionState(ConnectionState.CONNECTED);
      expect(useWebSocketStore.getState().connectionState).toBe(
        ConnectionState.CONNECTED
      );

      // 测试设置为断开连接
      store.setConnectionState(ConnectionState.DISCONNECTED);
      expect(useWebSocketStore.getState().connectionState).toBe(
        ConnectionState.DISCONNECTED
      );
    });

    it("应该正确设置 WebSocket URL", () => {
      const store = useWebSocketStore.getState();
      const testUrl = "ws://localhost:9999/ws";

      store.setWsUrl(testUrl);
      expect(useWebSocketStore.getState().wsUrl).toBe(testUrl);
    });

    it("应该正确设置连接统计信息", () => {
      const store = useWebSocketStore.getState();
      const stats = {
        reconnectAttempts: 3,
        maxReconnectAttempts: 5,
        lastHeartbeat: Date.now(),
        eventListenerCount: 2,
      };

      store.setConnectionStats(stats);
      expect(useWebSocketStore.getState().connectionStats).toEqual(stats);
    });

    it("应该正确设置最后的连接错误", () => {
      const store = useWebSocketStore.getState();
      const error = new Error("连接失败");

      store.setLastError(error);
      expect(useWebSocketStore.getState().lastError).toBe(error);

      // 测试清除错误
      store.setLastError(null);
      expect(useWebSocketStore.getState().lastError).toBeNull();
    });

    it("应该正确设置端口变更状态", () => {
      const store = useWebSocketStore.getState();
      const portChangeStatus = {
        status: "checking" as const,
        targetPort: 8080,
        timestamp: Date.now(),
      };

      store.setPortChangeStatus(portChangeStatus);
      expect(useWebSocketStore.getState().portChangeStatus).toEqual(
        portChangeStatus
      );
    });
  });

  describe("向后兼容方法", () => {
    it("setConnected 方法应该正确映射到 setConnectionState", () => {
      const store = useWebSocketStore.getState();

      // 测试设置为已连接
      store.setConnected(true);
      expect(useWebSocketStore.getState().connectionState).toBe(
        ConnectionState.CONNECTED
      );

      // 测试设置为断开连接
      store.setConnected(false);
      expect(useWebSocketStore.getState().connectionState).toBe(
        ConnectionState.DISCONNECTED
      );
    });
  });

  describe("store 重置", () => {
    it("应该能够重置所有状态到初始值", () => {
      const store = useWebSocketStore.getState();

      // 设置一些状态
      store.setConnectionState(ConnectionState.CONNECTED);
      store.setWsUrl("ws://test.com");
      store.setLastError(new Error("test error"));

      // 重置状态
      store.reset();

      // 验证状态被重置
      const state = useWebSocketStore.getState();
      expect(state.connectionState).toBe(ConnectionState.DISCONNECTED);
      expect(state.wsUrl).toBe("");
      expect(state.lastError).toBeNull();
    });
  });
});

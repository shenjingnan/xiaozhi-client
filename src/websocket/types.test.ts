/**
 * WebSocket 类型定义测试
 * 测试 WebSocket 相关类型的正确性
 */

import { describe, expect, it } from "vitest";
import {
  type ConfigMessage,
  type ErrorMessage,
  type HeartbeatMessage,
  type ServiceMessage,
  type StatusMessage,
  type WebSocketConnectionInfo,
  WebSocketConnectionState,
  WebSocketMessageType,
} from "./types.js";

describe("WebSocket Types", () => {
  describe("WebSocketMessageType 枚举", () => {
    it("应该包含所有必要的消息类型", () => {
      expect(WebSocketMessageType.GET_CONFIG).toBe("getConfig");
      expect(WebSocketMessageType.UPDATE_CONFIG).toBe("updateConfig");
      expect(WebSocketMessageType.CONFIG_UPDATE).toBe("configUpdate");
      expect(WebSocketMessageType.GET_STATUS).toBe("getStatus");
      expect(WebSocketMessageType.CLIENT_STATUS).toBe("clientStatus");
      expect(WebSocketMessageType.STATUS_UPDATE).toBe("statusUpdate");
      expect(WebSocketMessageType.RESTART_SERVICE).toBe("restartService");
      expect(WebSocketMessageType.RESTART_STATUS).toBe("restartStatus");
      expect(WebSocketMessageType.ERROR).toBe("error");
      expect(WebSocketMessageType.HEARTBEAT).toBe("heartbeat");
    });
  });

  describe("WebSocketConnectionState 枚举", () => {
    it("应该包含所有连接状态", () => {
      expect(WebSocketConnectionState.CONNECTING).toBe("connecting");
      expect(WebSocketConnectionState.CONNECTED).toBe("connected");
      expect(WebSocketConnectionState.DISCONNECTING).toBe("disconnecting");
      expect(WebSocketConnectionState.DISCONNECTED).toBe("disconnected");
    });
  });

  describe("消息接口类型", () => {
    it("应该正确定义 ConfigMessage 接口", () => {
      const getConfigMessage: ConfigMessage = {
        type: WebSocketMessageType.GET_CONFIG,
      };

      const updateConfigMessage: ConfigMessage = {
        type: WebSocketMessageType.UPDATE_CONFIG,
        config: { test: true },
      };

      expect(getConfigMessage.type).toBe("getConfig");
      expect(updateConfigMessage.type).toBe("updateConfig");
      expect(updateConfigMessage.config).toEqual({ test: true });
    });

    it("应该正确定义 StatusMessage 接口", () => {
      const getStatusMessage: StatusMessage = {
        type: WebSocketMessageType.GET_STATUS,
      };

      const clientStatusMessage: StatusMessage = {
        type: WebSocketMessageType.CLIENT_STATUS,
        data: { status: "connected" },
      };

      expect(getStatusMessage.type).toBe("getStatus");
      expect(clientStatusMessage.type).toBe("clientStatus");
      expect(clientStatusMessage.data).toEqual({ status: "connected" });
    });

    it("应该正确定义 ServiceMessage 接口", () => {
      const serviceMessage: ServiceMessage = {
        type: WebSocketMessageType.RESTART_SERVICE,
        data: { force: true },
      };

      expect(serviceMessage.type).toBe("restartService");
      expect(serviceMessage.data).toEqual({ force: true });
    });

    it("应该正确定义 ErrorMessage 接口", () => {
      const errorMessage: ErrorMessage = {
        type: WebSocketMessageType.ERROR,
        error: "Test error",
        timestamp: Date.now(),
      };

      expect(errorMessage.type).toBe("error");
      expect(errorMessage.error).toBe("Test error");
      expect(typeof errorMessage.timestamp).toBe("number");
    });

    it("应该正确定义 HeartbeatMessage 接口", () => {
      const heartbeatMessage: HeartbeatMessage = {
        type: WebSocketMessageType.HEARTBEAT,
        timestamp: Date.now(),
      };

      expect(heartbeatMessage.type).toBe("heartbeat");
      expect(typeof heartbeatMessage.timestamp).toBe("number");
    });
  });

  describe("WebSocketConnectionInfo 接口", () => {
    it("应该正确定义连接信息接口", () => {
      const now = new Date();
      const connectionInfo: WebSocketConnectionInfo = {
        id: "test-connection-123",
        state: WebSocketConnectionState.CONNECTED,
        connectedAt: now,
        lastActivity: now,
        messageCount: 42,
      };

      expect(connectionInfo.id).toBe("test-connection-123");
      expect(connectionInfo.state).toBe("connected");
      expect(connectionInfo.connectedAt).toBe(now);
      expect(connectionInfo.lastActivity).toBe(now);
      expect(connectionInfo.messageCount).toBe(42);
    });

    it("应该支持所有连接状态", () => {
      const states = [
        WebSocketConnectionState.CONNECTING,
        WebSocketConnectionState.CONNECTED,
        WebSocketConnectionState.DISCONNECTING,
        WebSocketConnectionState.DISCONNECTED,
      ];

      for (const state of states) {
        const connectionInfo: WebSocketConnectionInfo = {
          id: "test",
          state,
          connectedAt: new Date(),
          lastActivity: new Date(),
          messageCount: 0,
        };

        expect(connectionInfo.state).toBe(state);
      }
    });
  });
});

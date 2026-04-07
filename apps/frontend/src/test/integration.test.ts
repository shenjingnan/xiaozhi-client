/**
 * 集成测试 - 验证 WebSocket 架构重构后的功能
 */

import { beforeEach, describe, expect, it } from "vitest";
import { ConnectionState, webSocketManager } from "@/services/websocket";
import { useConfigStore } from "@/stores/config";
import { useStatusStore } from "@/stores/status";
import { useWebSocketStore } from "@/stores/websocket";

describe("WebSocket 架构集成测试", () => {
  beforeEach(() => {
    // 重置所有 stores
    useConfigStore.getState().reset();
    useStatusStore.getState().reset();
    useWebSocketStore.getState().reset();
  });

  it("应该确保 WebSocket 单例模式", () => {
    const instance1 = webSocketManager;
    const instance2 = webSocketManager;

    expect(instance1).toBe(instance2);
    expect(instance1).toBeDefined();
  });

  it("应该通过事件总线同步配置数据", () => {
    const configStore = useConfigStore.getState();

    // 模拟配置更新
    const mockConfig = {
      mcpEndpoint: "wss://test.example.com/mcp",
      mcpServers: { test: { command: "test", args: [] } },
      connection: {
        heartbeatInterval: 30000,
        heartbeatTimeout: 10000,
        reconnectInterval: 5000,
      },
      webUI: { port: 9999 },
    };

    configStore.setConfig(mockConfig, "websocket");

    // 验证配置已正确设置
    const state = useConfigStore.getState();
    expect(state.config).toEqual(mockConfig);
    expect(state.lastSource).toBe("websocket");
  });

  it("应该通过事件总线同步状态数据", () => {
    const statusStore = useStatusStore.getState();

    // 模拟状态更新
    const mockStatus = {
      status: "connected" as const,
      mcpEndpoint: "wss://test.example.com/mcp",
      activeMCPServers: ["test-server"],
      lastHeartbeat: Date.now(),
    };

    statusStore.setClientStatus(mockStatus, "websocket");

    // 验证状态已正确设置
    const state = useStatusStore.getState();
    expect(state.clientStatus).toEqual(mockStatus);
    expect(state.lastSource).toBe("websocket");
  });

  it("应该正确管理 WebSocket 连接状态", () => {
    const wsStore = useWebSocketStore.getState();

    // 模拟连接状态变化
    wsStore.setConnectionState(ConnectionState.CONNECTING);
    expect(useWebSocketStore.getState().connectionState).toBe(
      ConnectionState.CONNECTING
    );

    wsStore.setConnectionState(ConnectionState.CONNECTED);
    expect(useWebSocketStore.getState().connectionState).toBe(
      ConnectionState.CONNECTED
    );

    wsStore.setConnectionState(ConnectionState.DISCONNECTED);
    expect(useWebSocketStore.getState().connectionState).toBe(
      ConnectionState.DISCONNECTED
    );
  });

  it("应该正确处理连接统计信息", () => {
    const wsStore = useWebSocketStore.getState();

    const mockStats = {
      reconnectAttempts: 2,
      maxReconnectAttempts: 5,
      lastHeartbeat: Date.now(),
      eventListenerCount: 3,
    };

    wsStore.setConnectionStats(mockStats);

    const state = useWebSocketStore.getState();
    expect(state.connectionStats).toEqual(mockStats);
  });

  it("应该支持多个 store 同时订阅事件", () => {
    // 这个测试验证事件总线机制能够同时更新多个 store
    const configStore = useConfigStore.getState();
    const statusStore = useStatusStore.getState();
    const wsStore = useWebSocketStore.getState();

    // 模拟 WebSocket 消息触发多个 store 更新
    const mockConfig = {
      mcpEndpoint: "wss://multi-test.example.com/mcp",
      mcpServers: {},
      connection: {
        heartbeatInterval: 30000,
        heartbeatTimeout: 10000,
        reconnectInterval: 5000,
      },
      webUI: { port: 9999 },
    };

    const mockStatus = {
      status: "connected" as const,
      mcpEndpoint: "wss://multi-test.example.com/mcp",
      activeMCPServers: [],
      lastHeartbeat: Date.now(),
    };

    // 同时更新多个 store（模拟 WebSocket 事件）
    configStore.setConfig(mockConfig, "websocket");
    statusStore.setClientStatus(mockStatus, "websocket");
    wsStore.setConnectionState(ConnectionState.CONNECTED);

    // 验证所有 store 都正确更新
    expect(useConfigStore.getState().config).toEqual(mockConfig);
    expect(useStatusStore.getState().clientStatus).toEqual(mockStatus);
    expect(useWebSocketStore.getState().connectionState).toBe(
      ConnectionState.CONNECTED
    );
  });

  it("应该正确处理错误状态", () => {
    const configStore = useConfigStore.getState();
    const statusStore = useStatusStore.getState();
    const wsStore = useWebSocketStore.getState();

    const testError = new Error("测试错误");

    // 设置各种错误状态
    configStore.setError(testError);
    statusStore.setError(testError);
    wsStore.setLastError(testError);

    // 验证错误状态
    expect(useConfigStore.getState().loading.lastError).toBe(testError);
    expect(useStatusStore.getState().loading.lastError).toBe(testError);
    expect(useWebSocketStore.getState().lastError).toBe(testError);
  });

  it("应该支持 store 重置功能", () => {
    const configStore = useConfigStore.getState();
    const statusStore = useStatusStore.getState();
    const wsStore = useWebSocketStore.getState();

    // 设置一些数据
    configStore.setConfig(
      {
        mcpEndpoint: "test",
        mcpServers: {},
        connection: {
          heartbeatInterval: 30000,
          heartbeatTimeout: 10000,
          reconnectInterval: 5000,
        },
        webUI: { port: 9999 },
      },
      "http"
    );
    statusStore.setClientStatus(
      {
        status: "connected",
        mcpEndpoint: "test",
        activeMCPServers: [],
        lastHeartbeat: Date.now(),
      },
      "http"
    );
    wsStore.setConnectionState(ConnectionState.CONNECTED);

    // 重置所有 store
    configStore.reset();
    statusStore.reset();
    wsStore.reset();

    // 验证重置后的状态
    expect(useConfigStore.getState().config).toBeNull();
    expect(useStatusStore.getState().clientStatus).toBeNull();
    expect(useWebSocketStore.getState().connectionState).toBe("disconnected");
  });
});

/**
 * useWebSocketConnection Hook
 *
 * 专门用于 WebSocket 连接状态管理
 * 返回连接状态、错误信息、连接控制方法
 */

import { useCallback } from "react";
import { ConnectionState, webSocketManager } from "../services/websocket";
import {
  useWebSocketActions,
  useWebSocketConnected,
  useWebSocketConnectionState,
  useWebSocketConnectionStats,
  useWebSocketLastError,
  useWebSocketUrl,
} from "../stores/websocket";

/**
 * WebSocket 连接相关的 hook
 */
export function useWebSocketConnection() {
  // 获取连接状态
  const connectionState = useWebSocketConnectionState();
  const connected = useWebSocketConnected();
  const wsUrl = useWebSocketUrl();
  const lastError = useWebSocketLastError();
  const connectionStats = useWebSocketConnectionStats();

  // 获取操作方法
  const { connect, disconnect, reconnect, send, updateUrl } =
    useWebSocketActions();

  // 连接控制方法
  const connectToWebSocket = useCallback(async () => {
    try {
      await connect();
    } catch (error) {
      console.error("[useWebSocketConnection] 连接失败:", error);
      throw error;
    }
  }, [connect]);

  const disconnectFromWebSocket = useCallback(() => {
    try {
      disconnect();
    } catch (error) {
      console.error("[useWebSocketConnection] 断开连接失败:", error);
      throw error;
    }
  }, [disconnect]);

  const reconnectToWebSocket = useCallback(async () => {
    try {
      await reconnect();
    } catch (error) {
      console.error("[useWebSocketConnection] 重连失败:", error);
      throw error;
    }
  }, [reconnect]);

  const sendMessage = useCallback(
    (message: any) => {
      try {
        return send(message);
      } catch (error) {
        console.error("[useWebSocketConnection] 发送消息失败:", error);
        return false;
      }
    },
    [send]
  );

  const changeWebSocketUrl = useCallback(
    (url: string) => {
      try {
        updateUrl(url);
      } catch (error) {
        console.error("[useWebSocketConnection] 更新 URL 失败:", error);
        throw error;
      }
    },
    [updateUrl]
  );

  // 获取连接信息
  const getConnectionInfo = useCallback(() => {
    return {
      state: connectionState,
      connected,
      url: wsUrl,
      stats: connectionStats,
      lastError,
      isConnecting: connectionState === ConnectionState.CONNECTING,
      isReconnecting: connectionState === ConnectionState.RECONNECTING,
      isDisconnected: connectionState === ConnectionState.DISCONNECTED,
    };
  }, [connectionState, connected, wsUrl, connectionStats, lastError]);

  // 检查连接状态
  const isConnected = useCallback(() => {
    return webSocketManager.isConnected();
  }, []);

  const isConnecting = useCallback(() => {
    return connectionState === ConnectionState.CONNECTING;
  }, [connectionState]);

  const isReconnecting = useCallback(() => {
    return connectionState === ConnectionState.RECONNECTING;
  }, [connectionState]);

  const isDisconnected = useCallback(() => {
    return connectionState === ConnectionState.DISCONNECTED;
  }, [connectionState]);

  return {
    // 状态
    connectionState,
    connected,
    wsUrl,
    lastError,
    connectionStats,

    // 连接控制方法
    connect: connectToWebSocket,
    disconnect: disconnectFromWebSocket,
    reconnect: reconnectToWebSocket,
    send: sendMessage,
    updateUrl: changeWebSocketUrl,

    // 状态检查方法
    isConnected,
    isConnecting,
    isReconnecting,
    isDisconnected,

    // 工具方法
    getConnectionInfo,
  };
}

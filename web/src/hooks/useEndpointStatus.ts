/**
 * 端点状态变更 Hook
 * 用于订阅和处理端点连接状态的实时变更
 */
import { useCallback, useEffect, useState } from "react";
import {
  type EndpointStatusChangedEvent,
  webSocketManager,
} from "../services/websocket";

/**
 * 端点状态回调函数类型
 */
export type EndpointStatusCallback = (
  event: EndpointStatusChangedEvent
) => void;

/**
 * 使用端点状态变更的 Hook
 * @param callback 状态变更时的回调函数
 * @param endpoint 可选，指定要监听的端点，如果未指定则监听所有端点
 */
export function useEndpointStatus(
  callback: EndpointStatusCallback,
  endpoint?: string
): void {
  // 处理端点状态变更事件
  const handleEndpointStatusChanged = useCallback(
    (event: EndpointStatusChangedEvent) => {
      // 如果指定了端点，只处理该端点的事件
      if (endpoint && event.endpoint !== endpoint) {
        return;
      }

      console.log("[useEndpointStatus] 收到端点状态变更:", event);
      callback(event);
    },
    [callback, endpoint]
  );

  // 订阅端点状态变更事件
  useEffect(() => {
    const unsubscribe = webSocketManager.subscribe(
      "data:endpointStatusChanged",
      handleEndpointStatusChanged
    );

    return () => {
      // 清理订阅
      unsubscribe();
    };
  }, [handleEndpointStatusChanged]);
}

/**
 * 获取指定端点的连接状态
 * @param endpoint 端点地址
 * @returns 连接状态和状态信息
 */
export function useEndpointConnection(endpoint: string): {
  connected: boolean;
  status: "connected" | "disconnected" | "connecting" | "error";
  lastUpdate: number;
} {
  const [state, setState] = useState<{
    connected: boolean;
    status: "connected" | "disconnected" | "connecting" | "error";
    lastUpdate: number;
  }>({
    connected: false,
    status: "disconnected",
    lastUpdate: Date.now(),
  });

  // 更新端点状态
  const updateEndpointState = useCallback(
    (event: EndpointStatusChangedEvent) => {
      setState({
        connected: event.connected,
        status: event.connected
          ? "connected"
          : event.success
            ? "disconnected"
            : "error",
        lastUpdate: event.timestamp,
      });
    },
    []
  );

  // 订阅指定端点的状态变更
  useEndpointStatus(updateEndpointState, endpoint);

  return state;
}

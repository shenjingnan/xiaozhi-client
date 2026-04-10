import { type EndpointStatusResponse, apiClient } from "@/services/api";
import { useCallback, useState } from "react";

/**
 * 接入点状态接口
 */
export interface EndpointState {
  connected: boolean;
  isOperating: boolean;
  lastOperation: {
    type: "connect" | "disconnect" | "reconnect" | null;
    success: boolean;
    message: string;
    timestamp: number;
  };
}

/**
 * 接入点状态管理 Hook
 * 用于管理多个接入点的连接状态
 */
export function useEndpointState() {
  const [endpointStates, setEndpointStates] = useState<
    Record<string, EndpointState>
  >({});

  // 获取接入点状态
  const fetchEndpointStatus = useCallback(
    async (endpoint: string): Promise<EndpointStatusResponse> => {
      try {
        return await apiClient.getEndpointStatus(endpoint);
      } catch (error) {
        console.error(`获取接入点状态失败: ${endpoint}`, error);
        // 返回默认状态
        return {
          endpoint,
          connected: false,
          initialized: false,
          isReconnecting: false,
          reconnectAttempts: 0,
          reconnectDelay: 0,
        };
      }
    },
    []
  );

  // 更新接入点状态
  const updateEndpointState = useCallback(
    (endpoint: string, updates: Partial<EndpointState>) => {
      setEndpointStates((prev) => ({
        ...prev,
        [endpoint]: {
          ...prev[endpoint],
          ...updates,
        },
      }));
    },
    []
  );

  // 初始化接入点状态
  const initializeEndpointStates = useCallback(
    async (endpoints: string[]) => {
      const states: Record<string, EndpointState> = {};

      for (const endpoint of endpoints) {
        try {
          const status = await fetchEndpointStatus(endpoint);
          states[endpoint] = {
            connected: status.connected,
            isOperating: false,
            lastOperation: {
              type: null,
              success: false,
              message: "",
              timestamp: 0,
            },
          };
        } catch (error) {
          states[endpoint] = {
            connected: false,
            isOperating: false,
            lastOperation: {
              type: null,
              success: false,
              message: "",
              timestamp: 0,
            },
          };
        }
      }

      setEndpointStates(states);
    },
    [fetchEndpointStatus]
  );

  // 移除接入点状态
  const removeEndpointState = useCallback((endpoint: string) => {
    setEndpointStates((prev) => {
      const newStates = { ...prev };
      delete newStates[endpoint];
      return newStates;
    });
  }, []);

  // 添加接入点状态
  const addEndpointState = useCallback(
    (endpoint: string, connected = false) => {
      setEndpointStates((prev) => ({
        ...prev,
        [endpoint]: {
          connected,
          isOperating: false,
          lastOperation: {
            type: null,
            success: false,
            message: "",
            timestamp: 0,
          },
        },
      }));
    },
    []
  );

  return {
    endpointStates,
    updateEndpointState,
    initializeEndpointStates,
    removeEndpointState,
    addEndpointState,
    fetchEndpointStatus,
  };
}
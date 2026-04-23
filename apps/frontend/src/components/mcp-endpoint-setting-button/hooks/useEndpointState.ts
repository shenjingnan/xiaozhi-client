import { type EndpointStatusResponse, apiClient } from "@/services/api";
import { useCallback, useEffect, useState } from "react";
import type { EndpointState } from "../types";

/**
 * 接入点状态管理 Hook
 * 负责管理接入点的连接状态和实时状态同步
 */
export function useEndpointState(open: boolean, endpoints: string[]) {
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
    async (endpointList: string[]) => {
      const states: Record<string, EndpointState> = {};

      for (const endpoint of endpointList) {
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
        } catch {
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

  // 当对话框打开时，初始化接入点状态
  useEffect(() => {
    if (open && endpoints.length > 0) {
      initializeEndpointStates(endpoints);
    }
  }, [open, endpoints, initializeEndpointStates]);

  return {
    endpointStates,
    updateEndpointState,
    removeEndpointState,
    initializeEndpointStates,
  };
}

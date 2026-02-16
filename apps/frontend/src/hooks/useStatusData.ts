/**
 * useStatusData Hook
 *
 * 专门用于状态数据访问
 * 返回状态数据、轮询控制、重启方法
 */

import {
  useActiveMcpServers,
  useClientStatus,
  useConnectionInfo,
  useConnectionStatus,
  useFullStatus,
  useLastHeartbeat,
  usePollingActions,
  usePollingConfig,
  usePollingEnabled,
  useRestartStatus,
  useServiceHealth,
  useServiceInfo,
  useServiceStatus,
  useStatusActions,
  useStatusError,
  useStatusIsLoading,
  useStatusIsRestarting,
  useStatusLoading,
  useStatusMcpEndpoint,
  useStatusWithLoading,
} from "@/stores/status";
import { useCallback } from "react";

/**
 * 状态数据相关的 hook
 */
export function useStatusData() {
  // 获取状态数据
  const clientStatus = useClientStatus();
  const restartStatus = useRestartStatus();
  const serviceStatus = useServiceStatus();
  const serviceHealth = useServiceHealth();
  const fullStatus = useFullStatus();

  // 获取加载状态
  const loading = useStatusLoading();
  const isLoading = useStatusIsLoading();
  const isRestarting = useStatusIsRestarting();
  const error = useStatusError();

  // 获取轮询配置
  const pollingConfig = usePollingConfig();
  const pollingEnabled = usePollingEnabled();

  // 获取连接相关状态
  const connectionStatus = useConnectionStatus();
  const statusMcpEndpoint = useStatusMcpEndpoint();
  const activeMcpServers = useActiveMcpServers();
  const lastHeartbeat = useLastHeartbeat();

  // 获取操作方法
  const {
    getStatus,
    refreshStatus,
    restartService,
    getServiceStatus,
    getServiceHealth,
    startPolling,
    stopPolling,
    setPollingConfig,
  } = useStatusActions();

  // 状态获取方法
  const getStatusData = useCallback(async () => {
    try {
      return await getStatus();
    } catch (error) {
      console.error("[useStatusData] 获取状态失败:", error);
      throw error;
    }
  }, [getStatus]);

  const refreshStatusData = useCallback(async () => {
    try {
      return await refreshStatus();
    } catch (error) {
      console.error("[useStatusData] 刷新状态失败:", error);
      throw error;
    }
  }, [refreshStatus]);

  const getServiceStatusData = useCallback(async () => {
    try {
      return await getServiceStatus();
    } catch (error) {
      console.error("[useStatusData] 获取服务状态失败:", error);
      throw error;
    }
  }, [getServiceStatus]);

  const getServiceHealthData = useCallback(async () => {
    try {
      return await getServiceHealth();
    } catch (error) {
      console.error("[useStatusData] 获取服务健康状态失败:", error);
      throw error;
    }
  }, [getServiceHealth]);

  // 服务重启方法
  const restartServiceData = useCallback(async () => {
    try {
      await restartService();
    } catch (error) {
      console.error("[useStatusData] 重启服务失败:", error);
      throw error;
    }
  }, [restartService]);

  // 轮询控制方法
  const startStatusPolling = useCallback(
    (interval?: number) => {
      try {
        startPolling(interval);
      } catch (error) {
        console.error("[useStatusData] 启动轮询失败:", error);
        throw error;
      }
    },
    [startPolling]
  );

  const stopStatusPolling = useCallback(() => {
    try {
      stopPolling();
    } catch (error) {
      console.error("[useStatusData] 停止轮询失败:", error);
      throw error;
    }
  }, [stopPolling]);

  const updatePollingConfig = useCallback(
    (config: Partial<typeof pollingConfig>) => {
      try {
        setPollingConfig(config);
      } catch (error) {
        console.error("[useStatusData] 更新轮询配置失败:", error);
        throw error;
      }
    },
    [setPollingConfig]
  );

  // 状态检查方法
  const hasStatus = useCallback(() => {
    return clientStatus !== null;
  }, [clientStatus]);

  const isStatusLoaded = useCallback(() => {
    return clientStatus !== null && !isLoading;
  }, [clientStatus, isLoading]);

  const isConnected = useCallback(() => {
    return connectionStatus;
  }, [connectionStatus]);

  const isServiceRunning = useCallback(() => {
    return serviceStatus?.running === true;
  }, [serviceStatus]);

  const isRestartInProgress = useCallback(() => {
    return restartStatus?.status === "restarting";
  }, [restartStatus]);

  const isRestartCompleted = useCallback(() => {
    return restartStatus?.status === "completed";
  }, [restartStatus]);

  const isRestartFailed = useCallback(() => {
    return restartStatus?.status === "failed";
  }, [restartStatus]);

  // 获取状态摘要
  const getStatusSummary = useCallback(() => {
    if (!clientStatus) return null;

    return {
      connected: connectionStatus,
      mcpEndpoint: statusMcpEndpoint,
      activeMcpServersCount: activeMcpServers.length,
      lastHeartbeat,
      serviceRunning: serviceStatus?.running,
      servicePid: serviceStatus?.pid,
      serviceMode: serviceStatus?.mode,
      restartStatus: restartStatus?.status,
      pollingEnabled,
      pollingInterval: pollingConfig.interval,
    };
  }, [
    clientStatus,
    connectionStatus,
    statusMcpEndpoint,
    activeMcpServers,
    lastHeartbeat,
    serviceStatus,
    restartStatus,
    pollingEnabled,
    pollingConfig,
  ]);

  // 获取服务健康摘要
  const getServiceHealthSummary = useCallback(() => {
    if (!serviceHealth) return null;

    return {
      status: serviceHealth.status,
      uptime: serviceHealth.uptime,
      version: serviceHealth.version,
      memoryUsage: {
        rss: Math.round(serviceHealth.memory.rss / 1024 / 1024), // MB
        heapUsed: Math.round(serviceHealth.memory.heapUsed / 1024 / 1024), // MB
        heapTotal: Math.round(serviceHealth.memory.heapTotal / 1024 / 1024), // MB
      },
      timestamp: serviceHealth.timestamp,
    };
  }, [serviceHealth]);

  return {
    // 状态数据
    clientStatus,
    restartStatus,
    serviceStatus,
    serviceHealth,
    fullStatus,

    // 连接相关状态
    connectionStatus,
    statusMcpEndpoint,
    activeMcpServers,
    lastHeartbeat,

    // 加载状态
    loading,
    isLoading,
    isRestarting,
    error,

    // 轮询配置
    pollingConfig,
    pollingEnabled,

    // 基础操作方法
    getStatus: getStatusData,
    refreshStatus: refreshStatusData,
    getServiceStatus: getServiceStatusData,
    getServiceHealth: getServiceHealthData,
    restartService: restartServiceData,

    // 轮询控制方法
    startPolling: startStatusPolling,
    stopPolling: stopStatusPolling,
    setPollingConfig: updatePollingConfig,

    // 状态检查方法
    hasStatus,
    isStatusLoaded,
    isConnected,
    isServiceRunning,
    isRestartInProgress,
    isRestartCompleted,
    isRestartFailed,

    // 工具方法
    getStatusSummary,
    getServiceHealthSummary,
  };
}

// 复合选择器 hooks（向后兼容）
export const useStatusWithLoadingState = useStatusWithLoading;
export const useServiceInformation = useServiceInfo;
export const useConnectionInformation = useConnectionInfo;
export const usePollingControls = usePollingActions;

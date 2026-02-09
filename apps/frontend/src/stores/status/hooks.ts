/**
 * 状态 Store 选择器 Hooks
 *
 * 提供优化的状态选择器 hooks，避免不必要的组件重渲染
 */

import { useShallow } from "zustand/react/shallow";
import { useStatusStore } from "./StatusStore";

// ==================== 基础选择器 ====================

/**
 * 获取客户端状态
 */
export const useClientStatus = () =>
  useStatusStore((state) => state.clientStatus);

/**
 * 获取重启状态
 */
export const useRestartStatus = () =>
  useStatusStore((state) => state.restartStatus);

/**
 * 获取服务状态
 */
export const useServiceStatus = () =>
  useStatusStore((state) => state.serviceStatus);

/**
 * 获取服务健康状态
 */
export const useServiceHealth = () =>
  useStatusStore((state) => state.serviceHealth);

/**
 * 获取完整状态
 */
export const useFullStatus = () => useStatusStore((state) => state.fullStatus);

/**
 * 获取状态加载状态
 */
export const useStatusLoading = () => useStatusStore((state) => state.loading);

/**
 * 获取状态是否正在加载
 */
export const useStatusIsLoading = () =>
  useStatusStore(
    (state) => state.loading.isLoading || state.loading.isRefreshing
  );

/**
 * 获取状态是否正在重启
 */
export const useStatusIsRestarting = () =>
  useStatusStore((state) => state.loading.isRestarting);

/**
 * 获取状态错误
 */
export const useStatusError = () =>
  useStatusStore((state) => state.loading.lastError);

/**
 * 获取轮询配置
 */
export const usePollingConfig = () => useStatusStore((state) => state.polling);

/**
 * 获取轮询是否启用
 */
export const usePollingEnabled = () =>
  useStatusStore((state) => state.polling.enabled);

/**
 * 获取重启轮询状态
 */
export const useRestartPollingStatus = () =>
  useStatusStore((state) => state.restartPolling);

/**
 * 获取状态来源
 */
export const useStatusSource = () =>
  useStatusStore((state) => state.lastSource);

/**
 * 获取连接状态（从客户端状态中提取）
 */
export const useConnectionStatus = () =>
  useStatusStore((state) => state.clientStatus?.status === "connected");

/**
 * 获取 MCP 端点（从客户端状态中提取）
 */
export const useStatusMcpEndpoint = () =>
  useStatusStore((state) => state.clientStatus?.mcpEndpoint);

/**
 * 获取活跃的 MCP 服务器（从客户端状态中提取）
 */
export const useActiveMcpServers = () =>
  useStatusStore((state) => state.clientStatus?.activeMCPServers || []);

/**
 * 获取最后心跳时间（从客户端状态中提取）
 */
export const useLastHeartbeat = () =>
  useStatusStore((state) => state.clientStatus?.lastHeartbeat);

// ==================== 复合选择器 ====================

/**
 * 获取状态数据和加载状态
 */
export const useStatusWithLoading = () =>
  useStatusStore(
    useShallow((state) => ({
      clientStatus: state.clientStatus,
      restartStatus: state.restartStatus,
      fullStatus: state.fullStatus,
      isLoading: state.loading.isLoading || state.loading.isRefreshing,
      isRestarting: state.loading.isRestarting,
      error: state.loading.lastError,
    }))
  );

/**
 * 获取服务相关状态
 */
export const useServiceInfo = () =>
  useStatusStore(
    useShallow((state) => ({
      status: state.serviceStatus,
      health: state.serviceHealth,
      isRestarting: state.loading.isRestarting,
      restartStatus: state.restartStatus,
    }))
  );

/**
 * 获取连接相关信息
 */
export const useConnectionInfo = () =>
  useStatusStore(
    useShallow((state) => ({
      connected: state.clientStatus?.status === "connected",
      endpoint: state.clientStatus?.mcpEndpoint,
      activeServers: state.clientStatus?.activeMCPServers || [],
      lastHeartbeat: state.clientStatus?.lastHeartbeat,
    }))
  );

// ==================== 操作方法 Hooks ====================

/**
 * 获取状态操作方法
 */
export const useStatusActions = () =>
  useStatusStore(
    useShallow((state) => ({
      getStatus: state.getStatus,
      refreshStatus: state.refreshStatus,
      restartService: state.restartService,
      getServiceStatus: state.getServiceStatus,
      getServiceHealth: state.getServiceHealth,
      startPolling: state.startPolling,
      stopPolling: state.stopPolling,
      setPollingConfig: state.setPollingConfig,
      startRestartPolling: state.startRestartPolling,
      stopRestartPolling: state.stopRestartPolling,
      setRestartPollingConfig: state.setRestartPollingConfig,
      reset: state.reset,
      initialize: state.initialize,
    }))
  );

/**
 * 获取轮询控制方法
 */
export const usePollingActions = () =>
  useStatusStore(
    useShallow((state) => ({
      startPolling: state.startPolling,
      stopPolling: state.stopPolling,
      setPollingConfig: state.setPollingConfig,
      enabled: state.polling.enabled,
      interval: state.polling.interval,
    }))
  );

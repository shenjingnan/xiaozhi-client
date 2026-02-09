/**
 * 核心 Store 实现
 *
 * 负责状态存储、更新和基础 API 调用
 */

import { apiClient } from "@services/api";
import { create } from "zustand";
import { devtools } from "zustand/middleware";
import { createRestartManager } from "./RestartManager";
import { createStatusPoller } from "./StatusPoller";
import { createStatusWebSocketSubscriber } from "./StatusWebSocketSubscriber";
import type {
  FullStatus,
  RestartStatus,
  ServiceHealth,
  ServiceStatus,
  StatusActions,
  StatusSource,
  StatusState,
} from "./types";
import { initialState } from "./types";

/**
 * 创建状态 Store
 */
export const useStatusStore = create<StatusState & StatusActions>()(
  devtools(
    (set, get) => {
      // ==================== 轮询管理器 ====================
      const statusPoller = createStatusPoller({
        refreshStatus: async () => get().refreshStatus(),
        updateConfig: (config) => {
          set(
            (state) => ({
              polling: { ...state.polling, ...config },
            }),
            false,
            "setPollingConfig"
          );
        },
        getConfig: () => get().polling,
      });

      // ==================== 重启管理器 ====================
      const restartManager = createRestartManager({
        refreshStatus: async () => get().refreshStatus(),
        setRestartStatus: (status, source) =>
          get().setRestartStatus(status, source),
        updateConfig: (config) => {
          set(
            (state) => ({
              restartPolling: { ...state.restartPolling, ...config },
            }),
            false,
            "setRestartPollingConfig"
          );
        },
        getConfig: () => get().restartPolling,
        setLoading: (loading) => get().setLoading(loading),
      });

      // ==================== WebSocket 订阅器 ====================
      const webSocketSubscriber = createStatusWebSocketSubscriber({
        onClientStatusUpdate: (status) =>
          get().setClientStatus(status, "websocket"),
        onRestartStatusUpdate: (status) =>
          get().setRestartStatus(status, "websocket"),
      });

      return {
        ...initialState,

        // ==================== 基础操作 ====================

        setClientStatus: (
          status: typeof initialState.clientStatus,
          source: StatusSource = "http"
        ) => {
          console.log(`[StatusStore] 设置客户端状态，来源: ${source}`);
          set(
            (state) => ({
              clientStatus: status,
              lastSource: source,
              loading: {
                ...state.loading,
                lastUpdated: Date.now(),
                lastError: null,
              },
            }),
            false,
            "setClientStatus"
          );
        },

        setRestartStatus: (
          status: RestartStatus | null,
          source: StatusSource = "http"
        ) => {
          console.log(`[StatusStore] 设置重启状态，来源: ${source}`);
          set(
            (state) => ({
              restartStatus: status,
              lastSource: source,
              loading: {
                ...state.loading,
                lastUpdated: Date.now(),
                lastError: null,
              },
            }),
            false,
            "setRestartStatus"
          );
        },

        setServiceStatus: (status: ServiceStatus) => {
          console.log("[StatusStore] 设置服务状态");
          set({ serviceStatus: status }, false, "setServiceStatus");
        },

        setServiceHealth: (health: ServiceHealth) => {
          console.log("[StatusStore] 设置服务健康状态");
          set({ serviceHealth: health }, false, "setServiceHealth");
        },

        setFullStatus: (status: FullStatus, source: StatusSource = "http") => {
          console.log(`[StatusStore] 设置完整状态，来源: ${source}`);
          set(
            (state) => ({
              fullStatus: status,
              clientStatus: status.client,
              restartStatus: status.restart || null,
              lastSource: source,
              loading: {
                ...state.loading,
                lastUpdated: Date.now(),
                lastError: null,
              },
            }),
            false,
            "setFullStatus"
          );
        },

        setLoading: (loading: Partial<typeof initialState.loading>) => {
          set(
            (state) => ({
              loading: { ...state.loading, ...loading },
            }),
            false,
            "setLoading"
          );
        },

        setError: (error: Error | null) => {
          set(
            (state) => ({
              loading: { ...state.loading, lastError: error },
            }),
            false,
            "setError"
          );
        },

        // ==================== 异步操作 ====================

        getStatus: async (): Promise<FullStatus> => {
          const { fullStatus, loading } = get();

          // 如果已有状态且不超过30秒，直接返回
          if (
            fullStatus &&
            loading.lastUpdated &&
            Date.now() - loading.lastUpdated < 30 * 1000
          ) {
            return fullStatus;
          }

          // 否则从服务器获取最新状态
          return get().refreshStatus();
        },

        refreshStatus: async (): Promise<FullStatus> => {
          const { setLoading, setFullStatus, setError, polling } = get();

          try {
            setLoading({ isRefreshing: true, lastError: null });
            console.log("[StatusStore] 开始刷新状态");

            // 从服务器获取最新状态
            const status = await apiClient.getStatus();

            // 更新本地状态
            setFullStatus(status, "http");

            // 重置轮询重试计数
            if (polling.enabled) {
              get().setPollingConfig({ currentRetries: 0 });
            }

            console.log("[StatusStore] 状态刷新成功");
            return status;
          } catch (error) {
            const err =
              error instanceof Error ? error : new Error("状态刷新失败");
            console.error("[StatusStore] 状态刷新失败:", err);
            setError(err);

            // 增加轮询重试计数
            if (polling.enabled) {
              const newRetries = polling.currentRetries + 1;
              get().setPollingConfig({ currentRetries: newRetries });

              // 如果达到最大重试次数，停止轮询
              if (newRetries >= polling.maxRetries) {
                console.warn("[StatusStore] 达到最大重试次数，停止轮询");
                get().stopPolling();
              }
            }

            throw err;
          } finally {
            setLoading({ isRefreshing: false });
          }
        },

        restartService: async (): Promise<void> => {
          const { setLoading, setRestartStatus, setError } = get();

          try {
            setLoading({ isRestarting: true, lastError: null });
            console.log("[StatusStore] 开始重启服务");

            // 设置重启状态
            setRestartStatus(
              {
                status: "restarting",
                timestamp: Date.now(),
              },
              "http"
            );

            // 调用重启 API
            await apiClient.restartService();

            console.log("[StatusStore] 服务重启请求已发送，开始重连检查");

            // 启动重启后的重连检查轮询
            restartManager.startRestartPolling();
          } catch (error) {
            const err =
              error instanceof Error ? error : new Error("服务重启失败");
            console.error("[StatusStore] 服务重启失败:", err);

            // 设置重启失败状态
            setRestartStatus(
              {
                status: "failed",
                error: err.message,
                timestamp: Date.now(),
              },
              "http"
            );

            setError(err);
            setLoading({ isRestarting: false });
            throw err;
          }
        },

        getServiceStatus: async (): Promise<ServiceStatus> => {
          try {
            console.log("[StatusStore] 获取服务状态");
            const status = await apiClient.getServiceStatus();
            get().setServiceStatus(status);
            return status;
          } catch (error) {
            const err =
              error instanceof Error ? error : new Error("获取服务状态失败");
            console.error("[StatusStore] 获取服务状态失败:", err);
            get().setError(err);
            throw err;
          }
        },

        getServiceHealth: async (): Promise<ServiceHealth> => {
          try {
            console.log("[StatusStore] 获取服务健康状态");
            const health = await apiClient.getServiceHealth();
            get().setServiceHealth(health);
            return health;
          } catch (error) {
            const err =
              error instanceof Error
                ? error
                : new Error("获取服务健康状态失败");
            console.error("[StatusStore] 获取服务健康状态失败:", err);
            get().setError(err);
            throw err;
          }
        },

        // ==================== 轮询控制 ====================

        startPolling: (interval = 30000) => {
          statusPoller.startPolling(interval);
        },

        stopPolling: () => {
          statusPoller.stopPolling();
        },

        setPollingConfig: (config) => {
          statusPoller.setPollingConfig(config);
        },

        // ==================== 重启轮询控制 ====================

        startRestartPolling: () => {
          restartManager.startRestartPolling();
        },

        stopRestartPolling: () => {
          restartManager.stopRestartPolling();
        },

        setRestartPollingConfig: (config) => {
          restartManager.setRestartPollingConfig(config);
        },

        // ==================== 工具方法 ====================

        reset: () => {
          console.log("[StatusStore] 重置状态");

          // 停止所有轮询
          statusPoller.dispose();
          restartManager.dispose();

          // 重置状态
          set(initialState, false, "reset");
        },

        initialize: async (): Promise<void> => {
          const { setLoading, refreshStatus } = get();

          try {
            setLoading({ isLoading: true });
            console.log("[StatusStore] 初始化状态 Store");

            // 设置 WebSocket 事件监听
            webSocketSubscriber.initialize();

            // 获取初始状态
            await refreshStatus();

            console.log("[StatusStore] 状态 Store 初始化完成");
          } catch (error) {
            console.error("[StatusStore] 状态 Store 初始化失败:", error);
            throw error;
          } finally {
            setLoading({ isLoading: false });
          }
        },
      };
    },
    {
      name: "status-store",
    }
  )
);

/**
 * 导出 Store 类型
 */
export type { StatusState, StatusActions, StatusSource, FullStatus };

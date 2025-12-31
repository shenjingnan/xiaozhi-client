/**
 * 状态数据统一管理 Store
 *
 * 特性：
 * - 支持定时轮询和 WebSocket 实时更新
 * - 提供异步方法：getStatus()、refreshStatus()、restartService()
 * - 管理重启状态和服务状态
 * - 使用 Zustand 进行状态管理
 * - 提供选择器 hooks 优化组件渲染
 * - 集成 WebSocket 事件监听
 */

import { apiClient } from "@services/api";
import { webSocketManager } from "@services/websocket";
import type { ClientStatus } from "@xiaozhi-client/shared-types";
import { create } from "zustand";
import { devtools } from "zustand/middleware";
import { useShallow } from "zustand/react/shallow";

/**
 * 重启状态接口
 */
interface RestartStatus {
  status: "restarting" | "completed" | "failed";
  error?: string;
  timestamp: number;
}

/**
 * 服务状态接口
 */
interface ServiceStatus {
  running: boolean;
  mode?: string;
  pid?: number;
}

/**
 * 服务健康状态接口
 */
interface ServiceHealth {
  status: string;
  timestamp: number;
  uptime: number;
  memory: {
    rss: number;
    heapTotal: number;
    heapUsed: number;
    external: number;
    arrayBuffers: number;
  };
  version: string;
}

/**
 * 完整状态接口
 */
interface FullStatus {
  client: ClientStatus;
  restart?: RestartStatus;
  timestamp: number;
}

/**
 * 状态加载状态
 */
interface StatusLoadingState {
  isLoading: boolean;
  isRefreshing: boolean;
  isRestarting: boolean;
  lastUpdated: number | null;
  lastError: Error | null;
}

/**
 * 轮询配置
 */
interface PollingConfig {
  enabled: boolean;
  interval: number; // 毫秒
  maxRetries: number;
  currentRetries: number;
}

/**
 * 重启轮询配置
 */
interface RestartPollingConfig {
  enabled: boolean;
  interval: number; // 毫秒，重启检查间隔
  maxAttempts: number; // 最大检查次数
  currentAttempts: number; // 当前检查次数
  timeout: number; // 总超时时间（毫秒）
  startTime: number | null; // 开始时间戳
}

/**
 * 状态 Store 状态
 */
interface StatusState {
  // 状态数据
  clientStatus: ClientStatus | null;
  restartStatus: RestartStatus | null;
  serviceStatus: ServiceStatus | null;
  serviceHealth: ServiceHealth | null;
  fullStatus: FullStatus | null;

  // 加载状态
  loading: StatusLoadingState;

  // 轮询配置
  polling: PollingConfig;

  // 重启轮询配置
  restartPolling: RestartPollingConfig;

  // 状态来源追踪
  lastSource: "http" | "websocket" | "polling" | "initial" | null;
}

/**
 * 状态 Store 操作方法
 */
interface StatusActions {
  // 基础操作
  setClientStatus: (
    status: ClientStatus,
    source?: "http" | "websocket" | "polling" | "initial"
  ) => void;
  setRestartStatus: (
    status: RestartStatus | null,
    source?: "http" | "websocket" | "polling" | "initial"
  ) => void;
  setServiceStatus: (status: ServiceStatus) => void;
  setServiceHealth: (health: ServiceHealth) => void;
  setFullStatus: (
    status: FullStatus,
    source?: "http" | "websocket" | "polling" | "initial"
  ) => void;
  setLoading: (loading: Partial<StatusLoadingState>) => void;
  setError: (error: Error | null) => void;

  // 异步操作
  getStatus: () => Promise<FullStatus>;
  refreshStatus: () => Promise<FullStatus>;
  restartService: () => Promise<void>;
  getServiceStatus: () => Promise<ServiceStatus>;
  getServiceHealth: () => Promise<ServiceHealth>;

  // 轮询控制
  startPolling: (interval?: number) => void;
  stopPolling: () => void;
  setPollingConfig: (config: Partial<PollingConfig>) => void;

  // 重启轮询控制
  startRestartPolling: () => void;
  stopRestartPolling: () => void;
  setRestartPollingConfig: (config: Partial<RestartPollingConfig>) => void;

  // 工具方法
  reset: () => void;
  initialize: () => Promise<void>;
}

/**
 * 完整的状态 Store 接口
 */
export interface StatusStore extends StatusState, StatusActions {}

/**
 * 初始状态
 */
const initialState: StatusState = {
  clientStatus: null,
  restartStatus: null,
  serviceStatus: null,
  serviceHealth: null,
  fullStatus: null,
  loading: {
    isLoading: false,
    isRefreshing: false,
    isRestarting: false,
    lastUpdated: null,
    lastError: null,
  },
  polling: {
    enabled: false,
    interval: 30000, // 30秒
    maxRetries: 3,
    currentRetries: 0,
  },
  restartPolling: {
    enabled: false,
    interval: 1000, // 1秒检查间隔
    maxAttempts: 60, // 最多检查60次（60秒）
    currentAttempts: 0,
    timeout: 60000, // 60秒总超时
    startTime: null,
  },
  lastSource: null,
};

/**
 * 轮询定时器引用
 */
let pollingTimer: NodeJS.Timeout | null = null;

/**
 * 重启轮询定时器引用
 */
let restartPollingTimer: NodeJS.Timeout | null = null;

/**
 * 创建状态 Store
 */
export const useStatusStore = create<StatusStore>()(
  devtools(
    (set, get) => ({
      ...initialState,

      // ==================== 基础操作 ====================

      setClientStatus: (status: ClientStatus, source = "http") => {
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

      setRestartStatus: (status: RestartStatus | null, source = "http") => {
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

      setFullStatus: (status: FullStatus, source = "http") => {
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

      setLoading: (loading: Partial<StatusLoadingState>) => {
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
        const { setLoading, setRestartStatus, setError, startRestartPolling } =
          get();

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
          startRestartPolling();
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
            error instanceof Error ? error : new Error("获取服务健康状态失败");
          console.error("[StatusStore] 获取服务健康状态失败:", err);
          get().setError(err);
          throw err;
        }
      },

      // ==================== 轮询控制 ====================

      startPolling: (interval = 30000) => {
        const { polling, refreshStatus } = get();

        if (polling.enabled) {
          console.log("[StatusStore] 轮询已启用，跳过启动");
          return;
        }

        console.log(`[StatusStore] 启动状态轮询，间隔: ${interval}ms`);

        set(
          (state) => ({
            polling: {
              ...state.polling,
              enabled: true,
              interval,
              currentRetries: 0,
            },
          }),
          false,
          "startPolling"
        );

        // 立即执行一次刷新
        refreshStatus().catch((error) => {
          console.error("[StatusStore] 轮询初始刷新失败:", error);
        });

        // 设置定时器
        pollingTimer = setInterval(() => {
          const currentState = get();
          if (!currentState.polling.enabled) {
            return;
          }

          refreshStatus().catch((error) => {
            console.error("[StatusStore] 轮询刷新失败:", error);
          });
        }, interval);
      },

      stopPolling: () => {
        console.log("[StatusStore] 停止状态轮询");

        set(
          (state) => ({
            polling: {
              ...state.polling,
              enabled: false,
              currentRetries: 0,
            },
          }),
          false,
          "stopPolling"
        );

        if (pollingTimer) {
          clearInterval(pollingTimer);
          pollingTimer = null;
        }
      },

      setPollingConfig: (config: Partial<PollingConfig>) => {
        set(
          (state) => ({
            polling: { ...state.polling, ...config },
          }),
          false,
          "setPollingConfig"
        );
      },

      // ==================== 重启轮询控制 ====================

      startRestartPolling: () => {
        const { restartPolling, refreshStatus, setRestartStatus, setLoading } =
          get();

        if (restartPolling.enabled) {
          console.log("[StatusStore] 重启轮询已启用，跳过启动");
          return;
        }

        console.log("[StatusStore] 启动重启后重连检查轮询");

        const startTime = Date.now();
        set(
          (state) => ({
            restartPolling: {
              ...state.restartPolling,
              enabled: true,
              currentAttempts: 0,
              startTime,
            },
          }),
          false,
          "startRestartPolling"
        );

        // 设置定时器进行重连检查
        restartPollingTimer = setInterval(async () => {
          const currentState = get();
          const { restartPolling: currentRestartPolling } = currentState;

          if (!currentRestartPolling.enabled) {
            return;
          }

          const elapsed = Date.now() - (currentRestartPolling.startTime || 0);
          const attempts = currentRestartPolling.currentAttempts + 1;

          console.log(
            `[StatusStore] 重启重连检查 (第 ${attempts} 次，已用时 ${Math.round(elapsed / 1000)}s)`
          );

          try {
            // 尝试获取状态以检查服务是否重连成功
            const status = await refreshStatus();

            // 检查是否重连成功
            const isReconnected = status.client?.status === "connected";

            if (isReconnected) {
              console.log("[StatusStore] 服务重连成功，停止重启轮询");

              // 设置重启完成状态
              setRestartStatus(
                {
                  status: "completed",
                  timestamp: Date.now(),
                },
                "polling"
              );

              // 停止重启轮询和loading状态
              currentState.stopRestartPolling();
              setLoading({ isRestarting: false });
              return;
            }

            // 更新尝试次数
            currentState.setRestartPollingConfig({ currentAttempts: attempts });

            // 检查是否超时或达到最大尝试次数
            if (
              elapsed >= currentRestartPolling.timeout ||
              attempts >= currentRestartPolling.maxAttempts
            ) {
              console.warn("[StatusStore] 重启重连检查超时或达到最大尝试次数");

              // 设置重启失败状态
              setRestartStatus(
                {
                  status: "failed",
                  error: "重连超时，服务可能未成功重启",
                  timestamp: Date.now(),
                },
                "polling"
              );

              // 停止重启轮询和loading状态
              currentState.stopRestartPolling();
              setLoading({ isRestarting: false });
            }
          } catch (error) {
            console.log(
              `[StatusStore] 重启重连检查失败 (第 ${attempts} 次):`,
              error
            );

            // 更新尝试次数
            currentState.setRestartPollingConfig({ currentAttempts: attempts });

            // 检查是否超时或达到最大尝试次数
            if (
              elapsed >= currentRestartPolling.timeout ||
              attempts >= currentRestartPolling.maxAttempts
            ) {
              console.error("[StatusStore] 重启重连检查超时或达到最大尝试次数");

              // 设置重启失败状态
              setRestartStatus(
                {
                  status: "failed",
                  error: "重连超时，服务可能未成功重启",
                  timestamp: Date.now(),
                },
                "polling"
              );

              // 停止重启轮询和loading状态
              currentState.stopRestartPolling();
              setLoading({ isRestarting: false });
            }
          }
        }, restartPolling.interval);
      },

      stopRestartPolling: () => {
        console.log("[StatusStore] 停止重启轮询");

        set(
          (state) => ({
            restartPolling: {
              ...state.restartPolling,
              enabled: false,
              currentAttempts: 0,
              startTime: null,
            },
          }),
          false,
          "stopRestartPolling"
        );

        if (restartPollingTimer) {
          clearInterval(restartPollingTimer);
          restartPollingTimer = null;
        }
      },

      setRestartPollingConfig: (config: Partial<RestartPollingConfig>) => {
        set(
          (state) => ({
            restartPolling: { ...state.restartPolling, ...config },
          }),
          false,
          "setRestartPollingConfig"
        );
      },

      // ==================== 工具方法 ====================

      reset: () => {
        console.log("[StatusStore] 重置状态");

        // 停止所有轮询
        get().stopPolling();
        get().stopRestartPolling();

        // 重置状态
        set(initialState, false, "reset");
      },

      initialize: async (): Promise<void> => {
        const { setLoading, refreshStatus } = get();

        try {
          setLoading({ isLoading: true });
          console.log("[StatusStore] 初始化状态 Store");

          // 设置 WebSocket 事件监听
          webSocketManager.subscribe("data:statusUpdate", (status) => {
            console.log("[StatusStore] 收到 WebSocket 状态更新");
            get().setClientStatus(status, "websocket");
          });

          webSocketManager.subscribe("data:restartStatus", (status) => {
            console.log("[StatusStore] 收到 WebSocket 重启状态更新");
            get().setRestartStatus(status, "websocket");
          });

          // 获取初始状态
          await refreshStatus();

          // 启动轮询（可选）
          // get().startPolling();

          console.log("[StatusStore] 状态 Store 初始化完成");
        } catch (error) {
          console.error("[StatusStore] 状态 Store 初始化失败:", error);
          throw error;
        } finally {
          setLoading({ isLoading: false });
        }
      },
    }),
    {
      name: "status-store",
    }
  )
);

// ==================== 选择器 Hooks ====================

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

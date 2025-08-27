/**
 * 新的网络服务 Hook
 * 使用统一的网络服务管理器，实现 HTTP 和 WebSocket 的协调使用
 */

import { useCallback, useEffect, useRef } from "react";
import { ConnectionState, networkService } from "../services";
import { useWebSocketActions } from "../stores/websocket";
import type { AppConfig, ClientStatus } from "../types";

/**
 * 网络服务 Hook
 */
export function useNetworkService() {
  const storeActions = useWebSocketActions();
  const initializationRef = useRef(false);

  // 初始化网络服务
  useEffect(() => {
    if (initializationRef.current) {
      return;
    }

    console.log("[NetworkService] 初始化网络服务");
    initializationRef.current = true;

    // 初始化网络服务
    networkService.initialize().catch((error) => {
      console.error("[NetworkService] 初始化失败:", error);
    });

    // 设置 WebSocket 事件监听器
    networkService.onWebSocketEvent("connected", () => {
      console.log("[NetworkService] WebSocket 已连接");
      storeActions.setConnectionState(ConnectionState.CONNECTED);

      // 连接成功后立即获取初始数据
      loadInitialData();
    });

    networkService.onWebSocketEvent("disconnected", () => {
      console.log("[NetworkService] WebSocket 已断开");
      storeActions.setConnectionState(ConnectionState.DISCONNECTED);
    });

    networkService.onWebSocketEvent("configUpdate", (config: AppConfig) => {
      console.log("[NetworkService] 收到配置更新通知");
      storeActions.setConfig(config);
    });

    networkService.onWebSocketEvent("statusUpdate", (status: ClientStatus) => {
      console.log("[NetworkService] 收到状态更新通知");
      storeActions.setStatus(status);
    });

    networkService.onWebSocketEvent("restartStatus", (restartStatus) => {
      console.log("[NetworkService] 收到重启状态通知:", restartStatus);
      storeActions.setRestartStatus(restartStatus);
    });

    networkService.onWebSocketEvent("error", (error: Error) => {
      console.error("[NetworkService] WebSocket 错误:", error);
    });

    // 清理函数
    return () => {
      console.log("[NetworkService] 清理网络服务");
      networkService.destroy();
      initializationRef.current = false;
    };
  }, [storeActions]);

  /**
   * 加载初始数据
   */
  const loadInitialData = useCallback(async () => {
    try {
      console.log("[NetworkService] 加载初始数据");

      // 并行获取配置和状态
      const [config, status] = await Promise.all([
        networkService.getConfig(),
        networkService.getClientStatus(),
      ]);

      console.log("[NetworkService] 初始数据加载成功");
      storeActions.setConfig(config);
      storeActions.setStatus(status);
    } catch (error) {
      console.error("[NetworkService] 加载初始数据失败:", error);
    }
  }, [storeActions]);

  /**
   * 获取配置
   */
  const getConfig = useCallback(async (): Promise<AppConfig> => {
    try {
      const config = await networkService.getConfig();
      storeActions.setConfig(config);
      return config;
    } catch (error) {
      console.error("[NetworkService] 获取配置失败:", error);
      throw error;
    }
  }, [storeActions]);

  /**
   * 更新配置
   */
  const updateConfig = useCallback(
    async (config: AppConfig): Promise<void> => {
      try {
        console.log("[NetworkService] 更新配置");
        await networkService.updateConfig(config);

        // 立即更新本地状态，WebSocket 通知会进一步确认
        storeActions.setConfig(config);
        console.log("[NetworkService] 配置更新成功");
      } catch (error) {
        console.error("[NetworkService] 配置更新失败:", error);
        throw error;
      }
    },
    [storeActions]
  );

  /**
   * 获取状态
   */
  const getStatus = useCallback(async () => {
    try {
      const status = await networkService.getStatus();
      storeActions.setStatus(status.client);
      return status;
    } catch (error) {
      console.error("[NetworkService] 获取状态失败:", error);
      throw error;
    }
  }, [storeActions]);

  /**
   * 刷新状态
   */
  const refreshStatus = useCallback(async (): Promise<void> => {
    try {
      await getStatus();
    } catch (error) {
      console.error("[NetworkService] 刷新状态失败:", error);
    }
  }, [getStatus]);

  /**
   * 重启服务
   */
  const restartService = useCallback(async (): Promise<void> => {
    try {
      console.log("[NetworkService] 重启服务");
      await networkService.restartService();
      console.log("[NetworkService] 重启请求已发送");
    } catch (error) {
      console.error("[NetworkService] 重启服务失败:", error);
      throw error;
    }
  }, []);

  /**
   * 重启服务并等待完成通知
   */
  const restartServiceWithNotification = useCallback(
    async (timeout = 30000): Promise<void> => {
      try {
        console.log("[NetworkService] 重启服务并等待通知");
        await networkService.restartServiceWithNotification(timeout);
        console.log("[NetworkService] 服务重启完成");
      } catch (error) {
        console.error("[NetworkService] 重启服务失败:", error);
        throw error;
      }
    },
    []
  );

  /**
   * 更新配置并等待通知
   */
  const updateConfigWithNotification = useCallback(
    async (config: AppConfig, timeout = 5000): Promise<void> => {
      try {
        console.log("[NetworkService] 更新配置并等待通知");
        await networkService.updateConfigWithNotification(config, timeout);
        console.log("[NetworkService] 配置更新完成");
      } catch (error) {
        console.error("[NetworkService] 配置更新失败:", error);
        throw error;
      }
    },
    []
  );

  /**
   * 设置自定义 WebSocket URL
   */
  const setCustomWsUrl = useCallback(
    (url: string): void => {
      console.log("[NetworkService] 设置自定义 WebSocket URL:", url);
      networkService.setWebSocketUrl(url);
      storeActions.setWsUrl(url);
    },
    [storeActions]
  );

  /**
   * 端口切换功能 (保留向后兼容)
   */
  const changePort = useCallback(
    async (newPort: number): Promise<void> => {
      try {
        console.log(`[NetworkService] 切换到端口 ${newPort}`);

        // 更新端口变更状态
        storeActions.setPortChangeStatus({
          status: "checking",
          targetPort: newPort,
          timestamp: Date.now(),
        });

        // 构建新的 WebSocket URL
        const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
        const hostname = window.location.hostname;
        const newUrl = `${protocol}//${hostname}:${newPort}`;

        // 重启服务
        await restartService();

        // 等待一段时间让服务重启
        await new Promise((resolve) => setTimeout(resolve, 5000));

        // 更新 WebSocket URL
        setCustomWsUrl(newUrl);

        // 重新加载页面
        window.location.reload();
      } catch (error) {
        console.error("[NetworkService] 端口切换失败:", error);
        storeActions.setPortChangeStatus({
          status: "failed",
          targetPort: newPort,
          error: error instanceof Error ? error.message : "端口切换失败",
          timestamp: Date.now(),
        });
        throw error;
      }
    },
    [storeActions, restartService, setCustomWsUrl]
  );

  /**
   * 获取当前 WebSocket URL
   */
  const getWebSocketUrl = useCallback((): string => {
    // 从 localStorage 获取自定义 URL
    const savedUrl = localStorage.getItem("xiaozhi-ws-url");
    if (savedUrl) {
      return savedUrl;
    }

    // 根据当前页面 URL 构建 WebSocket URL
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const hostname = window.location.hostname;
    const port = window.location.port;
    return `${protocol}//${hostname}${port ? `:${port}` : ""}`;
  }, []);

  return {
    // 数据操作方法 (HTTP)
    getConfig,
    updateConfig,
    getStatus,
    refreshStatus,
    restartService,

    // 混合模式方法 (HTTP + WebSocket)
    updateConfigWithNotification,
    restartServiceWithNotification,

    // WebSocket 管理
    setCustomWsUrl,
    getWebSocketUrl,

    // 端口切换 (向后兼容)
    changePort,

    // 工具方法
    loadInitialData,

    // 网络服务状态
    isWebSocketConnected: () => networkService.isWebSocketConnected(),
    getWebSocketState: () => networkService.getWebSocketState(),
  };
}

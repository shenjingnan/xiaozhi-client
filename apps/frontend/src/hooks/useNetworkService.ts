/**
 * 新的网络服务 Hook
 * 使用统一的网络服务管理器，实现 HTTP 和 WebSocket 的协调使用
 */

import { ConnectionState, networkService } from "@services/index";
import type { RestartStatus } from "@services/websocket";
import { useConfigStore } from "@stores/config";
import { useStatusStore } from "@stores/status";
import { useWebSocketActions } from "@stores/websocket";
import type { AppConfig, ClientStatus } from "@xiaozhi-client/shared-types";
import { useCallback, useEffect, useRef } from "react";

/**
 * 网络服务 Hook
 */
export function useNetworkService() {
  const webSocketActions = useWebSocketActions();
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

    // 保存所有事件监听器的取消订阅函数
    const unsubscribers = [
      // 连接状态事件
      networkService.onWebSocketEvent("connection:connected", () => {
        console.log("[NetworkService] WebSocket 已连接");
        webSocketActions.setConnectionState(ConnectionState.CONNECTED);

        // 连接成功后立即获取初始数据
        loadInitialData();
      }),

      networkService.onWebSocketEvent("connection:disconnected", () => {
        console.log("[NetworkService] WebSocket 已断开");
        webSocketActions.setConnectionState(ConnectionState.DISCONNECTED);
      }),

      // 数据更新事件
      networkService.onWebSocketEvent(
        "data:configUpdate",
        (config: AppConfig) => {
          console.log("[NetworkService] 收到配置更新通知");
          useConfigStore.getState().setConfig(config, "websocket");
        }
      ),

      networkService.onWebSocketEvent(
        "data:statusUpdate",
        (status: ClientStatus) => {
          console.log("[NetworkService] 收到状态更新通知");
          useStatusStore.getState().setClientStatus(status, "websocket");
        }
      ),

      networkService.onWebSocketEvent(
        "data:restartStatus",
        (restartStatus: RestartStatus) => {
          console.log("[NetworkService] 收到重启状态通知:", restartStatus);
          useStatusStore
            .getState()
            .setRestartStatus(restartStatus, "websocket");
        }
      ),

      // 系统事件
      networkService.onWebSocketEvent(
        "system:error",
        ({ error }: { error: Error }) => {
          console.error("[NetworkService] WebSocket 错误:", error);

          // 将错误信息存储到状态管理中，供 UI 展示
          const errorMessage = `WebSocket 连接错误: ${error.message}`;
          useStatusStore.getState().setError(new Error(errorMessage));

          // 根据错误类型进行分类处理
          if (
            error.message.includes("ECONNREFUSED") ||
            error.message.includes("连接被拒绝")
          ) {
            console.warn("[NetworkService] 连接被拒绝，可能是服务未启动");
            // 可以在这里添加用户友好的提示逻辑
          } else if (
            error.message.includes("timeout") ||
            error.message.includes("超时")
          ) {
            console.warn("[NetworkService] 连接超时，请检查网络连接");
          } else {
            console.warn("[NetworkService] 未知的 WebSocket 错误:", error);
          }
        }
      ),
    ];

    // 清理函数
    return () => {
      console.log("[NetworkService] 清理网络服务");
      // 清理所有事件监听器，防止内存泄漏
      for (const unsubscribe of unsubscribers) {
        try {
          unsubscribe?.();
        } catch (error) {
          console.error("[NetworkService] 清理事件监听器失败:", error);
        }
      }
      networkService.destroy();
      initializationRef.current = false;
    };
  }, [
    webSocketActions, // 连接成功后立即获取初始数据
    loadInitialData,
  ]);

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
      useConfigStore.getState().setConfig(config, "http");
      useStatusStore.getState().setClientStatus(status, "http");
    } catch (error) {
      console.error("[NetworkService] 加载初始数据失败:", error);
    }
  }, []);

  /**
   * 获取配置
   */
  const getConfig = useCallback(async (): Promise<AppConfig> => {
    try {
      const config = await networkService.getConfig();
      useConfigStore.getState().setConfig(config, "http");
      return config;
    } catch (error) {
      console.error("[NetworkService] 获取配置失败:", error);
      throw error;
    }
  }, []);

  /**
   * 更新配置
   */
  const updateConfig = useCallback(async (config: AppConfig): Promise<void> => {
    try {
      console.log("[NetworkService] 更新配置");
      await networkService.updateConfig(config);

      // 立即更新本地状态，WebSocket 通知会进一步确认
      useConfigStore.getState().setConfig(config, "http");
      console.log("[NetworkService] 配置更新成功");
    } catch (error) {
      console.error("[NetworkService] 配置更新失败:", error);
      throw error;
    }
  }, []);

  /**
   * 获取状态
   */
  const getStatus = useCallback(async () => {
    try {
      const status = await networkService.getStatus();
      useStatusStore.getState().setClientStatus(status.client, "http");
      return status;
    } catch (error) {
      console.error("[NetworkService] 获取状态失败:", error);
      throw error;
    }
  }, []);

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
      webSocketActions.setWsUrl(url);
    },
    [webSocketActions]
  );

  /**
   * 端口切换功能 (保留向后兼容)
   */
  const changePort = useCallback(
    async (newPort: number): Promise<void> => {
      try {
        console.log(`[NetworkService] 切换到端口 ${newPort}`);

        // 更新端口变更状态
        webSocketActions.setPortChangeStatus({
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
        webSocketActions.setPortChangeStatus({
          status: "failed",
          targetPort: newPort,
          error: error instanceof Error ? error.message : "端口切换失败",
          timestamp: Date.now(),
        });
        throw error;
      }
    },
    [webSocketActions, restartService, setCustomWsUrl]
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

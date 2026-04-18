/**
 * 网络服务 Hook
 *
 * 使用统一的网络服务管理器，基于 HTTP API 实现所有功能。
 */

import { networkService } from "@/services/index";
import { useConfigStore } from "@/stores/config";
import { useStatusStore } from "@/stores/status";
import { useCallback, useEffect, useRef, useState } from "react";
import type { AppConfig } from "../../types";

interface PortChangeStatus {
  status:
    | "idle"
    | "checking"
    | "polling"
    | "connecting"
    | "completed"
    | "failed";
  targetPort?: number;
  currentAttempt?: number;
  maxAttempts?: number;
  error?: string;
  timestamp: number;
}

/**
 * 网络服务 Hook
 */
export function useNetworkService() {
  const initializationRef = useRef(false);
  const [_portChangeStatus, setPortChangeStatus] = useState<
    PortChangeStatus | undefined
  >(undefined);

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

    return () => {
      console.log("[NetworkService] 清理网络服务");
      networkService.destroy();
      initializationRef.current = false;
    };
  }, []);

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

      // 立即更新本地状态
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
        console.error("[NetworkService] 重启失败:", error);
        throw error;
      }
    },
    []
  );

  /**
   * 端口切换功能
   */
  const changePort = useCallback(
    async (newPort: number): Promise<void> => {
      try {
        console.log(`[NetworkService] 切换到端口 ${newPort}`);

        // 更新端口变更状态
        setPortChangeStatus({
          status: "checking",
          targetPort: newPort,
          timestamp: Date.now(),
        });

        // 重启服务
        await restartService();

        // 等待一段时间让服务重启
        setPortChangeStatus({
          status: "polling",
          targetPort: newPort,
          currentAttempt: 0,
          maxAttempts: 45,
          timestamp: Date.now(),
        });
        await new Promise((resolve) => setTimeout(resolve, 5000));

        // 重新加载页面
        window.location.reload();
      } catch (error) {
        console.error("[NetworkService] 端口切换失败:", error);
        setPortChangeStatus({
          status: "failed",
          targetPort: newPort,
          error: error instanceof Error ? error.message : "端口切换失败",
          timestamp: Date.now(),
        });
        throw error;
      }
    },
    [restartService]
  );

  /**
   * 获取当前服务端 URL
   */
  const getServerUrl = useCallback((): string => {
    // 根据当前页面 URL 构建服务端 URL
    const protocol = window.location.protocol === "https:" ? "https:" : "http:";
    const hostname = window.location.hostname;
    const port = window.location.port || "9999";
    return `${protocol}//${hostname}:${port}`;
  }, []);

  return {
    // 数据操作方法 (HTTP)
    getConfig,
    updateConfig,
    getStatus,
    refreshStatus,
    restartService,

    // 重启服务（带轮询等待）
    restartServiceWithNotification,

    // 端口切换
    changePort,

    // 工具方法
    loadInitialData,
    getServerUrl,
  };
}

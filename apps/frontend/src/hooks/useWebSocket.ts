/**
 * WebSocket Hook - 重构版本（第二阶段）
 *
 * 重构内容：
 * - 移除直接的 WebSocket 实例创建，使用 WebSocketManager 单例
 * - 集成新的 config 和 status stores
 * - 使用事件总线进行消息处理
 * - 保持向后兼容性，现有组件无需修改
 *
 * 架构说明：
 * - WebSocketManager: 单例 WebSocket 连接管理
 * - ConfigStore: 配置数据统一管理
 * - StatusStore: 状态数据统一管理
 * - WebSocketStore: 纯连接状态管理
 */

import type { AppConfig, ClientStatus } from "@xiaozhi/shared-types";
import { webSocketManager } from "@services/websocket";
import { useConfig, useConfigActions } from "@stores/config";
import {
  useClientStatus,
  useRestartStatus,
  useStatusActions,
} from "@stores/status";
import { useWebSocketActions } from "@stores/websocket";
import {
  buildWebSocketUrl,
  checkPortAvailability,
  extractPortFromUrl,
} from "@utils/portUtils";
import { useCallback, useEffect, useRef, useState } from "react";

/**
 * 向后兼容的状态接口
 */
interface WebSocketState {
  connected: boolean;
  config: AppConfig | null;
  status: ClientStatus | null;
  restartStatus?: {
    status: "restarting" | "completed" | "failed";
    error?: string;
    timestamp: number;
  };
}

/**
 * useWebSocket Hook - 重构版本
 *
 * @deprecated 建议使用新的专用 hooks：
 * - useWebSocketConnection() 用于连接管理
 * - useConfigData() 用于配置数据
 * - useStatusData() 用于状态数据
 */
export function useWebSocket() {
  console.warn(
    "[useWebSocket] 此 hook 已重构，建议使用新的专用 hooks：useWebSocketConnection()、useConfigData()、useStatusData()"
  );

  // 使用新的 stores 获取数据
  const config = useConfig();
  const clientStatus = useClientStatus();
  const restartStatus = useRestartStatus();

  // 获取 store actions
  const webSocketActions = useWebSocketActions();
  const configActions = useConfigActions();
  const statusActions = useStatusActions();

  // 向后兼容的本地状态
  const [wsUrl, setWsUrl] = useState<string>("");
  const isInitialized = useRef(false);

  // 初始化 WebSocket 连接和数据加载
  useEffect(() => {
    if (isInitialized.current) return;
    isInitialized.current = true;

    console.log("[useWebSocket] 初始化 WebSocket 连接和数据加载");

    // 确保 WebSocket 连接
    if (!webSocketManager.isConnected()) {
      webSocketManager.connect();
    }

    // 获取当前 WebSocket URL
    const currentUrl = webSocketManager.getUrl();
    setWsUrl(currentUrl);

    // 初始化数据加载
    const initializeData = async () => {
      try {
        // 并行加载配置和状态数据
        await Promise.allSettled([
          configActions.getConfig(),
          statusActions.getStatus(),
        ]);
        console.log("[useWebSocket] 初始数据加载完成");
      } catch (error) {
        console.error("[useWebSocket] 初始数据加载失败:", error);
      }
    };

    initializeData();
  }, [configActions, statusActions]);

  // 动态获取WebSocket连接地址（向后兼容）
  const getWebSocketUrl = useCallback((configPort?: number) => {
    // 优先使用localStorage中保存的地址
    const savedUrl = localStorage.getItem("xiaozhi-ws-url");
    if (savedUrl) {
      return savedUrl;
    }

    // 确定要使用的端口号
    let targetPort = 9999; // 默认端口

    // 如果传入了配置端口，使用配置端口
    if (configPort) {
      targetPort = configPort;
    } else if (window.location.port) {
      // 如果当前页面有端口号，使用当前页面的端口号
      const currentPort = Number.parseInt(window.location.port);
      if (!Number.isNaN(currentPort)) {
        targetPort = currentPort;
      }
    } else if (window.location.protocol === "http:" && !window.location.port) {
      // 标准 HTTP 端口 (80)
      targetPort = 80;
    } else if (window.location.protocol === "https:" && !window.location.port) {
      // 标准 HTTPS 端口 (443)
      targetPort = 443;
    }

    // 构建 WebSocket URL
    return buildWebSocketUrl(targetPort);
  }, []);

  // 向后兼容的状态计算
  const state: WebSocketState = {
    connected: webSocketManager.isConnected(),
    config: config,
    status: clientStatus,
    restartStatus: restartStatus || undefined,
  };

  // 重构后的配置更新方法
  const updateConfig = useCallback(
    async (config: AppConfig): Promise<void> => {
      console.log("[useWebSocket] updateConfig 调用，使用新的 configActions");
      try {
        await configActions.updateConfig(config);
      } catch (error) {
        console.error("[useWebSocket] 配置更新失败:", error);
        throw error;
      }
    },
    [configActions]
  );

  // 重构后的状态刷新方法
  const refreshStatus = useCallback(async () => {
    console.log("[useWebSocket] refreshStatus 调用，使用新的 statusActions");
    try {
      await statusActions.refreshStatus();
    } catch (error) {
      console.error("[useWebSocket] 状态刷新失败:", error);
      throw error;
    }
  }, [statusActions]);

  // 重构后的服务重启方法
  const restartService = useCallback(async (): Promise<void> => {
    console.log("[useWebSocket] restartService 调用，使用新的 statusActions");
    try {
      await statusActions.restartService();
    } catch (error) {
      console.error("[useWebSocket] 服务重启失败:", error);
      throw error;
    }
  }, [statusActions]);

  // 保存自定义WebSocket地址
  const setCustomWsUrl = useCallback(
    (url: string) => {
      console.log("[useWebSocket] setCustomWsUrl 调用，使用 WebSocketManager");
      if (url) {
        localStorage.setItem("xiaozhi-ws-url", url);
        webSocketManager.setUrl(url);
      } else {
        localStorage.removeItem("xiaozhi-ws-url");
        // 恢复默认 URL
        const defaultUrl = getWebSocketUrl();
        webSocketManager.setUrl(defaultUrl);
      }
      // 更新本地状态
      setWsUrl(webSocketManager.getUrl());
    },
    [getWebSocketUrl]
  );

  // 端口切换核心函数
  const changePort = useCallback(
    async (newPort: number): Promise<void> => {
      const currentPort = extractPortFromUrl(wsUrl) || 9999;

      // 如果端口号相同，直接返回
      if (currentPort === newPort) {
        return;
      }

      // 更新端口切换状态
      webSocketActions.setPortChangeStatus({
        status: "checking",
        targetPort: newPort,
        timestamp: Date.now(),
      });

      try {
        // 更新端口切换状态
        webSocketActions.setPortChangeStatus({
          status: "checking",
          targetPort: newPort,
          timestamp: Date.now(),
        });

        // 检查端口可用性
        const isAvailable = await checkPortAvailability(newPort);
        if (!isAvailable) {
          throw new Error(`端口 ${newPort} 不可用`);
        }

        // 构建新的 WebSocket URL
        const newUrl = buildWebSocketUrl(newPort);

        // 更新 WebSocket URL
        webSocketManager.setUrl(newUrl);
        setWsUrl(newUrl);

        // 成功完成端口切换
        console.log(`[WebSocket] 端口切换到 ${newPort} 成功完成`);
        webSocketActions.setPortChangeStatus({
          status: "completed",
          targetPort: newPort,
          timestamp: Date.now(),
        });
      } catch (error) {
        // 端口切换失败
        const errorMessage =
          error instanceof Error ? error.message : "端口切换失败";
        console.error(`[WebSocket] 端口切换到 ${newPort} 失败:`, errorMessage);

        webSocketActions.setPortChangeStatus({
          status: "failed",
          targetPort: newPort,
          error: errorMessage,
          timestamp: Date.now(),
        });
        throw error;
      }
    },
    [wsUrl, webSocketActions]
  );

  return {
    ...state,
    updateConfig,
    refreshStatus,
    restartService,
    wsUrl,
    setCustomWsUrl,
    changePort,
  };
}

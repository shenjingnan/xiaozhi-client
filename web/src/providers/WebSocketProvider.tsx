import { type ReactNode, createContext, useEffect } from "react";
import {
  type PortChangeStatus,
  type RestartStatus,
  WebSocketManager,
  type WebSocketState,
} from "../services/WebSocketManager";
import {
  useWebSocketConfig,
  useWebSocketConnected,
  useWebSocketPortChangeStatus,
  useWebSocketRestartStatus,
  useWebSocketStatus,
  useWebSocketStore,
  useWebSocketUrl,
} from "../stores/websocket";
import type { AppConfig, ClientStatus } from "../types";

interface WebSocketContextType {
  manager: WebSocketManager;
  websocket: WebSocketManager;
  state: WebSocketState;
  connected: boolean;
  config: AppConfig | null;
  status: ClientStatus | null;
  restartStatus?: RestartStatus;
  portChangeStatus?: PortChangeStatus;
  wsUrl: string;
}

const WebSocketContext = createContext<WebSocketContextType | null>(null);

interface WebSocketProviderProps {
  children: ReactNode;
}

export function WebSocketProvider({ children }: WebSocketProviderProps) {
  const manager = WebSocketManager.getInstance();

  // 获取 Zustand store 的状态更新方法
  const {
    setConnected,
    setConfig: setStoreConfig,
    setStatus: setStoreStatus,
    setRestartStatus: setStoreRestartStatus,
    setPortChangeStatus: setStorePortChangeStatus,
    setWsUrl,
  } = useWebSocketStore();

  useEffect(() => {
    // 简化的事件处理函数，直接更新 Zustand store
    const handleStateChange = (newState: WebSocketState) => {
      console.log("[WebSocketProvider] 状态变化:", newState);
      setConnected(newState === "connected");
    };

    const handleConfigUpdate = (newConfig: AppConfig) => {
      console.log("[WebSocketProvider] 配置更新");
      setStoreConfig(newConfig);
    };

    const handleStatusUpdate = (newStatus: ClientStatus) => {
      console.log("[WebSocketProvider] 状态更新");
      setStoreStatus(newStatus);
    };

    const handleRestartStatusUpdate = (newRestartStatus: any) => {
      console.log("[WebSocketProvider] 重启状态更新");
      setStoreRestartStatus(newRestartStatus);
    };

    const handlePortChangeStatusUpdate = (newPortChangeStatus: any) => {
      console.log("[WebSocketProvider] 端口切换状态更新");
      setStorePortChangeStatus(newPortChangeStatus);
    };

    const handleError = (error: Error) => {
      console.error("[WebSocketProvider] WebSocket 错误:", error);
    };

    // 注册事件监听器
    manager.on("stateChange", handleStateChange);
    manager.on("configUpdate", handleConfigUpdate);
    manager.on("statusUpdate", handleStatusUpdate);
    manager.on("restartStatusUpdate", handleRestartStatusUpdate);
    manager.on("portChangeStatusUpdate", handlePortChangeStatusUpdate);
    manager.on("error", handleError);

    // 初始化连接
    manager.connect().catch((error) => {
      console.error("[WebSocketProvider] 初始连接失败:", error);
    });

    // 同步初始 URL 到 store
    setWsUrl(manager.getCurrentUrl());

    return () => {
      // 清理事件监听器
      manager.off("stateChange", handleStateChange);
      manager.off("configUpdate", handleConfigUpdate);
      manager.off("statusUpdate", handleStatusUpdate);
      manager.off("restartStatusUpdate", handleRestartStatusUpdate);
      manager.off("portChangeStatusUpdate", handlePortChangeStatusUpdate);
      manager.off("error", handleError);
    };
  }, [
    manager,
    setConnected,
    setStoreConfig,
    setStoreStatus,
    setStoreRestartStatus,
    setStorePortChangeStatus,
    setWsUrl,
  ]);

  const contextValue: WebSocketContextType = {
    manager,
    websocket: manager,
    state: manager.getState(),
    connected: false,
    config: null,
    status: null,
    restartStatus: undefined,
    portChangeStatus: undefined,
    wsUrl: "",
  };

  return (
    <WebSocketContext.Provider value={contextValue}>
      {children}
    </WebSocketContext.Provider>
  );
}

export function useWebSocketContext() {
  const manager = WebSocketManager.getInstance();

  const connected = useWebSocketConnected();
  const config = useWebSocketConfig();
  const status = useWebSocketStatus();
  const restartStatus = useWebSocketRestartStatus();
  const portChangeStatus = useWebSocketPortChangeStatus();
  const wsUrl = useWebSocketUrl();

  return {
    manager,
    websocket: manager,
    state: manager.getState(),
    connected,
    config,
    status,
    restartStatus,
    portChangeStatus,
    wsUrl,
  };
}

import {
  type ReactNode,
  createContext,
  useContext,
  useEffect,
  useState,
} from "react";
import {
  type PortChangeStatus,
  type RestartStatus,
  WebSocketManager,
  type WebSocketState,
} from "../services/WebSocketManager";
import { useWebSocketStore } from "../stores/websocket";
import type { AppConfig, ClientStatus } from "../types";

interface WebSocketContextType {
  // WebSocket 管理器实例
  manager: WebSocketManager;

  // 状态信息
  state: WebSocketState;
  connected: boolean;
  config: AppConfig | null;
  status: ClientStatus | null;
  restartStatus?: RestartStatus;
  portChangeStatus?: PortChangeStatus;
  wsUrl: string;

  // 操作方法
  getState: () => WebSocketState;
  currentState: WebSocketState;
  isConnected: boolean;
  updateConfig: (config: AppConfig) => Promise<void>;
  restartService: () => Promise<void>;
  refreshStatus: () => void;
  changePort: (port: number) => Promise<void>;
  setCustomWsUrl: (url: string) => void;
}

const WebSocketContext = createContext<WebSocketContextType | null>(null);

interface WebSocketProviderProps {
  children: ReactNode;
}

export function WebSocketProvider({ children }: WebSocketProviderProps) {
  const manager = WebSocketManager.getInstance();
  const [state, setState] = useState<WebSocketState>(manager.getState());
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [status, setStatus] = useState<ClientStatus | null>(null);
  const [restartStatus, setRestartStatus] = useState<RestartStatus | undefined>(
    undefined
  );
  const [portChangeStatus, setPortChangeStatus] = useState<
    PortChangeStatus | undefined
  >(undefined);

  // 同步状态到 Zustand store
  const {
    setConnected,
    setConfig: setStoreConfig,
    setStatus: setStoreStatus,
    setRestartStatus: setStoreRestartStatus,
    setPortChangeStatus: setStorePortChangeStatus,
    setWsUrl,
  } = useWebSocketStore();

  useEffect(() => {
    // 监听状态变化
    const handleStateChange = (newState: WebSocketState) => {
      console.log('nemo handleStateChange', newState)
      setState(newState);
      setConnected(newState === "connected");
    };

    const handleConfigUpdate = (newConfig: AppConfig) => {
      setConfig(newConfig);
      setStoreConfig(newConfig);
    };

    const handleStatusUpdate = (newStatus: ClientStatus) => {
      setStatus(newStatus);
      setStoreStatus(newStatus);
    };

    const handleRestartStatusUpdate = (newRestartStatus: RestartStatus) => {
      setRestartStatus(newRestartStatus);
      setStoreRestartStatus(newRestartStatus);
    };

    const handlePortChangeStatusUpdate = (
      newPortChangeStatus: PortChangeStatus
    ) => {
      setPortChangeStatus(newPortChangeStatus);
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
    state,
    currentState: manager.getState(),
    connected: manager.isConnected(),
    config,
    status,
    restartStatus,
    portChangeStatus,
    wsUrl: manager.getCurrentUrl(),

    isConnected: manager.isConnected(),
    getState: () => manager.getState(),
    updateConfig: (config: AppConfig) => manager.sendUpdateConfig(config),
    restartService: () => manager.sendRestartService(),
    refreshStatus: () => manager.sendGetStatus(),
    changePort: (port: number) => manager.changePort(port),
    setCustomWsUrl: (url: string) => manager.setCustomUrl(url),
  };

  return (
    <WebSocketContext.Provider value={contextValue}>
      {children}
    </WebSocketContext.Provider>
  );
}

export function useWebSocketActions() {
  const context = useContext(WebSocketContext);
  if (!context) {
    throw new Error(
      "useWebSocketActions must be used within a WebSocketProvider"
    );
  }
  return context;
}

/**
 * 新的 hook 名称，更符合语义
 */
export function useWebSocketContext() {
  const context = useContext(WebSocketContext);
  if (!context) {
    throw new Error(
      "useWebSocketContext must be used within a WebSocketProvider"
    );
  }
  return context;
}

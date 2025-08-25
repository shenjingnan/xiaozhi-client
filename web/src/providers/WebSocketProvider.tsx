import { type ReactNode, createContext, useContext } from "react";
import { useNetworkService } from "../hooks/useNetworkService";
import type { AppConfig } from "../types";

interface NetworkServiceContextType {
  // HTTP API 方法
  getConfig: () => Promise<AppConfig>;
  updateConfig: (config: AppConfig) => Promise<void>;
  getStatus: () => Promise<any>;
  refreshStatus: () => Promise<void>;
  restartService: () => Promise<void>;

  // 混合模式方法 (HTTP + WebSocket)
  updateConfigWithNotification: (
    config: AppConfig,
    timeout?: number
  ) => Promise<void>;
  restartServiceWithNotification: (timeout?: number) => Promise<void>;

  // WebSocket 管理
  setCustomWsUrl: (url: string) => void;
  getWebSocketUrl: () => string;

  // 端口切换 (向后兼容)
  changePort: (newPort: number) => Promise<void>;

  // 工具方法
  loadInitialData: () => Promise<void>;
  isWebSocketConnected: () => boolean;
  getWebSocketState: () => any;
}

const NetworkServiceContext = createContext<NetworkServiceContextType | null>(
  null
);

interface NetworkServiceProviderProps {
  children: ReactNode;
}

export function NetworkServiceProvider({
  children,
}: NetworkServiceProviderProps) {
  const networkService = useNetworkService();

  return (
    <NetworkServiceContext.Provider value={networkService}>
      {children}
    </NetworkServiceContext.Provider>
  );
}

export function useNetworkServiceActions() {
  const context = useContext(NetworkServiceContext);
  if (!context) {
    throw new Error(
      "useNetworkServiceActions must be used within a NetworkServiceProvider"
    );
  }
  return context;
}

// 向后兼容的别名
export const WebSocketProvider = NetworkServiceProvider;
export const useWebSocketActions = useNetworkServiceActions;

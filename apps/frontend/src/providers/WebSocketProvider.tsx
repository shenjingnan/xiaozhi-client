import { useNetworkService } from "@hooks/useNetworkService";
import { initializeStores } from "@stores/index";
import type { AppConfig } from "@xiaozhi/shared-types";
import {
  type ReactNode,
  createContext,
  useContext,
  useEffect,
  useState,
} from "react";

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
  const [storesInitialized, setStoresInitialized] = useState(false);

  // 初始化 stores
  useEffect(() => {
    let mounted = true;

    const initStores = async () => {
      try {
        console.log("[WebSocketProvider] 开始初始化 stores");
        await initializeStores();

        if (mounted) {
          setStoresInitialized(true);
          console.log("[WebSocketProvider] Stores 初始化完成");
        }
      } catch (error) {
        console.error("[WebSocketProvider] Stores 初始化失败:", error);
        // 即使初始化失败，也允许应用继续运行
        if (mounted) {
          setStoresInitialized(true);
        }
      }
    };

    initStores();

    return () => {
      mounted = false;
    };
  }, []);

  // 在 stores 初始化完成前显示加载状态（可选）
  if (!storesInitialized) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2" />
          <p className="text-sm text-gray-600">正在初始化应用...</p>
        </div>
      </div>
    );
  }

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

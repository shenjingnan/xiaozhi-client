/**
 * 网络服务 Provider 组件
 *
 * 为应用提供网络相关的功能，全部基于 HTTP API：
 * - HTTP API 调用（getConfig、updateConfig、getStatus 等）
 * - 服务重启通知（HTTP + 轮询等待）
 * - 端口切换
 *
 * 该组件在内部初始化所有 stores，尝试在应用启动时完成数据初始化；若初始化失败会记录错误并允许应用继续运行。
 *
 * @example
 * ```tsx
 * import { NetworkServiceProvider, useNetworkServiceActions } from '@/providers/NetworkServiceProvider';
 *
 * function App() {
 *   return (
 *     <NetworkServiceProvider>
 *       <YourAppComponents />
 *     </NetworkServiceProvider>
 *   );
 * }
 *
 * // 在组件中使用
 * function MyComponent() {
 *   const { getConfig, updateConfig } = useNetworkServiceActions();
 *   // ...
 * }
 * ```
 */
import { useNetworkService } from "@/hooks/useNetworkService";
import { initializeStores } from "@/stores/index";
import {
  type ReactNode,
  createContext,
  useContext,
  useEffect,
  useState,
} from "react";
import type { AppConfig } from "../../types";

interface NetworkServiceContextType {
  // HTTP API 方法
  getConfig: () => Promise<AppConfig>;
  updateConfig: (config: AppConfig) => Promise<void>;
  getStatus: () => Promise<any>;
  refreshStatus: () => void;
  restartService: () => Promise<void>;

  // 重启服务（带轮询等待）
  restartServiceWithNotification: (timeout?: number) => Promise<void>;

  // 端口切换
  changePort: (newPort: number) => Promise<void>;

  // 工具方法
  loadInitialData: () => Promise<void>;
  getServerUrl: () => string;
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
        console.log("[NetworkProvider] 开始初始化 stores");
        await initializeStores();

        if (mounted) {
          setStoresInitialized(true);
          console.log("[NetworkProvider] Stores 初始化完成");
        }
      } catch (error) {
        console.error("[NetworkProvider] Stores 初始化失败:", error);
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

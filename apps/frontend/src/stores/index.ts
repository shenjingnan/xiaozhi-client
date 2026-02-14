/**
 * Stores 统一初始化和管理
 *
 * 这个文件负责：
 * - 初始化所有 stores
 * - 设置 stores 之间的协调
 * - 提供统一的初始化入口
 */

import { useConfigStore } from "./config";
import { useStatusStore } from "./status";
import { useWebSocketStore } from "./websocket";

/**
 * 初始化所有 stores
 *
 * 这个函数应该在应用启动时调用一次
 */
export async function initializeStores(): Promise<void> {
  console.log("[Stores] 开始初始化所有 stores");

  try {
    // 1. 首先初始化 WebSocket store（建立连接管理）
    console.log("[Stores] 初始化 WebSocket store");
    useWebSocketStore.getState().initialize();

    // 2. 初始化配置 store（设置配置数据管理和 WebSocket 监听）
    console.log("[Stores] 初始化配置 store");
    await useConfigStore.getState().initialize();

    // 3. 初始化 MCP 服务器状态
    console.log("[Stores] 初始化 MCP 服务器状态");
    await useConfigStore.getState().refreshMcpServerStatuses();

    // 4. 初始化状态 store（设置状态数据管理和 WebSocket 监听）
    console.log("[Stores] 初始化状态 store");
    await useStatusStore.getState().initialize();

    console.log("[Stores] 所有 stores 初始化完成");
  } catch (error) {
    console.error("[Stores] Stores 初始化失败:", error);
    throw error;
  }
}

/**
 * 重置所有 stores
 *
 * 用于测试或需要完全重置应用状态时
 */
export function resetAllStores(): void {
  console.log("[Stores] 重置所有 stores");

  useWebSocketStore.getState().reset();
  useConfigStore.getState().reset();
  useStatusStore.getState().reset();

  console.log("[Stores] 所有 stores 已重置");
}

/**
 * 获取所有 stores 的状态摘要
 *
 * 用于调试和监控
 */
export function getStoresStatus() {
  const websocketState = useWebSocketStore.getState();
  const configState = useConfigStore.getState();
  const statusState = useStatusStore.getState();

  return {
    websocket: {
      connectionState: websocketState.connectionState,
      url: websocketState.wsUrl,
      connected: websocketState.connectionState === "connected",
      lastError: websocketState.lastError?.message,
    },
    config: {
      hasConfig: !!configState.config,
      isLoading: configState.loading.isLoading,
      isUpdating: configState.loading.isUpdating,
      lastUpdated: configState.loading.lastUpdated,
      lastError: configState.loading.lastError?.message,
      source: configState.lastSource,
    },
    status: {
      hasStatus: !!statusState.clientStatus,
      isLoading: statusState.loading.isLoading,
      isRestarting: statusState.loading.isRestarting,
      pollingEnabled: statusState.polling.enabled,
      lastUpdated: statusState.loading.lastUpdated,
      lastError: statusState.loading.lastError?.message,
      source: statusState.lastSource,
    },
  };
}

// 导出所有 stores 以便统一访问
export { useWebSocketStore } from "./websocket";
export { useConfigStore } from "./config";
export { useStatusStore } from "./status";

// 导出废弃的兼容性选择器（从 websocket-compat.ts 直接导入以避免循环依赖）
export {
  useWebSocketConfig,
  useWebSocketStatus,
  useWebSocketMcpEndpoint,
  useWebSocketMcpServers,
  useWebSocketMcpServerConfig,
  useWebSocketRestartStatus,
} from "./websocket-compat";

// 导出所有选择器 hooks（避免命名冲突）
export {
  // WebSocket store exports
  useWebSocketConnectionState,
  useWebSocketConnected,
  useWebSocketUrl,
  useWebSocketConnectionStats,
  useWebSocketPortChangeStatus,
  useWebSocketLastError,
  useWebSocketConnectionTimes,
  useWebSocketConnectionInfo,
  useWebSocketPortInfo,
  useWebSocketActions,
  useWebSocketControls,
  useWebSocketData,
} from "./websocket";

export {
  // Config store exports
  useConfig,
  useConfigLoading,
  useConfigIsLoading,
  useConfigIsUpdating,
  useConfigError,
  useMcpEndpoint,
  useMcpServers,
  useMcpServerConfig,
  useConnectionConfig,
  useModelScopeConfig,
  useWebUIConfig,
  useConfigSource,
  useConfigWithLoading,
  useMcpConfig,
  useSystemConfig,
  useConfigActions,
  useConfigUpdaters,
} from "./config";

export {
  // Status store exports
  useClientStatus,
  useRestartStatus,
  useServiceStatus,
  useServiceHealth,
  useFullStatus,
  useStatusLoading,
  useStatusIsLoading,
  useStatusIsRestarting,
  useStatusError,
  usePollingConfig,
  usePollingEnabled,
  useStatusSource,
  useConnectionStatus,
  useStatusMcpEndpoint,
  useActiveMcpServers,
  useLastHeartbeat,
  useStatusWithLoading,
  useServiceInfo,
  useConnectionInfo,
  useStatusActions,
  usePollingActions,
} from "./status";

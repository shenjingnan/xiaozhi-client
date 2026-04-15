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

/**
 * 初始化所有 stores
 *
 * 这个函数应该在应用启动时调用一次
 */
export async function initializeStores(): Promise<void> {
  console.log("[Stores] 开始初始化所有 stores");

  try {
    // 1. 初始化配置 store（设置配置数据管理）
    console.log("[Stores] 初始化配置 store");
    await useConfigStore.getState().initialize();

    // 2. 初始化 MCP 服务器状态
    console.log("[Stores] 初始化 MCP 服务器状态");
    await useConfigStore.getState().refreshMcpServerStatuses();

    // 3. 初始化状态 store（设置状态数据管理，基于 HTTP 轮询）
    console.log("[Stores] 初始化状态 store");
    await useStatusStore.getState().initialize();

    console.log("[Stores] 所有 stores 初始化完成");
  } catch (error) {
    console.error("[Stores] Stores 初始化失败:", error);
    throw error;
  }
}

// 导出所有 stores 以便统一访问
export { useConfigStore } from "./config";
export { useStatusStore } from "./status";

// 导出所有选择器 hooks - Config
export {
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

// 导出所有选择器 hooks - Status
export {
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

/**
 * 状态 Store 模块
 *
 * 负责状态管理、轮询和 WebSocket 集成
 */

// 导出核心 Store
export { useStatusStore } from "./StatusStore";

// 从 types.ts 导出类型（先导入以供后续使用）
import type { StatusActions, StatusState } from "./StatusStore";

// 导出类型
export type {
  StatusState,
  StatusActions,
  StatusSource,
  FullStatus,
} from "./StatusStore";

// 导出 StatusStore 类型作为组合类型
export type StatusStore = StatusState & StatusActions;

// 从 types.ts 导出所有类型
export type {
  RestartStatus,
  ServiceStatus,
  ServiceHealth,
  StatusLoadingState,
  PollingConfig,
  RestartPollingConfig,
} from "./types";

// 导出 hooks
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
  useRestartPollingStatus,
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
} from "./hooks";

// 导出初始状态（用于测试）
export { initialState } from "./types";

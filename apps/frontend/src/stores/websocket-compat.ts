/**
 * WebSocket Store 兼容性层
 *
 * 为现有组件提供向后兼容的选择器，避免破坏性变更
 * 这些选择器将数据从新的专门 stores 中获取并以旧格式返回
 */

import { ConnectionState } from "@services/websocket";
import type { AppConfig, ClientStatus } from "@xiaozhi-client/shared-types";
import { useConfigStore } from "./config";
import { useStatusStore } from "./status";
import { useWebSocketStore } from "./websocket";

/**
 * 向后兼容的配置选择器
 * @deprecated 请使用 useConfig() from "./config"
 */
export function useWebSocketConfig(): AppConfig | null {
  console.warn(
    '[useWebSocketConfig] 此选择器已废弃，请使用 useConfig() from "./config"'
  );
  return useConfigStore((state) => state.config);
}

/**
 * 向后兼容的状态选择器
 * @deprecated 请使用 useClientStatus() from "./status"
 */
export function useWebSocketStatus(): ClientStatus | null {
  console.warn(
    '[useWebSocketStatus] 此选择器已废弃，请使用 useClientStatus() from "./status"'
  );
  return useStatusStore((state) => state.clientStatus);
}

/**
 * 向后兼容的 MCP 端点选择器
 * @deprecated 请使用 useMcpEndpoint() from "./config"
 */
export function useWebSocketMcpEndpoint(): string | string[] {
  console.warn(
    '[useWebSocketMcpEndpoint] 此选择器已废弃，请使用 useMcpEndpoint() from "./config"'
  );
  const config = useConfigStore((state) => state.config);
  return config?.mcpEndpoint || "";
}

/**
 * 向后兼容的 MCP 服务器选择器
 * @deprecated 请使用 useMcpServers() from "./config"
 */
export function useWebSocketMcpServers(): Record<string, any> | null {
  console.warn(
    '[useWebSocketMcpServers] 此选择器已废弃，请使用 useMcpServers() from "./config"'
  );
  const config = useConfigStore((state) => state.config);
  return config?.mcpServers || null;
}

/**
 * 向后兼容的 MCP 服务器配置选择器
 * @deprecated 请使用 useMcpServerConfig() from "./config"
 */
export function useWebSocketMcpServerConfig(): Record<string, any> | null {
  console.warn(
    '[useWebSocketMcpServerConfig] 此选择器已废弃，请使用 useMcpServerConfig() from "./config"'
  );
  const config = useConfigStore((state) => state.config);
  return config?.mcpServerConfig || null;
}

/**
 * 向后兼容的连接状态选择器
 * @deprecated 请使用 useWebSocketConnected() from "./websocket"
 */
export function useWebSocketConnected(): boolean {
  console.warn(
    '[useWebSocketConnected] 此选择器已废弃，请使用 useWebSocketConnected() from "./websocket"'
  );
  return useWebSocketStore(
    (state) => state.connectionState === ConnectionState.CONNECTED
  );
}

/**
 * 重启状态接口
 */
interface RestartStatus {
  status: "restarting" | "completed" | "failed";
  error?: string;
  timestamp: number;
}

/**
 * 端口变更状态接口
 */
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
 * 向后兼容的重启状态选择器
 * @deprecated 请使用 useRestartStatus() from "./status"
 */
export function useWebSocketRestartStatus(): RestartStatus | null {
  console.warn(
    '[useWebSocketRestartStatus] 此选择器已废弃，请使用 useRestartStatus() from "./status"'
  );
  return useStatusStore((state) => state.restartStatus);
}

/**
 * 向后兼容的 WebSocket URL 选择器
 * @deprecated 请使用 useWebSocketUrl() from "./websocket"
 */
export function useWebSocketWsUrl(): string {
  console.warn(
    '[useWebSocketWsUrl] 此选择器已废弃，请使用 useWebSocketUrl() from "./websocket"'
  );
  return useWebSocketStore((state) => state.wsUrl);
}

/**
 * 向后兼容的端口切换状态选择器
 * @deprecated 请使用 usePortChangeStatus() from "./websocket"
 */
export function useWebSocketPortChangeStatus(): PortChangeStatus | undefined {
  console.warn(
    '[useWebSocketPortChangeStatus] 此选择器已废弃，请使用 usePortChangeStatus() from "./websocket"'
  );
  return useWebSocketStore((state) => state.portChangeStatus);
}

/**
 * 向后兼容的组合选择器
 * @deprecated 请使用新的专用 hooks
 */
export function useWebSocketState() {
  console.warn("[useWebSocketState] 此选择器已废弃，请使用新的专用 hooks");

  const config = useConfigStore((state) => state.config);
  const clientStatus = useStatusStore((state) => state.clientStatus);
  const restartStatus = useStatusStore((state) => state.restartStatus);
  const connected = useWebSocketStore(
    (state) => state.connectionState === ConnectionState.CONNECTED
  );
  const wsUrl = useWebSocketStore((state) => state.wsUrl);
  const portChangeStatus = useWebSocketStore((state) => state.portChangeStatus);

  return {
    config,
    status: clientStatus,
    restartStatus,
    connected,
    wsUrl,
    portChangeStatus,
    mcpEndpoint: config?.mcpEndpoint || "",
    mcpServers: config?.mcpServers || null,
    mcpServerConfig: config?.mcpServerConfig || null,
  };
}

// 导出所有兼容性选择器
export {
  useWebSocketConfig as useWebSocketConfig_DEPRECATED,
  useWebSocketStatus as useWebSocketStatus_DEPRECATED,
  useWebSocketMcpEndpoint as useWebSocketMcpEndpoint_DEPRECATED,
  useWebSocketMcpServers as useWebSocketMcpServers_DEPRECATED,
  useWebSocketMcpServerConfig as useWebSocketMcpServerConfig_DEPRECATED,
  useWebSocketConnected as useWebSocketConnected_DEPRECATED,
  useWebSocketRestartStatus as useWebSocketRestartStatus_DEPRECATED,
  useWebSocketWsUrl as useWebSocketWsUrl_DEPRECATED,
  useWebSocketPortChangeStatus as useWebSocketPortChangeStatus_DEPRECATED,
  useWebSocketState as useWebSocketState_DEPRECATED,
};

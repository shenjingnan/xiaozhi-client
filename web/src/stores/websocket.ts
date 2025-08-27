import { create } from "zustand";
import { devtools } from "zustand/middleware";
import { useShallow } from "zustand/react/shallow";
import { ConnectionState } from "../services/websocket";
import type { AppConfig, ClientStatus } from "../types";

interface RestartStatus {
  status: "restarting" | "completed" | "failed";
  error?: string;
  timestamp: number;
}

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

interface Tool {
  enable: boolean;
  description: string;
}

export interface McpServerConfig {
  [key: string]: {
    tools: Record<string, Tool>;
  };
}

interface McpServer {
  command: string;
  args: string[];
}

interface WebSocketState {
  // WebSocket 连接状态
  connectionState: ConnectionState;
  wsUrl: string;

  // 应用数据状态 (通过 HTTP API 获取，WebSocket 实时更新)
  config: AppConfig | null;
  status: ClientStatus | null;
  restartStatus?: RestartStatus;

  // 端口变更状态 (保留用于端口切换功能)
  portChangeStatus?: PortChangeStatus;

  // 便捷访问属性 (从 config 中提取)
  mcpEndpoint: string | string[];
  mcpServers: Record<string, McpServer>;
  mcpServerConfig: Record<string, McpServerConfig> | null;
}

interface WebSocketActions {
  // WebSocket 连接状态管理
  setConnectionState: (state: ConnectionState) => void;
  setWsUrl: (url: string) => void;

  // 应用数据状态管理
  setConfig: (config: AppConfig | null) => void;
  setStatus: (status: ClientStatus | null) => void;
  setRestartStatus: (restartStatus: RestartStatus | undefined) => void;

  // 端口变更状态管理
  setPortChangeStatus: (portChangeStatus: PortChangeStatus | undefined) => void;

  // 便捷访问属性管理
  setMcpEndpoint: (mcpEndpoint: string | string[]) => void;
  setMcpServers: (mcpServers: Record<string, McpServer>) => void;
  setMcpServerConfig: (
    mcpServerConfig: Record<string, McpServerConfig>
  ) => void;

  // 批量更新和重置
  updateFromWebSocket: (data: Partial<WebSocketState>) => void;
  reset: () => void;

  // 向后兼容的方法 (废弃)
  /** @deprecated 使用 setConnectionState 替代 */
  setConnected: (connected: boolean) => void;
}

export interface WebSocketStore extends WebSocketState, WebSocketActions {}

const initialState: WebSocketState = {
  // WebSocket 连接状态
  connectionState: ConnectionState.DISCONNECTED,
  wsUrl: "",

  // 应用数据状态
  config: null,
  status: null,
  restartStatus: undefined,

  // 端口变更状态
  portChangeStatus: undefined,

  // 便捷访问属性
  mcpEndpoint: "",
  mcpServers: {},
  mcpServerConfig: {},
};

export const useWebSocketStore = create<WebSocketStore>()(
  devtools(
    (set) => ({
      ...initialState,

      // 新的连接状态管理方法
      setConnectionState: (connectionState: ConnectionState) => {
        console.log("[Store] 更新 connectionState 状态:", connectionState);
        set({ connectionState }, false, "setConnectionState");
      },

      // 向后兼容的废弃方法
      setConnected: (connected: boolean) => {
        console.log("[Store] [DEPRECATED] 更新 connected 状态:", connected);
        const connectionState: ConnectionState = connected
          ? ConnectionState.CONNECTED
          : ConnectionState.DISCONNECTED;
        set({ connectionState }, false, "setConnected");
      },

      setConfig: (config: AppConfig | null) => {
        console.log(
          "[Store] 更新 config 状态:",
          config ? "有配置数据" : "无配置数据"
        );
        console.log("[Store] 同步更新 mcpEndpoint:", config?.mcpEndpoint);
        set(
          {
            config,
            mcpEndpoint: config?.mcpEndpoint ?? "",
          },
          false,
          "setConfig"
        );
      },

      setStatus: (status: ClientStatus | null) => {
        console.log("[Store] 更新 status 状态:", status);
        set({ status }, false, "setStatus");
      },

      setRestartStatus: (restartStatus: RestartStatus | undefined) =>
        set({ restartStatus }, false, "setRestartStatus"),

      setPortChangeStatus: (portChangeStatus: PortChangeStatus | undefined) =>
        set({ portChangeStatus }, false, "setPortChangeStatus"),

      setWsUrl: (wsUrl: string) => set({ wsUrl }, false, "setWsUrl"),

      updateFromWebSocket: (data: Partial<WebSocketState>) =>
        set((state) => ({ ...state, ...data }), false, "updateFromWebSocket"),

      reset: () => set(initialState, false, "reset"),

      setMcpServers: (mcpServers: Record<string, McpServer>) =>
        set({ mcpServers }, false, "setMcpServers"),

      setMcpServerConfig: (mcpServerConfig: Record<string, McpServerConfig>) =>
        set({ mcpServerConfig }, false, "setMcpServerConfig"),

      setMcpEndpoint: (mcpEndpoint: string | string[]) =>
        set({ mcpEndpoint }, false, "setMcpEndpoint"),
    }),
    {
      name: "websocket-store",
    }
  )
);

// 选择器 hooks，用于组件只订阅需要的状态
export const useMcpEndpoint = () =>
  useWebSocketStore((state) => state.mcpEndpoint);

// 新的连接状态选择器
export const useWebSocketConnectionState = () =>
  useWebSocketStore((state) => state.connectionState);

// 向后兼容的连接状态选择器
export const useWebSocketConnected = () =>
  useWebSocketStore(
    (state) => state.connectionState === ConnectionState.CONNECTED
  );

export const useWebSocketConfig = () =>
  useWebSocketStore((state) => state.config);
export const useWebSocketStatus = () =>
  useWebSocketStore((state) => state.status);
export const useWebSocketRestartStatus = () =>
  useWebSocketStore((state) => state.restartStatus);
export const useWebSocketPortChangeStatus = () =>
  useWebSocketStore((state) => state.portChangeStatus);
export const useWebSocketUrl = () => useWebSocketStore((state) => state.wsUrl);
export const useWebSocketMcpServers = () =>
  useWebSocketStore((state) => state.config?.mcpServers);
export const useWebSocketMcpServerConfig = () =>
  useWebSocketStore((state) => state.config?.mcpServerConfig);

// 复合选择器
export const useWebSocketConnectionInfo = () =>
  useWebSocketStore(
    useShallow((state) => ({
      connected: state.connectionState === ConnectionState.CONNECTED,
      connectionState: state.connectionState,
      wsUrl: state.wsUrl,
    }))
  );

export const useWebSocketData = () =>
  useWebSocketStore(
    useShallow((state) => ({
      config: state.config,
      status: state.status,
    }))
  );

export const useWebSocketActions = () =>
  useWebSocketStore(
    useShallow((state) => ({
      // 新的连接状态管理
      setConnectionState: state.setConnectionState,
      setWsUrl: state.setWsUrl,

      // 应用数据状态管理
      setConfig: state.setConfig,
      setStatus: state.setStatus,
      setRestartStatus: state.setRestartStatus,
      setPortChangeStatus: state.setPortChangeStatus,

      // 便捷访问属性管理
      setMcpEndpoint: state.setMcpEndpoint,
      setMcpServers: state.setMcpServers,
      setMcpServerConfig: state.setMcpServerConfig,

      // 批量更新和重置
      updateFromWebSocket: state.updateFromWebSocket,
      reset: state.reset,

      // 向后兼容 (废弃)
      setConnected: state.setConnected,
    }))
  );

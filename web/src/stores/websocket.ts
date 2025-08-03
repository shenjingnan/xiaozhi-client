import { create } from "zustand";
import { devtools } from "zustand/middleware";
import { useShallow } from "zustand/react/shallow";
import type { AppConfig, ClientStatus } from "../types";

interface RestartStatus {
  status: "restarting" | "completed" | "failed";
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
  connected: boolean;
  config: AppConfig | null;
  status: ClientStatus | null;
  restartStatus?: RestartStatus;
  wsUrl: string;
  mcpEndpoint: string | string[];
  mcpServers: Record<string, McpServer>;
  mcpServerConfig: Record<string, McpServerConfig> | null;
}

interface WebSocketActions {
  setConnected: (connected: boolean) => void;
  setConfig: (config: AppConfig | null) => void;
  setStatus: (status: ClientStatus | null) => void;
  setRestartStatus: (restartStatus: RestartStatus | undefined) => void;
  setWsUrl: (url: string) => void;
  setMcpEndpoint: (mcpEndpoint: string | string[]) => void;
  setMcpServers: (mcpServers: Record<string, McpServer>) => void;
  setMcpServerConfig: (
    mcpServerConfig: Record<string, McpServerConfig>
  ) => void;
  updateFromWebSocket: (data: Partial<WebSocketState>) => void;
  reset: () => void;
}

export interface WebSocketStore extends WebSocketState, WebSocketActions {}

const initialState: WebSocketState = {
  connected: false,
  config: null,
  status: null,
  restartStatus: undefined,
  wsUrl: "",
  mcpEndpoint: "",
  mcpServers: {},
  mcpServerConfig: {},
};

export const useWebSocketStore = create<WebSocketStore>()(
  devtools(
    (set) => ({
      ...initialState,

      setConnected: (connected: boolean) => {
        console.log("[Store] 更新 connected 状态:", connected);
        set({ connected }, false, "setConnected");
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
export const useWebSocketConnected = () =>
  useWebSocketStore((state) => state.connected);
export const useWebSocketConfig = () =>
  useWebSocketStore((state) => state.config);
export const useWebSocketStatus = () =>
  useWebSocketStore((state) => state.status);
export const useWebSocketRestartStatus = () =>
  useWebSocketStore((state) => state.restartStatus);
export const useWebSocketUrl = () => useWebSocketStore((state) => state.wsUrl);
export const useWebSocketMcpServers = () =>
  useWebSocketStore((state) => state.config?.mcpServers);
export const useWebSocketMcpServerConfig = () =>
  useWebSocketStore((state) => state.config?.mcpServerConfig);

// 复合选择器
export const useWebSocketConnectionInfo = () =>
  useWebSocketStore(
    useShallow((state) => ({
      connected: state.connected,
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
      setConnected: state.setConnected,
      setConfig: state.setConfig,
      setStatus: state.setStatus,
      setRestartStatus: state.setRestartStatus,
      setWsUrl: state.setWsUrl,
      setMcpEndpoint: state.setMcpEndpoint,
      setMcpServers: state.setMcpServers,
      setMcpServerConfig: state.setMcpServerConfig,
      updateFromWebSocket: state.updateFromWebSocket,
      reset: state.reset,
    }))
  );

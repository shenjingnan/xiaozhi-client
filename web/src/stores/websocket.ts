/**
 * WebSocket 连接状态管理 Store (重构版)
 *
 * 职责：
 * - 纯 WebSocket 连接状态管理
 * - 集成 WebSocketManager 单例
 * - 提供连接控制方法
 * - 保持向后兼容性
 *
 * 注意：
 * - 配置数据管理已迁移到 stores/config.ts
 * - 状态数据管理已迁移到 stores/status.ts
 */

import { create } from "zustand";
import { devtools } from "zustand/middleware";
import { useShallow } from "zustand/react/shallow";
import { ConnectionState, webSocketManager } from "../services/websocket";

/**
 * 端口变更状态接口（保留用于端口切换功能）
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
 * WebSocket 连接统计信息
 */
interface ConnectionStats {
  reconnectAttempts: number;
  maxReconnectAttempts: number;
  lastHeartbeat: number;
  eventListenerCount: number;
}

/**
 * WebSocket Store 状态（简化版）
 */
interface WebSocketState {
  // WebSocket 连接状态
  connectionState: ConnectionState;
  wsUrl: string;

  // 连接统计信息
  connectionStats: ConnectionStats;

  // 端口变更状态（保留用于端口切换功能）
  portChangeStatus?: PortChangeStatus;

  // 连接错误信息
  lastError: Error | null;

  // 连接时间戳
  connectedAt: number | null;
  disconnectedAt: number | null;
}

/**
 * WebSocket Store 操作方法（简化版）
 */
interface WebSocketActions {
  // 基础连接状态管理
  setConnectionState: (state: ConnectionState) => void;
  setWsUrl: (url: string) => void;
  setConnectionStats: (stats: ConnectionStats) => void;
  setLastError: (error: Error | null) => void;

  // 端口变更状态管理（保留用于端口切换功能）
  setPortChangeStatus: (portChangeStatus: PortChangeStatus | undefined) => void;

  // WebSocket 连接控制
  connect: () => Promise<void>;
  disconnect: () => void;
  reconnect: () => Promise<void>;
  send: (message: any) => boolean;

  // URL 管理
  updateUrl: (url: string) => void;

  // 工具方法
  reset: () => void;
  initialize: () => void;
  getConnectionInfo: () => {
    state: ConnectionState;
    url: string;
    stats: ConnectionStats;
    isConnected: boolean;
  };

  // 向后兼容的方法（废弃）
  /** @deprecated 使用 setConnectionState 替代 */
  setConnected: (connected: boolean) => void;
}

export interface WebSocketStore extends WebSocketState, WebSocketActions {}

/**
 * 初始状态（简化版）
 */
const initialState: WebSocketState = {
  // WebSocket 连接状态
  connectionState: ConnectionState.DISCONNECTED,
  wsUrl: "",

  // 连接统计信息
  connectionStats: {
    reconnectAttempts: 0,
    maxReconnectAttempts: 5,
    lastHeartbeat: 0,
    eventListenerCount: 0,
  },

  // 端口变更状态
  portChangeStatus: undefined,

  // 连接错误信息
  lastError: null,

  // 连接时间戳
  connectedAt: null,
  disconnectedAt: null,
};

/**
 * 创建 WebSocket Store（重构版）
 */
export const useWebSocketStore = create<WebSocketStore>()(
  devtools(
    (set, get) => ({
      ...initialState,

      // ==================== 基础连接状态管理 ====================

      setConnectionState: (connectionState: ConnectionState) => {
        console.log("[WebSocketStore] 更新连接状态:", connectionState);

        const now = Date.now();
        const updates: Partial<WebSocketState> = { connectionState };

        // 更新连接时间戳
        if (connectionState === ConnectionState.CONNECTED) {
          updates.connectedAt = now;
          updates.lastError = null;
        } else if (connectionState === ConnectionState.DISCONNECTED) {
          updates.disconnectedAt = now;
        }

        set(updates, false, "setConnectionState");

        // 同步更新 WebSocketManager 的统计信息
        const stats = webSocketManager.getConnectionStats();
        get().setConnectionStats(stats);
      },

      setWsUrl: (wsUrl: string) => {
        console.log("[WebSocketStore] 更新 WebSocket URL:", wsUrl);
        set({ wsUrl }, false, "setWsUrl");
      },

      setConnectionStats: (connectionStats: ConnectionStats) => {
        set({ connectionStats }, false, "setConnectionStats");
      },

      setLastError: (lastError: Error | null) => {
        console.log("[WebSocketStore] 更新连接错误:", lastError?.message);
        set({ lastError }, false, "setLastError");
      },

      // ==================== 端口变更状态管理 ====================

      setPortChangeStatus: (portChangeStatus: PortChangeStatus | undefined) => {
        console.log("[WebSocketStore] 更新端口变更状态:", portChangeStatus?.status);
        set({ portChangeStatus }, false, "setPortChangeStatus");
      },

      // ==================== WebSocket 连接控制 ====================

      connect: async (): Promise<void> => {
        try {
          console.log("[WebSocketStore] 开始连接 WebSocket");
          webSocketManager.connect();
        } catch (error) {
          const err = error instanceof Error ? error : new Error('连接失败');
          console.error("[WebSocketStore] 连接失败:", err);
          get().setLastError(err);
          throw err;
        }
      },

      disconnect: () => {
        console.log("[WebSocketStore] 断开 WebSocket 连接");
        webSocketManager.disconnect();
      },

      reconnect: async (): Promise<void> => {
        try {
          console.log("[WebSocketStore] 重新连接 WebSocket");
          webSocketManager.disconnect();
          await new Promise(resolve => setTimeout(resolve, 1000));
          webSocketManager.connect();
        } catch (error) {
          const err = error instanceof Error ? error : new Error('重连失败');
          console.error("[WebSocketStore] 重连失败:", err);
          get().setLastError(err);
          throw err;
        }
      },

      send: (message: any): boolean => {
        try {
          return webSocketManager.send(message);
        } catch (error) {
          const err = error instanceof Error ? error : new Error('发送消息失败');
          console.error("[WebSocketStore] 发送消息失败:", err);
          get().setLastError(err);
          return false;
        }
      },

      // ==================== URL 管理 ====================

      updateUrl: (url: string) => {
        console.log("[WebSocketStore] 更新 WebSocket URL:", url);
        webSocketManager.setUrl(url);
        get().setWsUrl(url);
      },

      // ==================== 工具方法 ====================

      getConnectionInfo: () => {
        const state = get();
        return {
          state: state.connectionState,
          url: state.wsUrl,
          stats: state.connectionStats,
          isConnected: state.connectionState === ConnectionState.CONNECTED,
        };
      },

      reset: () => {
        console.log("[WebSocketStore] 重置状态");
        set(initialState, false, "reset");
      },

      // ==================== 初始化方法 ====================

      initialize: () => {
        console.log("[WebSocketStore] 初始化 WebSocket Store");

        // 设置 WebSocket 事件监听
        webSocketManager.subscribe('connection:connecting', () => {
          get().setConnectionState(ConnectionState.CONNECTING);
        });

        webSocketManager.subscribe('connection:connected', () => {
          get().setConnectionState(ConnectionState.CONNECTED);
        });

        webSocketManager.subscribe('connection:disconnected', () => {
          get().setConnectionState(ConnectionState.DISCONNECTED);
        });

        webSocketManager.subscribe('connection:reconnecting', () => {
          get().setConnectionState(ConnectionState.RECONNECTING);
          const stats = webSocketManager.getConnectionStats();
          get().setConnectionStats(stats);
        });

        webSocketManager.subscribe('connection:error', ({ error }) => {
          get().setLastError(error);
        });

        webSocketManager.subscribe('system:heartbeat', () => {
          const stats = webSocketManager.getConnectionStats();
          get().setConnectionStats(stats);
        });

        // 初始化连接状态
        const initialStats = webSocketManager.getConnectionStats();
        get().setConnectionStats(initialStats);
        get().setWsUrl(webSocketManager.getUrl());

        console.log("[WebSocketStore] WebSocket Store 初始化完成");
      },

      // ==================== 向后兼容方法 ====================

      /** @deprecated 使用 setConnectionState 替代 */
      setConnected: (connected: boolean) => {
        console.warn("[WebSocketStore] setConnected 方法已废弃，请使用 setConnectionState");
        const connectionState: ConnectionState = connected
          ? ConnectionState.CONNECTED
          : ConnectionState.DISCONNECTED;
        get().setConnectionState(connectionState);
      },
    }),
    {
      name: "websocket-store",
    }
  )
);

// ==================== 选择器 Hooks ====================

/**
 * 获取连接状态
 */
export const useWebSocketConnectionState = () =>
  useWebSocketStore((state) => state.connectionState);

/**
 * 获取连接状态（布尔值）
 */
export const useWebSocketConnected = () =>
  useWebSocketStore(
    (state) => state.connectionState === ConnectionState.CONNECTED
  );

/**
 * 获取 WebSocket URL
 */
export const useWebSocketUrl = () => useWebSocketStore((state) => state.wsUrl);

/**
 * 获取连接统计信息
 */
export const useWebSocketConnectionStats = () =>
  useWebSocketStore((state) => state.connectionStats);

/**
 * 获取端口变更状态
 */
export const useWebSocketPortChangeStatus = () =>
  useWebSocketStore((state) => state.portChangeStatus);

/**
 * 获取最后的连接错误
 */
export const useWebSocketLastError = () =>
  useWebSocketStore((state) => state.lastError);

/**
 * 获取连接时间戳
 */
export const useWebSocketConnectionTimes = () =>
  useWebSocketStore(
    useShallow((state) => ({
      connectedAt: state.connectedAt,
      disconnectedAt: state.disconnectedAt,
    }))
  );

// ==================== 向后兼容的选择器（废弃） ====================

/**
 * @deprecated 配置数据已迁移到 stores/config.ts，请使用 useConfig()
 */
export const useWebSocketConfig = () => {
  console.warn('useWebSocketConfig 已废弃，请使用 stores/config.ts 中的 useConfig()');
  return null;
};

/**
 * @deprecated 状态数据已迁移到 stores/status.ts，请使用 useClientStatus()
 */
export const useWebSocketStatus = () => {
  console.warn('useWebSocketStatus 已废弃，请使用 stores/status.ts 中的 useClientStatus()');
  return null;
};

/**
 * @deprecated 重启状态已迁移到 stores/status.ts，请使用 useRestartStatus()
 */
export const useWebSocketRestartStatus = () => {
  console.warn('useWebSocketRestartStatus 已废弃，请使用 stores/status.ts 中的 useRestartStatus()');
  return null;
};

/**
 * @deprecated MCP 服务器数据已迁移到 stores/config.ts，请使用 useMcpServers()
 */
export const useWebSocketMcpServers = () => {
  console.warn('useWebSocketMcpServers 已废弃，请使用 stores/config.ts 中的 useMcpServers()');
  return null;
};

/**
 * @deprecated MCP 服务器配置已迁移到 stores/config.ts，请使用 useMcpServerConfig()
 */
export const useWebSocketMcpServerConfig = () => {
  console.warn('useWebSocketMcpServerConfig 已废弃，请使用 stores/config.ts 中的 useMcpServerConfig()');
  return null;
};

/**
 * @deprecated MCP 端点已迁移到 stores/config.ts，请使用 useMcpEndpoint()
 */
export const useMcpEndpoint = () => {
  console.warn('useMcpEndpoint 已废弃，请使用 stores/config.ts 中的 useMcpEndpoint()');
  return null;
};

// ==================== 复合选择器 ====================

/**
 * 获取连接相关信息
 */
export const useWebSocketConnectionInfo = () =>
  useWebSocketStore(
    useShallow((state) => ({
      connected: state.connectionState === ConnectionState.CONNECTED,
      connectionState: state.connectionState,
      wsUrl: state.wsUrl,
      stats: state.connectionStats,
      lastError: state.lastError,
      connectedAt: state.connectedAt,
      disconnectedAt: state.disconnectedAt,
    }))
  );

/**
 * 获取端口变更相关信息
 */
export const useWebSocketPortInfo = () =>
  useWebSocketStore(
    useShallow((state) => ({
      portChangeStatus: state.portChangeStatus,
      wsUrl: state.wsUrl,
    }))
  );

// ==================== 操作方法 Hooks ====================

/**
 * 获取 WebSocket 操作方法
 */
export const useWebSocketActions = () =>
  useWebSocketStore(
    useShallow((state) => ({
      // 连接状态管理
      setConnectionState: state.setConnectionState,
      setWsUrl: state.setWsUrl,
      setConnectionStats: state.setConnectionStats,
      setLastError: state.setLastError,

      // 端口变更状态管理
      setPortChangeStatus: state.setPortChangeStatus,

      // WebSocket 连接控制
      connect: state.connect,
      disconnect: state.disconnect,
      reconnect: state.reconnect,
      send: state.send,

      // URL 管理
      updateUrl: state.updateUrl,

      // 工具方法
      reset: state.reset,
      initialize: state.initialize,
      getConnectionInfo: state.getConnectionInfo,

      // 向后兼容（废弃）
      setConnected: state.setConnected,
    }))
  );

/**
 * 获取连接控制方法
 */
export const useWebSocketControls = () =>
  useWebSocketStore(
    useShallow((state) => ({
      connect: state.connect,
      disconnect: state.disconnect,
      reconnect: state.reconnect,
      send: state.send,
      updateUrl: state.updateUrl,
      isConnected: state.connectionState === ConnectionState.CONNECTED,
    }))
  );

// ==================== 向后兼容的复合选择器（废弃） ====================

/**
 * @deprecated 数据已分离到不同的 stores，请使用对应的选择器
 */
export const useWebSocketData = () => {
  console.warn('useWebSocketData 已废弃，请使用对应的专门 stores');
  return {
    config: null,
    status: null,
  };
};

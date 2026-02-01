/**
 * 配置数据统一管理 Store
 *
 * 特性：
 * - 支持 HTTP API 和 WebSocket 双重数据源
 * - 提供异步方法：getConfig()、updateConfig()、refreshConfig()
 * - 使用 Zustand 进行状态管理
 * - 提供选择器 hooks 优化组件渲染
 * - 集成 WebSocket 事件监听
 */

import { apiClient, mcpServerApi } from "@services/api";
import { webSocketManager } from "@services/websocket";
import type {
  AppConfig,
  ConnectionConfig,
  MCPServerConfig,
  MCPServerStatus,
  ModelScopeConfig,
  WebUIConfig,
} from "@xiaozhi-client/shared-types";
import { create } from "zustand";
import { devtools } from "zustand/middleware";
import { useShallow } from "zustand/react/shallow";

/**
 * 配置加载状态
 */
interface ConfigLoadingState {
  isLoading: boolean;
  isUpdating: boolean;
  isRefreshing: boolean;
  lastUpdated: number | null;
  lastError: Error | null;
}

/**
 * 配置 Store 状态
 */
interface ConfigState {
  // 配置数据
  config: AppConfig | null;

  // 加载状态
  loading: ConfigLoadingState;

  // 配置来源追踪
  lastSource: "http" | "websocket" | "initial" | null;

  // MCP 服务器状态缓存
  mcpServerStatuses: MCPServerStatus[];
  mcpServerStatusLoading: boolean;
  mcpServerStatusLastUpdate: number | null;
}

/**
 * 配置 Store 操作方法
 */
interface ConfigActions {
  // 基础操作
  setConfig: (
    config: AppConfig,
    source?: "http" | "websocket" | "initial"
  ) => void;
  setLoading: (loading: Partial<ConfigLoadingState>) => void;
  setError: (error: Error | null) => void;

  // 异步操作
  getConfig: () => Promise<AppConfig>;
  updateConfig: (config: AppConfig) => Promise<void>;
  refreshConfig: () => Promise<AppConfig>;
  reloadConfig: () => Promise<AppConfig>;

  // 部分更新操作
  updateMcpEndpoint: (endpoint: string | string[]) => Promise<void>;
  updateMcpServers: (servers: Record<string, MCPServerConfig>) => Promise<void>;
  updateConnectionConfig: (connection: ConnectionConfig) => Promise<void>;
  updateModelScopeConfig: (modelscope: ModelScopeConfig) => Promise<void>;
  updateWebUIConfig: (webUI: WebUIConfig) => Promise<void>;

  // 工具方法
  reset: () => void;
  initialize: () => Promise<void>;

  // MCP 服务器状态管理
  setMcpServerStatuses: (statuses: MCPServerStatus[]) => void;
  setMcpServerStatusLoading: (loading: boolean) => void;
  refreshMcpServerStatuses: () => Promise<MCPServerStatus[]>;
  getMcpServerStatus: (name: string) => MCPServerStatus | undefined;
}

/**
 * 完整的配置 Store 接口
 */
export interface ConfigStore extends ConfigState, ConfigActions {}

/**
 * 初始状态
 */
const initialState: ConfigState = {
  config: null,
  loading: {
    isLoading: false,
    isUpdating: false,
    isRefreshing: false,
    lastUpdated: null,
    lastError: null,
  },
  lastSource: null,
  mcpServerStatuses: [],
  mcpServerStatusLoading: false,
  mcpServerStatusLastUpdate: null,
};

/**
 * 创建配置 Store
 */
export const useConfigStore = create<ConfigStore>()(
  devtools(
    (set, get) => ({
      ...initialState,

      // ==================== 基础操作 ====================

      setConfig: (config: AppConfig, source = "http") => {
        console.log(`[ConfigStore] 设置配置数据，来源: ${source}`);
        set(
          (state) => ({
            config,
            lastSource: source,
            loading: {
              ...state.loading,
              lastUpdated: Date.now(),
              lastError: null,
            },
          }),
          false,
          "setConfig"
        );
      },

      setLoading: (loading: Partial<ConfigLoadingState>) => {
        set(
          (state) => ({
            loading: { ...state.loading, ...loading },
          }),
          false,
          "setLoading"
        );
      },

      setError: (error: Error | null) => {
        set(
          (state) => ({
            loading: { ...state.loading, lastError: error },
          }),
          false,
          "setError"
        );
      },

      // ==================== 异步操作 ====================

      getConfig: async (): Promise<AppConfig> => {
        const { config, loading } = get();

        // 如果已有配置且不超过5分钟，直接返回
        if (
          config &&
          loading.lastUpdated &&
          Date.now() - loading.lastUpdated < 5 * 60 * 1000
        ) {
          return config;
        }

        // 否则从服务器获取最新配置
        return get().refreshConfig();
      },

      updateConfig: async (newConfig: AppConfig): Promise<void> => {
        const { setLoading, setConfig, setError } = get();

        try {
          setLoading({ isUpdating: true, lastError: null });
          console.log("[ConfigStore] 开始更新配置");

          // 通过 HTTP API 更新配置
          await apiClient.updateConfig(newConfig);

          // 更新本地状态
          setConfig(newConfig, "http");

          console.log("[ConfigStore] 配置更新成功");
        } catch (error) {
          const err =
            error instanceof Error ? error : new Error("配置更新失败");
          console.error("[ConfigStore] 配置更新失败:", err);
          setError(err);
          throw err;
        } finally {
          setLoading({ isUpdating: false });
        }
      },

      refreshConfig: async (): Promise<AppConfig> => {
        const { setLoading, setConfig, setError } = get();

        try {
          setLoading({ isRefreshing: true, lastError: null });
          console.log("[ConfigStore] 开始刷新配置");

          // 从服务器获取最新配置
          const config = await apiClient.getConfig();

          // 更新本地状态
          setConfig(config, "http");

          console.log("[ConfigStore] 配置刷新成功");
          return config;
        } catch (error) {
          const err =
            error instanceof Error ? error : new Error("配置刷新失败");
          console.error("[ConfigStore] 配置刷新失败:", err);
          setError(err);
          throw err;
        } finally {
          setLoading({ isRefreshing: false });
        }
      },

      reloadConfig: async (): Promise<AppConfig> => {
        const { setLoading, setConfig, setError } = get();

        try {
          setLoading({ isRefreshing: true, lastError: null });
          console.log("[ConfigStore] 开始重新加载配置");

          // 重新加载配置文件
          const config = await apiClient.reloadConfig();

          // 更新本地状态
          setConfig(config, "http");

          console.log("[ConfigStore] 配置重新加载成功");
          return config;
        } catch (error) {
          const err =
            error instanceof Error ? error : new Error("配置重新加载失败");
          console.error("[ConfigStore] 配置重新加载失败:", err);
          setError(err);
          throw err;
        } finally {
          setLoading({ isRefreshing: false });
        }
      },

      // ==================== 部分更新操作 ====================

      updateMcpEndpoint: async (endpoint: string | string[]): Promise<void> => {
        const { config, updateConfig } = get();
        if (!config) {
          throw new Error("配置未加载，无法更新 MCP 端点");
        }

        const newConfig = { ...config, mcpEndpoint: endpoint };
        await updateConfig(newConfig);
      },

      updateMcpServers: async (
        servers: Record<string, MCPServerConfig>
      ): Promise<void> => {
        const { config, updateConfig } = get();
        if (!config) {
          throw new Error("配置未加载，无法更新 MCP 服务");
        }

        const newConfig = { ...config, mcpServers: servers };
        await updateConfig(newConfig);
      },

      updateConnectionConfig: async (
        connection: ConnectionConfig
      ): Promise<void> => {
        const { config, updateConfig } = get();
        if (!config) {
          throw new Error("配置未加载，无法更新连接配置");
        }

        const newConfig = { ...config, connection };
        await updateConfig(newConfig);
      },

      updateModelScopeConfig: async (
        modelscope: ModelScopeConfig
      ): Promise<void> => {
        const { config, updateConfig } = get();
        if (!config) {
          throw new Error("配置未加载，无法更新 ModelScope 配置");
        }

        const newConfig = { ...config, modelscope };
        await updateConfig(newConfig);
      },

      updateWebUIConfig: async (webUI: WebUIConfig): Promise<void> => {
        const { config, updateConfig } = get();
        if (!config) {
          throw new Error("配置未加载，无法更新 Web UI 配置");
        }

        const newConfig = { ...config, webUI };
        await updateConfig(newConfig);
      },

      // ==================== 工具方法 ====================

      reset: () => {
        console.log("[ConfigStore] 重置状态");
        set(initialState, false, "reset");
      },

      initialize: async (): Promise<void> => {
        const { setLoading, refreshConfig } = get();

        try {
          setLoading({ isLoading: true });
          console.log("[ConfigStore] 初始化配置 Store");

          // 设置 WebSocket 事件监听
          webSocketManager.subscribe("data:configUpdate", (config) => {
            console.log("[ConfigStore] 收到 WebSocket 配置更新");
            get().setConfig(config, "websocket");
          });

          // 获取初始配置
          await refreshConfig();

          console.log("[ConfigStore] 配置 Store 初始化完成");
        } catch (error) {
          console.error("[ConfigStore] 配置 Store 初始化失败:", error);
          throw error;
        } finally {
          setLoading({ isLoading: false });
        }
      },

      // ==================== MCP 服务器状态管理 ====================

      setMcpServerStatuses: (statuses: MCPServerStatus[]) => {
        set(
          () => ({
            mcpServerStatuses: statuses,
            mcpServerStatusLastUpdate: Date.now(),
          }),
          false,
          "setMcpServerStatuses"
        );
      },

      setMcpServerStatusLoading: (loading: boolean) => {
        set(
          () => ({
            mcpServerStatusLoading: loading,
          }),
          false,
          "setMcpServerStatusLoading"
        );
      },

      refreshMcpServerStatuses: async (): Promise<MCPServerStatus[]> => {
        const { setMcpServerStatuses, setMcpServerStatusLoading } = get();

        try {
          setMcpServerStatusLoading(true);
          console.log("[ConfigStore] 开始刷新 MCP 服务器状态");

          const response = await mcpServerApi.listServers();
          setMcpServerStatuses(response.servers);

          console.log(
            `[ConfigStore] MCP 服务器状态刷新成功，共 ${response.servers.length} 个服务器`
          );
          return response.servers;
        } catch (error) {
          const err =
            error instanceof Error
              ? error
              : new Error("MCP 服务器状态刷新失败");
          console.error("[ConfigStore] MCP 服务器状态刷新失败:", err);
          // 刷新失败时清空状态数据，避免显示过时信息
          setMcpServerStatuses([]);
          throw err;
        } finally {
          setMcpServerStatusLoading(false);
        }
      },

      getMcpServerStatus: (name: string): MCPServerStatus | undefined => {
        return get().mcpServerStatuses.find((s) => s.name === name);
      },
    }),
    {
      name: "config-store",
    }
  )
);

// ==================== 选择器 Hooks ====================

/**
 * 获取完整配置
 */
export const useConfig = () => useConfigStore((state) => state.config);

/**
 * 获取配置加载状态
 */
export const useConfigLoading = () => useConfigStore((state) => state.loading);

/**
 * 获取配置是否正在加载
 */
export const useConfigIsLoading = () =>
  useConfigStore(
    (state) => state.loading.isLoading || state.loading.isRefreshing
  );

/**
 * 获取配置是否正在更新
 */
export const useConfigIsUpdating = () =>
  useConfigStore((state) => state.loading.isUpdating);

/**
 * 获取配置错误
 */
export const useConfigError = () =>
  useConfigStore((state) => state.loading.lastError);

/**
 * 获取 MCP 端点
 */
export const useMcpEndpoint = () =>
  useConfigStore((state) => state.config?.mcpEndpoint);

/**
 * 获取 MCP 服务工具配置
 */
export const useMcpServerConfig = () =>
  useConfigStore((state) => state.config?.mcpServerConfig);

/**
 * 获取连接配置
 */
export const useConnectionConfig = () =>
  useConfigStore((state) => state.config?.connection);

/**
 * 获取 ModelScope 配置
 */
export const useModelScopeConfig = () =>
  useConfigStore((state) => state.config?.modelscope);

/**
 * 获取 Web UI 配置
 */
export const useWebUIConfig = () =>
  useConfigStore((state) => state.config?.webUI);

/**
 * 获取配置来源
 */
export const useConfigSource = () =>
  useConfigStore((state) => state.lastSource);

// ==================== 复合选择器 ====================

/**
 * 获取配置数据和加载状态
 */
export const useConfigWithLoading = () =>
  useConfigStore(
    useShallow((state) => ({
      config: state.config,
      isLoading: state.loading.isLoading || state.loading.isRefreshing,
      isUpdating: state.loading.isUpdating,
      error: state.loading.lastError,
    }))
  );

/**
 * 获取 MCP 相关配置
 */
export const useMcpConfig = () =>
  useConfigStore(
    useShallow((state) => ({
      endpoint: state.config?.mcpEndpoint,
      servers: state.config?.mcpServers,
      serverConfig: state.config?.mcpServerConfig,
    }))
  );

/**
 * 获取系统配置
 */
export const useSystemConfig = () =>
  useConfigStore(
    useShallow((state) => ({
      connection: state.config?.connection,
      modelscope: state.config?.modelscope,
      webUI: state.config?.webUI,
    }))
  );

// ==================== 操作方法 Hooks ====================

/**
 * 获取配置操作方法
 */
export const useConfigActions = () =>
  useConfigStore(
    useShallow((state) => ({
      getConfig: state.getConfig,
      updateConfig: state.updateConfig,
      refreshConfig: state.refreshConfig,
      reloadConfig: state.reloadConfig,
      updateMcpEndpoint: state.updateMcpEndpoint,
      updateMcpServers: state.updateMcpServers,
      updateConnectionConfig: state.updateConnectionConfig,
      updateModelScopeConfig: state.updateModelScopeConfig,
      updateWebUIConfig: state.updateWebUIConfig,
      reset: state.reset,
      initialize: state.initialize,
    }))
  );

/**
 * 获取配置更新方法
 */
export const useConfigUpdaters = () =>
  useConfigStore(
    useShallow((state) => ({
      updateConfig: state.updateConfig,
      updateMcpEndpoint: state.updateMcpEndpoint,
      updateMcpServers: state.updateMcpServers,
      updateConnectionConfig: state.updateConnectionConfig,
      updateModelScopeConfig: state.updateModelScopeConfig,
      updateWebUIConfig: state.updateWebUIConfig,
    }))
  );

// ==================== MCP 服务器状态 Hooks ====================

/**
 * 获取 MCP 服务器配置（向后兼容，仅配置）
 */
export const useMcpServers = () =>
  useConfigStore((state) => state.config?.mcpServers);

/**
 * 获取 MCP 服务器状态（新增，包含连接状态）
 * @returns { servers, loading, refresh, lastUpdate }
 */
export const useMcpServersWithStatus = () =>
  useConfigStore(
    useShallow((state) => ({
      servers: state.mcpServerStatuses,
      loading: state.mcpServerStatusLoading,
      refresh: state.refreshMcpServerStatuses,
      lastUpdate: state.mcpServerStatusLastUpdate,
    }))
  );

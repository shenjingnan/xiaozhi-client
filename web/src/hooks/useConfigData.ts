/**
 * useConfigData Hook
 *
 * 专门用于配置数据访问
 * 返回配置数据、加载状态、更新方法
 */

import { useCallback } from "react";
import {
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
  useConfigActions,
  useConfigUpdaters,
  useConfigWithLoading,
  useMcpConfig,
  useSystemConfig,
} from "../stores/config";
import type {
  AppConfig,
  MCPServerConfig,
  ConnectionConfig,
  ModelScopeConfig,
  WebUIConfig,
} from "../types";

/**
 * 配置数据相关的 hook
 */
export function useConfigData() {
  // 获取配置数据
  const config = useConfig();
  const loading = useConfigLoading();
  const isLoading = useConfigIsLoading();
  const isUpdating = useConfigIsUpdating();
  const error = useConfigError();

  // 获取具体配置项
  const mcpEndpoint = useMcpEndpoint();
  const mcpServers = useMcpServers();
  const mcpServerConfig = useMcpServerConfig();
  const connectionConfig = useConnectionConfig();
  const modelScopeConfig = useModelScopeConfig();
  const webUIConfig = useWebUIConfig();

  // 获取操作方法
  const {
    getConfig,
    updateConfig,
    refreshConfig,
    reloadConfig,
    updateMcpEndpoint,
    updateMcpServers,
    updateConnectionConfig,
    updateModelScopeConfig,
    updateWebUIConfig,
  } = useConfigActions();

  // 配置更新方法
  const updateFullConfig = useCallback(
    async (newConfig: AppConfig) => {
      try {
        await updateConfig(newConfig);
      } catch (error) {
        console.error("[useConfigData] 更新配置失败:", error);
        throw error;
      }
    },
    [updateConfig]
  );

  const refreshConfigData = useCallback(async () => {
    try {
      return await refreshConfig();
    } catch (error) {
      console.error("[useConfigData] 刷新配置失败:", error);
      throw error;
    }
  }, [refreshConfig]);

  const reloadConfigData = useCallback(async () => {
    try {
      return await reloadConfig();
    } catch (error) {
      console.error("[useConfigData] 重新加载配置失败:", error);
      throw error;
    }
  }, [reloadConfig]);

  const getConfigData = useCallback(async () => {
    try {
      return await getConfig();
    } catch (error) {
      console.error("[useConfigData] 获取配置失败:", error);
      throw error;
    }
  }, [getConfig]);

  // MCP 相关更新方法
  const updateMcpEndpointData = useCallback(
    async (endpoint: string | string[]) => {
      try {
        await updateMcpEndpoint(endpoint);
      } catch (error) {
        console.error("[useConfigData] 更新 MCP 端点失败:", error);
        throw error;
      }
    },
    [updateMcpEndpoint]
  );

  const updateMcpServersData = useCallback(
    async (servers: Record<string, MCPServerConfig>) => {
      try {
        await updateMcpServers(servers);
      } catch (error) {
        console.error("[useConfigData] 更新 MCP 服务器失败:", error);
        throw error;
      }
    },
    [updateMcpServers]
  );

  // 系统配置更新方法
  const updateConnectionConfigData = useCallback(
    async (connection: ConnectionConfig) => {
      try {
        await updateConnectionConfig(connection);
      } catch (error) {
        console.error("[useConfigData] 更新连接配置失败:", error);
        throw error;
      }
    },
    [updateConnectionConfig]
  );

  const updateModelScopeConfigData = useCallback(
    async (modelscope: ModelScopeConfig) => {
      try {
        await updateModelScopeConfig(modelscope);
      } catch (error) {
        console.error("[useConfigData] 更新 ModelScope 配置失败:", error);
        throw error;
      }
    },
    [updateModelScopeConfig]
  );

  const updateWebUIConfigData = useCallback(
    async (webUI: WebUIConfig) => {
      try {
        await updateWebUIConfig(webUI);
      } catch (error) {
        console.error("[useConfigData] 更新 Web UI 配置失败:", error);
        throw error;
      }
    },
    [updateWebUIConfig]
  );

  // 配置验证方法
  const hasConfig = useCallback(() => {
    return config !== null;
  }, [config]);

  const isConfigLoaded = useCallback(() => {
    return config !== null && !isLoading;
  }, [config, isLoading]);

  // 获取配置摘要
  const getConfigSummary = useCallback(() => {
    if (!config) return null;

    return {
      mcpEndpoint: config.mcpEndpoint,
      mcpServersCount: Object.keys(config.mcpServers || {}).length,
      mcpServerConfigCount: Object.keys(config.mcpServerConfig || {}).length,
      hasConnection: !!config.connection,
      hasModelScope: !!config.modelscope,
      hasWebUI: !!config.webUI,
      webUIPort: config.webUI?.port,
    };
  }, [config]);

  return {
    // 配置数据
    config,
    mcpEndpoint,
    mcpServers,
    mcpServerConfig,
    connectionConfig,
    modelScopeConfig,
    webUIConfig,

    // 加载状态
    loading,
    isLoading,
    isUpdating,
    error,

    // 基础操作方法
    getConfig: getConfigData,
    updateConfig: updateFullConfig,
    refreshConfig: refreshConfigData,
    reloadConfig: reloadConfigData,

    // MCP 相关更新方法
    updateMcpEndpoint: updateMcpEndpointData,
    updateMcpServers: updateMcpServersData,

    // 系统配置更新方法
    updateConnectionConfig: updateConnectionConfigData,
    updateModelScopeConfig: updateModelScopeConfigData,
    updateWebUIConfig: updateWebUIConfigData,

    // 工具方法
    hasConfig,
    isConfigLoaded,
    getConfigSummary,
  };
}

// 复合选择器 hooks（向后兼容）
export const useConfigWithLoadingState = useConfigWithLoading;
export const useMcpConfiguration = useMcpConfig;
export const useSystemConfiguration = useSystemConfig;
export const useConfigUpdateMethods = useConfigUpdaters;

/**
 * useToolList Hook - 工具列表状态管理
 *
 * 职责：
 * - 管理已启用和未启用的工具列表状态
 * - 提供统一的工具获取和刷新方法
 * - 处理工具格式化逻辑
 */

import { apiClient } from "@/services/api";
import type { CustomMCPToolWithStats, JSONSchema } from "@xiaozhi-client/shared-types";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

// 服务名称常量
const UNKNOWN_SERVICE_NAME = "未知服务";
const CUSTOM_SERVICE_NAME = "自定义服务";

// 工具类型别名
export type ToolWithServerInfo = {
  name: string;
  serverName: string;
  toolName: string;
  enable: boolean;
  description?: string;
  usageCount?: number;
  lastUsedTime?: string;
  inputSchema?: JSONSchema;
  handler?: {
    type: string;
    platform: string;
    config?: Record<string, unknown>;
  };
};

interface UseToolListOptions {
  mcpServerConfig?: Record<string, any>;
  onError?: (error: Error) => void;
}

interface UseToolListReturn {
  /** 已启用的工具列表 */
  enabledTools: ToolWithServerInfo[];
  /** 未启用的工具列表 */
  disabledTools: ToolWithServerInfo[];
  /** 获取工具列表（包含错误回退逻辑） */
  fetchTools: () => Promise<void>;
  /** 刷新工具列表（不包含错误回退） */
  refreshToolLists: () => Promise<void>;
}

/**
 * 工具列表管理 Hook
 *
 * 统一管理工具列表的状态和获取逻辑，消除代码重复
 */
export function useToolList({
  mcpServerConfig,
  onError,
}: UseToolListOptions = {}): UseToolListReturn {
  const [enabledTools, setEnabledTools] = useState<ToolWithServerInfo[]>([]);
  const [disabledTools, setDisabledTools] = useState<ToolWithServerInfo[]>([]);

  // 格式化工具信息的辅助函数
  const formatTool = useCallback(
    (tool: CustomMCPToolWithStats, enable: boolean): ToolWithServerInfo => {
      const { serviceName, toolName } = (() => {
        // 安全检查：确保 handler 存在
        if (!tool || !tool.handler) {
          return {
            serviceName: UNKNOWN_SERVICE_NAME,
            toolName: tool?.name || UNKNOWN_SERVICE_NAME,
          };
        }

        if (tool.handler.type === "mcp") {
          return {
            serviceName:
              tool.handler.config?.serviceName || UNKNOWN_SERVICE_NAME,
            toolName: tool.handler.config?.toolName || tool.name,
          };
        }
        if (
          tool.handler.type === "proxy" &&
          tool.handler.platform === "coze"
        ) {
          return {
            serviceName: "customMCP",
            toolName: tool.name,
          };
        }
        return {
          serviceName: CUSTOM_SERVICE_NAME,
          toolName: tool.name,
        };
      })();

      return {
        serverName: serviceName,
        toolName,
        enable,
        name: tool.name,
        description: tool.description,
        usageCount: tool.usageCount,
        lastUsedTime: tool.lastUsedTime,
        inputSchema: tool.inputSchema,
      };
    },
    []
  );

  /**
   * 核心工具获取逻辑
   * 统一处理工具列表的获取和格式化，避免代码重复
   */
  const loadTools = useCallback(
    async ({ useFallback = false } = {}): Promise<void> => {
      try {
        const [enabledToolsList, disabledToolsList] = await Promise.all([
          apiClient.getToolsList("enabled"),
          apiClient.getToolsList("disabled"),
        ]);

        // 格式化已启用和未启用的工具
        const formattedEnabledTools = enabledToolsList.map((tool) =>
          formatTool(tool, true)
        );
        const formattedDisabledTools = disabledToolsList.map((tool) =>
          formatTool(tool, false)
        );

        setEnabledTools(formattedEnabledTools);
        setDisabledTools(formattedDisabledTools);
      } catch (error) {
        console.error("获取工具列表失败:", error);
        const errorMessage =
          error instanceof Error ? error.message : "获取工具列表失败";
        toast.error(errorMessage);

        // 仅在 useFallback 为 true 时使用回退逻辑
        if (useFallback && mcpServerConfig) {
          const fallbackTools = Object.entries(mcpServerConfig).flatMap(
            ([serverName, value]) => {
              return Object.entries(value?.tools || {}).map(
                ([toolName, tool]) => ({
                  serverName,
                  toolName,
                  ...(tool as any),
                })
              );
            }
          );

          const enabled = fallbackTools.filter((tool) => tool.enable !== false);
          const disabled = fallbackTools.filter((tool) => tool.enable === false);

          setEnabledTools(enabled);
          setDisabledTools(disabled);
        }

        // 调用错误回调
        if (onError && error instanceof Error) {
          onError(error);
        }
      }
    },
    [mcpServerConfig, formatTool, onError]
  );

  /**
   * 获取工具列表（包含错误回退逻辑）
   * 用于初始化时加载工具列表
   */
  const fetchTools = useCallback(async () => {
    await loadTools({ useFallback: true });
  }, [loadTools]);

  /**
   * 刷新工具列表（不包含错误回退）
   * 用于启用/禁用工具后的刷新
   */
  const refreshToolLists = useCallback(async () => {
    await loadTools({ useFallback: false });
  }, [loadTools]);

  // 组件加载时获取工具列表
  useEffect(() => {
    void fetchTools();
  }, [fetchTools]);

  return {
    enabledTools,
    disabledTools,
    fetchTools,
    refreshToolLists,
  };
}

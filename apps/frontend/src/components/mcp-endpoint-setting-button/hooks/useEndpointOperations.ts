import { apiClient } from "@/services/api";
import { useConfigActions, useMcpEndpoint } from "@/stores/config";
import { useCallback } from "react";
import { toast } from "sonner";
import type { EndpointState } from "../types";

/**
 * 接入点操作 Hook
 * 负责接入点的连接、断开、删除、复制和添加操作
 */
export function useEndpointOperations(
  updateEndpointState: (endpoint: string, updates: Partial<EndpointState>) => void,
  removeEndpointState?: (endpoint: string) => void
) {
  const { refreshConfig } = useConfigActions();
  const mcpEndpoint = useMcpEndpoint();

  // 连接接入点
  const handleConnect = useCallback(
    async (endpoint: string) => {
      updateEndpointState(endpoint, { isOperating: true });

      try {
        await apiClient.connectEndpoint(endpoint);
        updateEndpointState(endpoint, {
          connected: true,
          isOperating: false,
          lastOperation: {
            type: "connect",
            success: true,
            message: "连接成功",
            timestamp: Date.now(),
          },
        });
        toast.success("接入点连接成功");
      } catch (error) {
        updateEndpointState(endpoint, {
          isOperating: false,
          lastOperation: {
            type: "connect",
            success: false,
            message: error instanceof Error ? error.message : "连接失败",
            timestamp: Date.now(),
          },
        });
        toast.error(error instanceof Error ? error.message : "接入点连接失败");
      }
    },
    [updateEndpointState]
  );

  // 断开接入点
  const handleDisconnect = useCallback(
    async (endpoint: string) => {
      updateEndpointState(endpoint, { isOperating: true });

      try {
        await apiClient.disconnectEndpoint(endpoint);
        updateEndpointState(endpoint, {
          connected: false,
          isOperating: false,
          lastOperation: {
            type: "disconnect",
            success: true,
            message: "断开成功",
            timestamp: Date.now(),
          },
        });
        toast.success("接入点断开成功");
      } catch (error) {
        updateEndpointState(endpoint, {
          isOperating: false,
          lastOperation: {
            type: "disconnect",
            success: false,
            message: error instanceof Error ? error.message : "断开失败",
            timestamp: Date.now(),
          },
        });
        toast.error(error instanceof Error ? error.message : "接入点断开失败");
      }
    },
    [updateEndpointState]
  );

  // 复制接入点地址到剪贴板
  const handleCopy = useCallback(async (endpoint: string) => {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(endpoint);
        toast.success("接入点地址已复制到剪贴板");
      } else {
        // 降级方案：使用传统的复制方法
        const textArea = document.createElement("textarea");
        textArea.value = endpoint;
        textArea.style.position = "fixed";
        textArea.style.opacity = "0";
        document.body.appendChild(textArea);
        textArea.select();
        const successful = document.execCommand("copy");
        document.body.removeChild(textArea);
        if (successful) {
          toast.success("接入点地址已复制到剪贴板");
        } else {
          throw new Error("复制命令执行失败");
        }
      }
    } catch (error) {
      console.error("复制失败:", error);
      toast.error("复制失败，请手动复制");
    }
  }, []);

  // 删除接入点
  const handleDeleteEndpoint = useCallback(
    async (endpoint: string) => {
      try {
        // 调用后端 API 删除接入点
        await apiClient.removeEndpoint(endpoint);

        // 刷新配置数据以更新 mcpEndpoints 列表
        await refreshConfig();

        // 从本地状态中移除该接入点
        if (removeEndpointState) {
          removeEndpointState(endpoint);
        }

        toast.success("接入点已删除");
      } catch (error) {
        console.error("删除接入点失败:", error);
        toast.error(error instanceof Error ? error.message : "删除接入点失败");
        throw error;
      }
    },
    [refreshConfig, removeEndpointState]
  );

  // 添加新接入点
  const handleAddEndpoint = useCallback(
    async (newEndpoint: string) => {
      // 检查是否与现有接入点重复
      const currentEndpoints = Array.isArray(mcpEndpoint)
        ? mcpEndpoint
        : [mcpEndpoint];
      if (currentEndpoints.includes(newEndpoint)) {
        throw new Error("该接入点已存在");
      }

      // 调用后端 API 添加接入点
      const endpointStatus = await apiClient.addEndpoint(newEndpoint);

      // 刷新配置数据以更新 mcpEndpoints 列表
      await refreshConfig();

      // 显示成功提示
      toast.success("接入点添加成功");

      // 返回新接入点的状态，用于初始化
      return {
        connected: endpointStatus.connected,
        isOperating: false,
        lastOperation: {
          type: null,
          success: false,
          message: "",
          timestamp: 0,
        },
      } as EndpointState;
    },
    [mcpEndpoint, refreshConfig]
  );

  return {
    handleConnect,
    handleDisconnect,
    handleCopy,
    handleDeleteEndpoint,
    handleAddEndpoint,
  };
}

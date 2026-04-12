import { apiClient } from "@/services/api";
import { useConfigActions, useMcpEndpoint } from "@/stores/config";
import type { EndpointState } from "./useEndpointState";
import { useCallback } from "react";
import { toast } from "sonner";

/**
 * 接入点操作 Hook
 * 用于处理接入点的连接、断开、复制、添加、删除等操作
 */
export function useEndpointActions(
  updateEndpointState: (
    endpoint: string,
    updates: Partial<EndpointState>
  ) => void,
  removeEndpointState: (endpoint: string) => void,
  addEndpointState: (endpoint: string, connected: boolean) => void
) {
  const mcpEndpoint = useMcpEndpoint();
  const { refreshConfig } = useConfigActions();

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
        removeEndpointState(endpoint);

        toast.success("接入点已删除");
        return true;
      } catch (error) {
        console.error("删除接入点失败:", error);
        toast.error(error instanceof Error ? error.message : "删除接入点失败");
        return false;
      }
    },
    [removeEndpointState, refreshConfig]
  );

  // 添加新接入点
  const handleAddEndpoint = useCallback(
    async (
      newEndpoint: string,
      config: unknown,
      onSuccess?: () => void
    ): Promise<boolean> => {
      // 检查配置是否已加载
      if (!config) {
        toast.error("配置数据未加载，请稍后重试");
        return false;
      }

      // 检查是否与现有接入点重复
      const currentEndpoints = Array.isArray(mcpEndpoint)
        ? mcpEndpoint
        : mcpEndpoint
          ? [mcpEndpoint]
          : [];
      if (currentEndpoints.includes(newEndpoint)) {
        toast.error("该接入点已存在");
        return false;
      }

      try {
        // 调用后端 API 添加接入点
        const endpointStatus = await apiClient.addEndpoint(newEndpoint);

        // 刷新配置数据以更新 mcpEndpoints 列表
        await refreshConfig();

        // 初始化新接入点的状态
        addEndpointState(newEndpoint, endpointStatus.connected);

        toast.success("接入点添加成功");
        onSuccess?.();
        return true;
      } catch (error) {
        console.error("添加接入点失败:", error);
        toast.error(error instanceof Error ? error.message : "添加接入点失败");
        return false;
      }
    },
    [mcpEndpoint, refreshConfig, addEndpointState]
  );

  return {
    handleConnect,
    handleDisconnect,
    handleCopy,
    handleDeleteEndpoint,
    handleAddEndpoint,
  };
}
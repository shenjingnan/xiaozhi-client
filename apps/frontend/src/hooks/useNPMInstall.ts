/**
 * useNPMInstall Hook - NPM 安装日志实时推送
 *
 * 功能：
 * - 管理 NPM 安装状态
 * - 订阅 WebSocket 安装事件
 * - 提供安装日志实时更新
 * - 支持安装操作触发
 */

import { useCallback, useEffect, useState } from "react";
import { webSocketManager } from "@/services/websocket";

/**
 * 安装日志接口
 */
export interface InstallLog {
  type: "stdout" | "stderr";
  message: string;
  timestamp: number;
}

/**
 * 安装状态接口
 */
export interface InstallStatus {
  status: "idle" | "installing" | "completed" | "failed";
  version?: string;
  installId?: string;
  logs: InstallLog[];
  error?: string;
  duration?: number;
}

/**
 * useNPMInstall Hook
 *
 * @returns 安装状态和操作方法
 */
export function useNPMInstall() {
  const [installStatus, setInstallStatus] = useState<InstallStatus>({
    status: "idle",
    logs: [],
  });

  useEffect(() => {
    // 订阅安装开始事件
    const unsubscribeStarted = webSocketManager.subscribe(
      "data:npmInstallStarted",
      (data) => {
        console.log("[useNPMInstall] 安装开始:", data);
        setInstallStatus({
          status: "installing",
          version: data.version,
          installId: data.installId,
          logs: [],
        });
      }
    );

    // 订阅安装日志事件
    const unsubscribeLog = webSocketManager.subscribe(
      "data:npmInstallLog",
      (data) => {
        console.log("[useNPMInstall] 收到日志:", data);
        setInstallStatus((prev) => {
          // 只处理当前安装任务的日志
          if (prev.installId === data.installId) {
            return {
              ...prev,
              logs: [
                ...prev.logs,
                {
                  type: data.type,
                  message: data.message,
                  timestamp: data.timestamp,
                },
              ],
            };
          }
          return prev;
        });
      }
    );

    // 订阅安装完成事件
    const unsubscribeCompleted = webSocketManager.subscribe(
      "data:npmInstallCompleted",
      (data) => {
        console.log("[useNPMInstall] 安装完成:", data);
        setInstallStatus((prev) => {
          // 只处理当前安装任务的完成事件
          if (prev.installId === data.installId) {
            return {
              ...prev,
              status: "completed",
              duration: data.duration,
            };
          }
          return prev;
        });
      }
    );

    // 订阅安装失败事件
    const unsubscribeFailed = webSocketManager.subscribe(
      "data:npmInstallFailed",
      (data) => {
        console.log("[useNPMInstall] 安装失败:", data);
        setInstallStatus((prev) => {
          // 只处理当前安装任务的失败事件
          if (prev.installId === data.installId) {
            return {
              ...prev,
              status: "failed",
              error: data.error,
              duration: data.duration,
            };
          }
          return prev;
        });
      }
    );

    // 清理函数：取消所有事件订阅
    return () => {
      unsubscribeStarted();
      unsubscribeLog();
      unsubscribeCompleted();
      unsubscribeFailed();
    };
  }, []);

  /**
   * 开始安装指定版本
   *
   * @param version 要安装的版本号
   * @returns Promise<安装结果>
   */
  const startInstall = useCallback(async (version: string) => {
    try {
      console.log("[useNPMInstall] 开始安装版本:", version);

      const response = await fetch("/api/update", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ version }),
      });

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error?.message || "安装请求失败");
      }

      console.log("[useNPMInstall] 安装请求已接受:", result);
      return result;
    } catch (error) {
      console.error("[useNPMInstall] 安装请求失败:", error);

      // 更新状态为失败
      setInstallStatus((prev) => ({
        ...prev,
        status: "failed",
        error: error instanceof Error ? error.message : "未知错误",
      }));

      throw error;
    }
  }, []);

  /**
   * 清除安装状态
   */
  const clearStatus = useCallback(() => {
    console.log("[useNPMInstall] 清除安装状态");
    setInstallStatus({
      status: "idle",
      logs: [],
    });
  }, []);

  /**
   * 获取状态描述文本
   */
  const getStatusText = useCallback(() => {
    switch (installStatus.status) {
      case "installing":
        return `正在安装 xiaozhi-client@${installStatus.version}...`;
      case "completed":
        return "安装完成！";
      case "failed":
        return `安装失败: ${installStatus.error}`;
      default:
        return "";
    }
  }, [installStatus]);

  /**
   * 获取状态颜色类名
   */
  const getStatusColor = useCallback(() => {
    switch (installStatus.status) {
      case "installing":
        return "text-blue-600";
      case "completed":
        return "text-green-600";
      case "failed":
        return "text-red-600";
      default:
        return "text-gray-600";
    }
  }, [installStatus]);

  /**
   * 检查是否正在安装
   */
  const isInstalling = useCallback(() => {
    return installStatus.status === "installing";
  }, [installStatus.status]);

  /**
   * 检查是否可以关闭对话框
   */
  const canCloseDialog = useCallback(() => {
    return installStatus.status !== "installing";
  }, [installStatus.status]);

  return {
    installStatus,
    startInstall,
    clearStatus,
    getStatusText,
    getStatusColor,
    isInstalling,
    canCloseDialog,
  };
}

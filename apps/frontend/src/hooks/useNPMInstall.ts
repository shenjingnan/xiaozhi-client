/**
 * useNPMInstall Hook - NPM 安装日志实时推送（SSE 模式）
 *
 * 功能：
 * - 管理 NPM 安装状态
 * - 通过 SSE (EventSource) 订阅安装事件
 * - 提供安装日志实时更新
 * - 支持安装操作触发
 */

import { useCallback, useEffect, useRef, useState } from "react";

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
function useNPMInstall() {
  const [installStatus, setInstallStatus] = useState<InstallStatus>({
    status: "idle",
    logs: [],
  });

  // 使用 ref 追踪当前活跃的 EventSource，避免重复连接
  const eventSourceRef = useRef<EventSource | null>(null);
  // 使用 ref 追踪安装状态，供事件回调安全访问（避免闭包陷阱）
  const installingRef = useRef(false);

  useEffect(() => {
    // 清理函数：组件卸载时关闭 SSE 连接
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
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

      // 关闭之前的 SSE 连接（如果有）
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }

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

      const { installId } = result.data;

      console.log("[useNPMInstall] 安装请求已接受:", { version, installId });

      // 更新状态为安装中
      installingRef.current = true;
      setInstallStatus({
        status: "installing",
        version,
        installId,
        logs: [],
      });

      // 建立 SSE 连接获取实时日志
      const eventSource = new EventSource(
        `/api/install/logs?installId=${installId}`
      );
      eventSourceRef.current = eventSource;

      // 监听日志事件
      eventSource.addEventListener("log", (e) => {
        try {
          const data = JSON.parse(e.data);
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
        } catch (error) {
          console.error("[useNPMInstall] 解析日志数据失败:", error);
        }
      });

      // 监听完成事件
      eventSource.addEventListener("completed", (e) => {
        try {
          const data = JSON.parse(e.data);
          console.log("[useNPMInstall] 安装完成:", data);

          setInstallStatus((prev) => {
            if (prev.installId === data.installId) {
              return {
                ...prev,
                status: "completed",
                duration: data.duration,
              };
            }
            return prev;
          });

          // 关闭 SSE 连接
          eventSource.close();
          eventSourceRef.current = null;
          installingRef.current = false;
        } catch (error) {
          console.error("[useNPMInstall] 解析完成数据失败:", error);
        }
      });

      // 监听失败事件
      eventSource.addEventListener("failed", (e) => {
        try {
          const data = JSON.parse(e.data);
          console.log("[useNPMInstall] 安装失败:", data);

          setInstallStatus((prev) => {
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

          // 关闭 SSE 连接
          eventSource.close();
          eventSourceRef.current = null;
          installingRef.current = false;
        } catch (error) {
          console.error("[useNPMInstall] 解析失败数据失败:", error);
        }
      });

      // 处理连接错误
      eventSource.onerror = (error) => {
        console.error("[useNPMInstall] SSE 连接错误:", error);

        // 如果不是正常关闭（即非 completed/failed 导致的），标记为失败
        if (installingRef.current) {
          installingRef.current = false;
          setInstallStatus((prev) => ({
            ...prev,
            status: "failed",
            error: "SSE 连接中断，请刷新页面查看安装状态",
          }));
        }

        eventSource.close();
        eventSourceRef.current = null;
      };

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

    // 关闭 SSE 连接
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    installingRef.current = false;

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

export { useNPMInstall };
// 默认导出 hook 实例
export default useNPMInstall;

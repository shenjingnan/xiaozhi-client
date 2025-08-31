/**
 * 重启通知管理 Hook
 *
 * 职责：
 * - 监听重启状态变化
 * - 在适当时机显示 toast 通知
 * - 避免重复通知
 * - 提供一致的用户体验
 */

import { useRestartPollingStatus, useRestartStatus } from "@/stores/status";
import { useEffect, useRef } from "react";
import { toast } from "sonner";

/**
 * 重启通知管理 Hook
 *
 * 使用方式：
 * 1. 在应用的根组件或布局组件中调用
 * 2. 自动监听重启状态变化并显示相应通知
 * 3. 确保全局只有一个实例在运行
 */
export function useRestartNotifications() {
  const restartStatus = useRestartStatus();
  const restartPollingStatus = useRestartPollingStatus();

  // 使用 ref 来跟踪已显示的通知，避免重复
  const lastNotifiedStatus = useRef<string | null>(null);
  const lastNotifiedTimestamp = useRef<number | null>(null);

  useEffect(() => {
    if (!restartStatus) {
      return;
    }

    const { status, timestamp, error } = restartStatus;

    // 避免重复通知：检查状态和时间戳是否已经通知过
    if (
      lastNotifiedStatus.current === status &&
      lastNotifiedTimestamp.current === timestamp
    ) {
      return;
    }

    // 更新已通知的状态
    lastNotifiedStatus.current = status;
    lastNotifiedTimestamp.current = timestamp;

    switch (status) {
      case "restarting":
        // 重启开始时的通知（可选，根据需要启用）
        toast.info("正在重启服务...", {
          id: "restart-status-progress", // 使用固定ID避免重复
          description: "请耐心等待",
          duration: 0,
        });
        break;

      case "completed": {
        // 重启成功通知
        const successMessage = restartPollingStatus.enabled
          ? `服务重启成功！重连检查完成 (${restartPollingStatus.currentAttempts}次检查)`
          : "服务重启成功！";

        toast.dismiss("restart-status-progress");
        toast.success(successMessage, {
          id: "restart-status-success", // 替换之前的通知
          description: "服务已恢复正常运行",
        });
        break;
      }

      case "failed": {
        // 重启失败通知
        const failureMessage = error || "服务重启失败";
        const description = restartPollingStatus.enabled
          ? `重连检查超时 (${restartPollingStatus.currentAttempts}/${restartPollingStatus.maxAttempts}次)`
          : "请检查服务状态或稍后重试";

        toast.dismiss("restart-status-progress");
        toast.error(failureMessage, {
          id: "restart-status-failed", // 替换之前的通知
          description,
        });
        break;
      }
    }
  }, [restartStatus, restartPollingStatus]);

  // 清理函数：组件卸载时清理状态
  useEffect(() => {
    return () => {
      lastNotifiedStatus.current = null;
      lastNotifiedTimestamp.current = null;
    };
  }, []);
}

/**
 * 重启通知提供者组件
 *
 * 使用方式：在应用根组件中使用
 * <RestartNotificationProvider />
 */
export function RestartNotificationProvider() {
  useRestartNotifications();
  return null; // 这是一个纯逻辑组件，不渲染任何内容
}

import { Loader2, XCircle } from "lucide-react";
import { useEffect } from "react";
import { toast } from "sonner";

interface RestartNotificationProps {
  restartStatus?: {
    status: "restarting" | "completed" | "failed";
    error?: string;
    timestamp: number;
  };
}

export function RestartNotification({
  restartStatus,
}: RestartNotificationProps) {
  useEffect(() => {
    if (!restartStatus) return;

    switch (restartStatus.status) {
      case "restarting":
        toast.loading("正在重启 MCP 服务...", {
          id: "restart-notification",
          description: "服务重启中，请稍候片刻",
          duration: Number.POSITIVE_INFINITY,
        });
        break;

      case "completed":
        toast.success("MCP 服务重启成功", {
          id: "restart-notification",
          description: "配置已更新并成功应用",
          duration: 5000,
        });
        break;

      case "failed":
        toast.error("MCP 服务重启失败", {
          id: "restart-notification",
          description: restartStatus.error || "重启过程中发生错误",
          duration: 10000,
        });
        break;
    }
  }, [restartStatus]);

  // 如果没有重启状态，或者重启已完成，不显示内联通知
  if (!restartStatus || restartStatus.status === "completed") {
    return null;
  }

  // 对于正在重启或失败的状态，显示一个内联的提示条
  return (
    <div
      className={`mb-4 p-4 rounded-lg border ${
        restartStatus.status === "restarting"
          ? "bg-blue-50 border-blue-200 dark:bg-blue-950 dark:border-blue-800"
          : "bg-red-50 border-red-200 dark:bg-red-950 dark:border-red-800"
      }`}
    >
      <div className="flex items-center gap-3">
        {restartStatus.status === "restarting" ? (
          <>
            <Loader2 className="h-5 w-5 text-blue-600 dark:text-blue-400 animate-spin" />
            <div>
              <h4 className="font-medium text-blue-900 dark:text-blue-100">
                正在重启服务
              </h4>
              <p className="text-sm text-blue-700 dark:text-blue-300 mt-1">
                正在应用新的配置，服务将在几秒钟内重新启动...
              </p>
            </div>
          </>
        ) : (
          <>
            <XCircle className="h-5 w-5 text-red-600 dark:text-red-400" />
            <div>
              <h4 className="font-medium text-red-900 dark:text-red-100">
                重启失败
              </h4>
              <p className="text-sm text-red-700 dark:text-red-300 mt-1">
                {restartStatus.error || "服务重启过程中发生错误，请检查日志"}
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

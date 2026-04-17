import { cn } from "@/lib/utils";

/**
 * MCP 服务器状态类型
 */
export type MCPServerStatusType =
  | "connected"
  | "disconnected"
  | "connecting"
  | "error";

/**
 * 状态徽章组件属性
 */
export interface StatusBadgeProps {
  /** 服务器状态 */
  status: MCPServerStatusType;
}

/**
 * 状态徽章组件
 * 显示 MCP 服务器的连接状态
 */
export function StatusBadge({ status }: StatusBadgeProps) {
  const color = {
    connected: "bg-green-500",
    disconnected: "bg-red-500",
    connecting: "bg-yellow-500",
    error: "bg-gray-500",
  };
  const labels = {
    connected: "已连接",
    disconnected: "未连接",
    connecting: "连接中",
    error: "错误",
  };

  return (
    <div className="flex items-center gap-2">
      <span
        className={cn("flex size-2 rounded-full", color[status])}
        title={labels[status]}
      />
      {labels[status]}
    </div>
  );
}

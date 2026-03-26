import { Badge } from "@/components/ui/badge";
import { Loader2Icon, WifiIcon, WifiOffIcon } from "lucide-react";
import type { EndpointState } from "./types";

/**
 * 接入点状态徽章组件
 * 显示接入点的连接状态（已连接/未连接/操作中）
 */
export function EndpointStatusBadge({ state }: { state?: EndpointState }) {
  const isConnected = state?.connected || false;
  const isOperating = state?.isOperating || false;

  return (
    <Badge
      className={`flex items-center gap-1 transition-all duration-200 text-xs sm:text-sm ${
        isConnected
          ? "bg-green-100 text-green-800 border-green-200 hover:text-green-800 hover:border-green-200 hover:bg-green-100"
          : "bg-gray-100 text-gray-600 border-gray-200 hover:bg-gray-100 hover:text-gray-600 hover:border-gray-200"
      }`}
    >
      {isOperating ? (
        <Loader2Icon className="size-3 animate-spin" />
      ) : isConnected ? (
        <WifiIcon className="size-3" />
      ) : (
        <WifiOffIcon className="size-3" />
      )}
      {isOperating ? "操作中" : isConnected ? "已连接" : "未连接"}
    </Badge>
  );
}

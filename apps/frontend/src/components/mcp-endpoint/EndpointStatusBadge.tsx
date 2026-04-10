import { Badge } from "@/components/ui/badge";
import {
  Loader2Icon,
  WifiIcon,
  WifiOffIcon,
} from "lucide-react";

interface EndpointStatusBadgeProps {
  connected: boolean;
  isOperating: boolean;
}

/**
 * 接入点状态徽章组件
 * 显示接入点的连接状态
 */
export function EndpointStatusBadge({
  connected,
  isOperating,
}: EndpointStatusBadgeProps) {
  return (
    <Badge
      className={`flex items-center gap-1 transition-all duration-200 text-xs sm:text-sm ${
        connected
          ? "bg-green-100 text-green-800 border-green-200 hover:text-green-800 hover:border-green-200 hover:bg-green-100"
          : "bg-gray-100 text-gray-600 border-gray-200 hover:bg-gray-100 hover:text-gray-600 hover:border-gray-200"
      }`}
    >
      {isOperating ? (
        <Loader2Icon className="size-3 animate-spin" />
      ) : connected ? (
        <WifiIcon className="size-3" />
      ) : (
        <WifiOffIcon className="size-3" />
      )}
      {isOperating ? "操作中" : connected ? "已连接" : "未连接"}
    </Badge>
  );
}
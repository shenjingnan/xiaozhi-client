import { Button } from "@/components/ui/button";
import { EndpointStatusBadge } from "./EndpointStatusBadge";
import {
  CopyIcon,
  Loader2Icon,
  TrashIcon,
  WifiIcon,
  WifiOffIcon,
} from "lucide-react";

// 截断长端点地址显示
const sliceEndpoint = (endpoint: string) => {
  return `${endpoint.slice(0, 30)}...${endpoint.slice(-10)}`;
};

interface EndpointItemProps {
  endpoint: string;
  connected: boolean;
  isOperating: boolean;
  onConnect: () => void;
  onDisconnect: () => void;
  onCopy: () => void;
  onDelete: () => void;
}

/**
 * 接入点项组件
 * 显示单个接入点的信息和操作按钮
 */
export function EndpointItem({
  endpoint,
  connected,
  isOperating,
  onConnect,
  onDisconnect,
  onCopy,
  onDelete,
}: EndpointItemProps) {
  return (
    <div
      className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 bg-slate-50 rounded-md font-mono gap-3 transition-all duration-200 hover:bg-slate-100"
    >
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-3 flex-1 min-w-0">
        <span className="flex-1 text-ellipsis overflow-hidden whitespace-nowrap text-sm sm:text-base">
          {sliceEndpoint(endpoint)}
        </span>
        {/* 连接状态显示 */}
        <EndpointStatusBadge connected={connected} isOperating={isOperating} />
      </div>
      <div className="flex items-center gap-1 sm:gap-2 flex-wrap justify-end">
        <Button
          variant="outline"
          size="icon"
          onClick={onCopy}
          title="复制完整地址"
          className="transition-all duration-200 hover:scale-105"
        >
          <CopyIcon className="size-4" />
        </Button>
        {/* 连接/断开按钮 */}
        {connected ? (
          <Button
            variant="outline"
            size="icon"
            onClick={onDisconnect}
            title="断开连接"
            disabled={isOperating}
            className="text-red-600 hover:text-red-700 hover:bg-red-50 transition-all duration-200 hover:scale-105 disabled:scale-100 disabled:opacity-50"
          >
            {isOperating ? (
              <Loader2Icon className="size-4 animate-spin" />
            ) : (
              <WifiOffIcon className="size-4" />
            )}
          </Button>
        ) : (
          <Button
            variant="outline"
            size="icon"
            onClick={onConnect}
            title="连接"
            disabled={isOperating}
            className="text-green-600 hover:text-green-700 hover:bg-green-50 transition-all duration-200 hover:scale-105 disabled:scale-100 disabled:opacity-50"
          >
            {isOperating ? (
              <Loader2Icon className="size-4 animate-spin" />
            ) : (
              <WifiIcon className="size-4" />
            )}
          </Button>
        )}
        <Button
          variant="outline"
          size="icon"
          onClick={onDelete}
          title="删除此接入点"
          className="transition-all duration-200 hover:scale-105 hover:text-red-600"
        >
          <TrashIcon className="size-4 text-red-500" />
        </Button>
      </div>
    </div>
  );
}
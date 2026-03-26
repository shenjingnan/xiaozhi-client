import { Button } from "@/components/ui/button";
import { CopyIcon, Loader2Icon, TrashIcon, WifiIcon, WifiOffIcon } from "lucide-react";
import type { EndpointOperationCallbacks, EndpointState } from "./types";

/**
 * 接入点操作按钮组件
 * 提供连接、断开、复制和删除操作按钮
 */
export function EndpointActions({
  endpoint,
  state,
  callbacks,
}: {
  endpoint: string;
  state?: EndpointState;
  callbacks: EndpointOperationCallbacks;
}) {
  const isConnected = state?.connected || false;
  const isOperating = state?.isOperating || false;

  return (
    <div className="flex items-center gap-1 sm:gap-2 flex-wrap justify-end">
      <Button
        variant="outline"
        size="icon"
        onClick={() => callbacks.onCopy(endpoint)}
        title="复制完整地址"
        className="transition-all duration-200 hover:scale-105"
      >
        <CopyIcon className="size-4" />
      </Button>
      {/* 连接/断开按钮 */}
      {isConnected ? (
        <Button
          variant="outline"
          size="icon"
          onClick={() => callbacks.onDisconnect(endpoint)}
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
          onClick={() => callbacks.onConnect(endpoint)}
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
        onClick={() => callbacks.onDelete(endpoint)}
        title="删除此接入点"
        className="transition-all duration-200 hover:scale-105 hover:text-red-600"
      >
        <TrashIcon className="size-4 text-red-500" />
      </Button>
    </div>
  );
}

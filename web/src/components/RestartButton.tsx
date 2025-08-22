import { Button } from "@/components/ui/button";
import { useWebSocketContext } from "@/providers/WebSocketProvider";
import { WebSocketState, type RestartStatus } from "@/services/WebSocketManager";
import { useWebSocketConnected } from "@/stores/websocket";
import { RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

/**
 * RestartButton 组件属性接口
 */
export interface RestartButtonProps {
  /** 重启状态 */
  restartStatus?: RestartStatus;
  /** 是否禁用按钮 */
  disabled?: boolean;
  /** 按钮样式变体 */
  variant?:
    | "default"
    | "destructive"
    | "outline"
    | "secondary"
    | "ghost"
    | "link";
  /** 自定义样式类 */
  className?: string;
  /** 重启中的文本 */
  restartingText?: string;
  /** 默认文本 */
  defaultText?: string;
}

/**
 * 独立的重启按钮组件
 * 基于 ConfigEditor.tsx 中的重启服务功能实现
 */
export function RestartButton({
  disabled = false,
  variant = "outline",
  className = "",
  restartingText = "重启中...",
  defaultText = "重启服务",
}: RestartButtonProps) {
  const [isRestarting, setIsRestarting] = useState(false);
  const { restartService, getState } = useWebSocketContext();
  // const connected = useWebSocketConnected();

  const checkStatus = () => {
    setTimeout(() => {
      if (getState() === WebSocketState.CONNECTED) {
        setIsRestarting(false);
        toast.success("重启服务成功");
        return;
      }
      checkStatus();
    }, 1000);
  };

  const handleRestart = async () => {
    if (isRestarting) {
      return;
    }
    restartService();
    setIsRestarting(true);
    checkStatus();
  };

  return (
    <Button
      type="button"
      onClick={handleRestart}
      variant={variant}
      disabled={isRestarting || disabled}
      className={`flex items-center gap-2 ${className}`}
    >
      <RefreshCw className={`h-4 w-4 ${isRestarting ? "animate-spin" : ""}`} />
      {isRestarting ? restartingText : defaultText}
    </Button>
  );
}

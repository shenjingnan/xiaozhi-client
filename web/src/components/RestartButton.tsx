import { Button } from "@/components/ui/button";
import { useWebSocket } from "@/hooks/useWebSocket";
import { useStatusStore } from "@/stores";
import { RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

/**
 * 重启状态接口
 */
export interface RestartStatus {
  status: "restarting" | "completed" | "failed";
  error?: string;
  timestamp: number;
}

/**
 * RestartButton 组件属性接口
 */
export interface RestartButtonProps {
  /** 重启回调函数 */
  onRestart?: () => Promise<void> | void;
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
  onRestart,
  disabled = false,
  variant = "outline",
  className = "",
  restartingText = "重启中...",
  defaultText = "重启服务",
}: RestartButtonProps) {
  const { loading: { isRestarting }, restartStatus, restartService } = useStatusStore();

  return (
    <Button
      type="button"
      onClick={restartService}
      variant={variant}
      disabled={isRestarting || disabled}
      className={`flex items-center gap-2 ${className}`}
    >
      <RefreshCw className={`h-4 w-4 ${isRestarting ? "animate-spin" : ""}`} />
      {JSON.stringify(restartStatus)}
      {isRestarting ? restartingText : defaultText}
    </Button>
  );
}

import clsx from "clsx";
import { LoaderCircleIcon, PowerIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useRestartPollingStatus, useStatusStore } from "@/stores/status";

/**
 * RestartButton 组件属性接口
 */
export interface RestartButtonProps {
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
  /** 图标模式（纯 icon 按钮，用于卡片中） */
  iconMode?: boolean;
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
  iconMode = false,
}: RestartButtonProps) {
  const {
    loading: { isRestarting },
    restartService,
  } = useStatusStore();
  const restartPollingStatus = useRestartPollingStatus();

  // 处理重启点击事件
  const handleRestart = async () => {
    try {
      await restartService();
    } catch (error) {
      console.error("[RestartButton] 重启失败:", error);
    }
  };

  // 计算显示文本
  const getDisplayText = () => {
    if (!isRestarting) {
      return defaultText;
    }

    // 如果重启轮询正在进行，显示进度信息
    if (restartPollingStatus.enabled && restartPollingStatus.startTime) {
      return "重连中...";
    }

    return restartingText;
  };

  // 图标模式：纯 icon 按钮，与卡片样式一致
  if (iconMode) {
    return (
      <Button
        type="button"
        onClick={handleRestart}
        variant="secondary"
        size="icon"
        className="size-8"
        disabled={isRestarting || disabled}
        aria-label="重启服务"
        title="重启服务"
      >
        {!isRestarting ? (
          <PowerIcon className="size-4" />
        ) : (
          <LoaderCircleIcon className="size-4 animate-spin" />
        )}
      </Button>
    );
  }

  // 默认模式：带文字的按钮
  return (
    <Button
      type="button"
      onClick={handleRestart}
      variant={variant}
      disabled={isRestarting || disabled}
      className={clsx("flex items-center gap-2 w-[120px]", className)}
    >
      {!isRestarting ? (
        <PowerIcon className="size-4" />
      ) : (
        <LoaderCircleIcon className="size-4 animate-spin" />
      )}
      {getDisplayText()}
    </Button>
  );
}

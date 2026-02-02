/**
 * InstallLogDialog 组件 - NPM 安装日志实时显示对话框
 *
 * 功能：
 * - 实时显示 NPM 安装日志
 * - 显示安装状态和进度
 * - 支持自动滚动到最新日志
 * - 安装完成后提供操作选项
 */

import { useNPMInstall } from "@hooks/useNPMInstall";
import { Alert, AlertDescription } from "@ui/alert";
import { Badge } from "@ui/badge";
import { Button } from "@ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@ui/dialog";
import { Progress } from "@ui/progress";
import { ScrollArea } from "@ui/scroll-area";
import {
  CheckCircleIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  TerminalIcon,
  XCircleIcon,
} from "lucide-react";
import type React from "react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

interface InstallLogDialogProps {
  isOpen: boolean;
  onClose: () => void;
  version: string;
}

export function InstallLogDialog({
  isOpen,
  onClose,
  version,
}: InstallLogDialogProps) {
  const {
    installStatus,
    startInstall,
    clearStatus,
    isInstalling,
    canCloseDialog,
  } = useNPMInstall();

  const logContainerRef = useRef<HTMLDivElement>(null);
  const [showDetails, setShowDetails] = useState(false);

  // 对话框打开时开始安装
  useEffect(() => {
    if (isOpen && version) {
      console.log("[InstallLogDialog] 对话框打开，开始安装版本:", version);
      clearStatus();
      startInstall(version).catch((error) => {
        console.error("[InstallLogDialog] 启动安装失败:", error);
      });
    }
  }, [isOpen, version, startInstall, clearStatus]);

  // 自动滚动到最新日志
  useEffect(() => {
    const timer = setTimeout(() => {
      if (logContainerRef.current) {
        logContainerRef.current.scrollTop =
          logContainerRef.current.scrollHeight;
      }
    }, 100);
    return () => clearTimeout(timer);
  });

  // 计算进度条进度
  const getProgressValue = () => {
    switch (installStatus.status) {
      case "idle":
        return 0;
      case "installing":
        // 基于日志数量估算进度，最多到90%
        return Math.min(90, installStatus.logs.length * 2);
      case "completed":
        return 100;
      case "failed":
        return 100;
      default:
        return 0;
    }
  };

  // 获取简洁的状态描述
  const getSimpleStatusText = () => {
    switch (installStatus.status) {
      case "installing":
        return "正在安装...";
      case "completed":
        return "安装完成";
      case "failed":
        return "安装失败";
      default:
        return "准备安装";
    }
  };

  // 获取状态图标
  const getStatusIcon = () => {
    switch (installStatus.status) {
      case "installing":
        return <TerminalIcon className="h-4 w-4 animate-pulse" />;
      case "completed":
        return <CheckCircleIcon className="h-4 w-4 text-green-600" />;
      case "failed":
        return <XCircleIcon className="h-4 w-4 text-red-600" />;
      default:
        return null;
    }
  };

  // 获取状态徽章样式
  const getStatusBadgeVariant = () => {
    switch (installStatus.status) {
      case "installing":
        return "default";
      case "completed":
        return "secondary";
      case "failed":
        return "destructive";
      default:
        return "outline";
    }
  };

  // 格式化日志消息
  const formatLogMessage = (message: string) => {
    // 简单清理日志消息，移除常见的 ANSI 控制序列
    let cleanedMessage = message;

    // 移除常见的 ANSI 转义序列
    const ansiPatterns = [
      /\[0m/g, // 重置
      /\[31m/g, // 红色
      /\[32m/g, // 绿色
      /\[33m/g, // 黄色
      /\[34m/g, // 蓝色
      /\[35m/g, // 紫色
      /\[36m/g, // 青色
      /\[37m/g, // 白色
      /\[90m/g, // 亮黑（灰色）
      /\[91m/g, // 亮红
      /\[92m/g, // 亮绿
      /\[93m/g, // 亮黄
      /\[94m/g, // 亮蓝
      /\[95m/g, // 亮紫
      /\[96m/g, // 亮青
      /\[97m/g, // 亮白
    ];

    for (const pattern of ansiPatterns) {
      cleanedMessage = cleanedMessage.replace(pattern, "");
    }

    // 分割成行并去除空行
    return cleanedMessage
      .split("\n")
      .filter((line) => line.trim())
      .map((line, index) => (
        <div key={`${line.slice(0, 20)}-${index}`} className="leading-relaxed">
          {line}
        </div>
      ));
  };

  // 处理关闭操作
  const handleClose = () => {
    if (canCloseDialog()) {
      clearStatus();
      onClose();
    } else {
      toast.error("安装过程中无法关闭对话框，请等待安装完成");
    }
  };

  // 处理键盘事件
  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === "Escape" && canCloseDialog()) {
      handleClose();
    }
  };

  // 切换详情显示
  const toggleDetails = () => {
    setShowDetails(!showDetails);
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent
        className="max-w-2xl max-h-[80vh] flex flex-col"
        onKeyDown={handleKeyDown}
      >
        <DialogHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <div className="flex items-center gap-3">
            <DialogTitle className="text-lg font-semibold">
              正在安装
            </DialogTitle>
            {installStatus.status !== "idle" && (
              <Badge
                variant={getStatusBadgeVariant()}
                className="flex items-center gap-1"
              >
                {getStatusIcon()}
                {getSimpleStatusText()}
              </Badge>
            )}
          </div>
        </DialogHeader>

        {/* 简洁的进度显示 */}
        <div className="space-y-4">
          {/* 进度条 */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium">安装进度</span>
              {installStatus.version && (
                <Badge variant="outline" className="text-xs">
                  v{installStatus.version}
                </Badge>
              )}
            </div>
            <Progress
              value={getProgressValue()}
              status={installStatus.status}
              className="w-full h-2"
            />
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>{getSimpleStatusText()}</span>
              {installStatus.duration && (
                <span>耗时: {(installStatus.duration / 1000).toFixed(1)}s</span>
              )}
            </div>
          </div>

          {/* 状态描述 */}
          {installStatus.status === "failed" && (
            <Alert variant="destructive">
              <AlertDescription>
                安装失败，请查看详细日志了解具体原因。
              </AlertDescription>
            </Alert>
          )}

          {/* 详细日志区域（可折叠） */}
          <div>
            <button
              type="button"
              onClick={toggleDetails}
              className="flex w-full items-center justify-between h-auto p-0 gap-0 hover:bg-none bg-none text-sm mb-2"
            >
              <h4 className="font-medium">安装日志</h4>
              <div className="flex items-center gap-1">
                {showDetails ? (
                  <>
                    收起 <ChevronUpIcon className="h-4 w-4" />
                  </>
                ) : (
                  <>
                    展开 <ChevronDownIcon className="h-4 w-4" />
                  </>
                )}
              </div>
            </button>
            {showDetails && (
              <ScrollArea
                ref={logContainerRef}
                className="h-[300px] w-full rounded-md border bg-background"
              >
                <div className="p-4 font-mono text-xs">
                  {installStatus.logs.length === 0 ? (
                    <div className="text-muted-foreground flex items-center gap-2">
                      <TerminalIcon className="h-4 w-4 animate-pulse" />
                      等待日志输出...
                    </div>
                  ) : (
                    <div className="space-y-1">
                      {installStatus.logs.map((log) => (
                        <div
                          key={`${log.timestamp}-${log.message.slice(0, 50)}`}
                          className={`${
                            log.type === "stderr"
                              ? "text-orange-600"
                              : "text-foreground"
                          } break-words`}
                        >
                          {formatLogMessage(log.message)}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </ScrollArea>
            )}
          </div>
        </div>

        {/* 底部操作栏 */}
        <DialogFooter className="flex items-center justify-between pt-4 border-t">
          <div className="flex gap-2">
            {installStatus.status === "completed" && (
              <Button
                variant="outline"
                onClick={() => window.location.reload()}
                className="flex items-center gap-2"
              >
                <CheckCircleIcon className="h-4 w-4" />
                重启应用
              </Button>
            )}

            <Button
              onClick={handleClose}
              disabled={!canCloseDialog()}
              variant={
                installStatus.status === "failed" ? "destructive" : "default"
              }
            >
              {isInstalling()
                ? "安装中..."
                : installStatus.status === "completed"
                  ? "完成"
                  : installStatus.status === "failed"
                    ? "关闭"
                    : "关闭"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * InstallLogDialog 组件 - NPM 安装日志实时显示对话框
 *
 * 功能：
 * - 实时显示 NPM 安装日志
 * - 显示安装状态和进度
 * - 支持自动滚动到最新日志
 * - 安装完成后提供操作选项
 */

import { CheckCircle, Clock, Terminal, X, XCircle } from "lucide-react";
import type React from "react";
import { useEffect, useRef } from "react";
import { useNPMInstall } from "../hooks/useNPMInstall";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";
import { ScrollArea } from "./ui/scroll-area";

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
    getStatusText,
    getStatusColor,
    isInstalling,
    canCloseDialog,
  } = useNPMInstall();

  const logContainerRef = useRef<HTMLDivElement>(null);

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

  // 获取状态图标
  const getStatusIcon = () => {
    switch (installStatus.status) {
      case "installing":
        return <Terminal className="h-4 w-4 animate-pulse" />;
      case "completed":
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case "failed":
        return <XCircle className="h-4 w-4 text-red-600" />;
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
    }
  };

  // 处理键盘事件
  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === "Escape" && canCloseDialog()) {
      handleClose();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent
        className="max-w-4xl max-h-[80vh] flex flex-col"
        onKeyDown={handleKeyDown}
      >
        <DialogHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <div className="flex items-center gap-3">
            <DialogTitle className="text-lg font-semibold">
              安装日志
            </DialogTitle>
            {installStatus.status !== "idle" && (
              <Badge
                variant={getStatusBadgeVariant()}
                className="flex items-center gap-1"
              >
                {getStatusIcon()}
                {getStatusText()}
              </Badge>
            )}
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleClose}
            disabled={!canCloseDialog()}
            className="h-6 w-6"
          >
            <X className="h-4 w-4" />
          </Button>
        </DialogHeader>

        {/* 状态信息栏 */}
        {installStatus.status !== "idle" && (
          <div className="flex items-center justify-between p-3 bg-muted/50 rounded-md border">
            <div className="flex items-center gap-2">
              <span className={`font-medium ${getStatusColor()}`}>
                {getStatusText()}
              </span>
              {installStatus.version && (
                <Badge variant="outline" className="text-xs">
                  v{installStatus.version}
                </Badge>
              )}
            </div>

            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              {installStatus.duration && (
                <div className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  <span>
                    耗时: {(installStatus.duration / 1000).toFixed(1)}s
                  </span>
                </div>
              )}
              <div className="flex items-center gap-1">
                <Terminal className="h-3 w-3" />
                <span>日志: {installStatus.logs.length} 条</span>
              </div>
            </div>
          </div>
        )}

        {/* 日志显示区域 */}
        <div className="flex-1 min-h-0">
          <ScrollArea
            ref={logContainerRef}
            className="h-[400px] w-full rounded-md border bg-background"
          >
            <div className="p-4 font-mono text-sm">
              {installStatus.logs.length === 0 ? (
                <div className="text-muted-foreground flex items-center gap-2">
                  <Terminal className="h-4 w-4 animate-pulse" />
                  {installStatus.status === "installing"
                    ? "正在启动安装..."
                    : "等待安装开始..."}
                </div>
              ) : (
                <div className="space-y-1">
                  {installStatus.logs.map((log) => (
                    <div
                      key={`${log.timestamp}-${log.message.slice(0, 50)}`}
                      className={`${
                        log.type === "stderr"
                          ? "text-red-600"
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
        </div>

        {/* 底部操作栏 */}
        <DialogFooter className="flex items-center justify-between pt-4 border-t">
          <div className="text-sm text-muted-foreground">
            {installStatus.installId && (
              <span>安装ID: {installStatus.installId}</span>
            )}
          </div>

          <div className="flex gap-2">
            {installStatus.status === "completed" && (
              <Button
                variant="outline"
                onClick={() => window.location.reload()}
                className="flex items-center gap-2"
              >
                <CheckCircle className="h-4 w-4" />
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

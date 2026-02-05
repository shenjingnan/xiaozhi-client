import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { VersionInfo } from "@/services/api";
import { apiClient } from "@/services/api";
import { Button } from "@ui/button";
import { CopyIcon, InfoIcon, RocketIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { VersionUpgradeDialog } from "./version-upgrade-dialog";

interface VersionDisplayProps {
  className?: string;
}

interface LatestVersionInfo {
  currentVersion: string;
  latestVersion: string | null;
  hasUpdate: boolean;
  error?: string;
}

export function VersionDisplay({ className }: VersionDisplayProps) {
  const [versionInfo, setVersionInfo] = useState<VersionInfo | null>(null);
  const [latestVersionInfo, setLatestVersionInfo] =
    useState<LatestVersionInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [checkingUpdate, setCheckingUpdate] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // 用于管理定时器引用，防止内存泄漏
  const copiedTimerRef = useRef<NodeJS.Timeout | null>(null);

  // 组件卸载时清理定时器
  useEffect(() => {
    return () => {
      if (copiedTimerRef.current) {
        clearTimeout(copiedTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const fetchVersion = async () => {
      try {
        setLoading(true);
        setError(null);
        const info = await apiClient.getVersion();
        setVersionInfo(info);
      } catch (err) {
        setError(err instanceof Error ? err.message : "获取版本信息失败");
        console.error("获取版本信息失败:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchVersion();
  }, []);

  useEffect(() => {
    const checkForUpdates = async () => {
      try {
        setCheckingUpdate(true);
        const updateInfo = await apiClient.getLatestVersion();
        setLatestVersionInfo(updateInfo);
      } catch (err) {
        console.error("检查更新失败:", err);
        // 设置默认值，不显示错误给用户
        setLatestVersionInfo({
          currentVersion: versionInfo?.version || "unknown",
          latestVersion: null,
          hasUpdate: false,
          error: err instanceof Error ? err.message : "检查更新失败",
        });
      } finally {
        setCheckingUpdate(false);
      }
    };

    // 只有在获取到版本信息后才检查更新
    if (versionInfo) {
      checkForUpdates();
    }
  }, [versionInfo]);

  const handleCopyVersion = async () => {
    if (versionInfo?.version) {
      try {
        await navigator.clipboard.writeText(versionInfo.version);
        setCopied(true);

        // 清除之前的定时器
        if (copiedTimerRef.current) {
          clearTimeout(copiedTimerRef.current);
        }

        // 保存新的定时器引用
        copiedTimerRef.current = setTimeout(() => setCopied(false), 2000);
      } catch (err) {
        console.error("复制版本号失败:", err);
      }
    }
  };

  if (loading) {
    return (
      <Badge variant="outline" className={className}>
        <span className="text-xs">加载中...</span>
      </Badge>
    );
  }

  if (error || !versionInfo) {
    return (
      <Badge variant="outline" className={className}>
        <span className="text-xs text-muted-foreground">版本未知</span>
      </Badge>
    );
  }

  const tooltipContent = (
    <div className="space-y-1">
      <div className="flex items-center gap-2">
        <InfoIcon className="h-3 w-3" />
        <span className="font-semibold">版本详情</span>
      </div>
      <div className="text-xs space-y-0.5">
        <div>
          <strong>名称:</strong> {versionInfo.name}
        </div>
        <div>
          <strong>版本:</strong> {versionInfo.version}
        </div>
        {latestVersionInfo && (
          <>
            <div>
              <strong>最新版本:</strong>{" "}
              {latestVersionInfo.latestVersion || "未知"}
            </div>
            <div>
              <strong>状态:</strong>
              {checkingUpdate
                ? "检查中..."
                : latestVersionInfo.hasUpdate
                  ? "有新版本"
                  : "已是最新"}
            </div>
          </>
        )}
        <div>
          <strong>描述:</strong> {versionInfo.description}
        </div>
        <div>
          <strong>作者:</strong> {versionInfo.author}
        </div>
      </div>
      <div className="pt-1 border-t">
        <button
          type="button"
          onClick={handleCopyVersion}
          className="text-xs text-primary hover:underline flex items-center gap-1"
        >
          <CopyIcon className="h-3 w-3" />
          {copied ? "已复制!" : "复制版本号"}
        </button>
      </div>
    </div>
  );

  // 决定显示的按钮文案和图标
  const getUpgradeButton = () => {
    if (checkingUpdate) return null;

    if (latestVersionInfo?.hasUpdate && latestVersionInfo.latestVersion) {
      return (
        <VersionUpgradeDialog
          defaultSelectedVersion={latestVersionInfo.latestVersion}
        >
          <Button variant="link" className="p-0 gap-1">
            <RocketIcon />
            升级版本
          </Button>
        </VersionUpgradeDialog>
      );
    }

    return (
      <VersionUpgradeDialog defaultSelectedVersion={versionInfo.version}>
        <Button variant="link" className="p-0 gap-1">
          切换版本
        </Button>
      </VersionUpgradeDialog>
    );
  };

  return (
    <TooltipProvider>
      <div className="flex items-center gap-2">
        {getUpgradeButton()}
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="text-sm cursor-help">v{versionInfo.version}</span>
          </TooltipTrigger>
          <TooltipContent>{tooltipContent}</TooltipContent>
        </Tooltip>
      </div>
    </TooltipProvider>
  );
}

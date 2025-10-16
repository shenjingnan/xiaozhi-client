import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { VersionInfo } from "@/services/api";
import { apiClient } from "@/services/api";
import { CopyIcon, InfoIcon, RocketIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "./ui/button";
import { VersionUpgradeDialog } from "./VersionUpgradeDialog";

interface VersionDisplayProps {
  className?: string;
  showDetails?: boolean;
  variant?: "default" | "secondary" | "outline";
}

export function VersionDisplay({
  className,
  showDetails = false,
  variant = "secondary",
}: VersionDisplayProps) {
  const [versionInfo, setVersionInfo] = useState<VersionInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

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

  const handleCopyVersion = async () => {
    if (versionInfo?.version) {
      try {
        await navigator.clipboard.writeText(versionInfo.version);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
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

  return (
    <div className="flex items-center gap-2">
      <VersionUpgradeDialog defaultSelectedVersion="1.7.5">
        <Button variant="link" className="p-0 gap-1">
          <RocketIcon />
          立即升级
        </Button>
      </VersionUpgradeDialog>
      <span className="text-sm">v{versionInfo.version}</span>
    </div>
  );
}

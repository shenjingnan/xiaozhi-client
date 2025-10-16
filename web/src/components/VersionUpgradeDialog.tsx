/**
 * VersionUpgradeDialog 组件 - 版本升级选择对话框
 *
 * 功能：
 * - 提供版本选择下拉菜单
 * - 触发版本安装
 * - 集成安装日志显示
 */

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useNPMInstall } from "@/hooks/useNPMInstall";
import { Download } from "lucide-react";
import { useState, useEffect } from "react";
import { InstallLogDialog } from "./InstallLogDialog";
import { apiClient } from "@/services/api";

interface VersionUpgradeDialogProps {
  children?: React.ReactNode;
}

export function VersionUpgradeDialog({ children }: VersionUpgradeDialogProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedVersion, setSelectedVersion] = useState<string>("");
  const [showInstallDialog, setShowInstallDialog] = useState(false);
  const [availableVersions, setAvailableVersions] = useState<{ value: string; label: string }[]>([]);
  const [isLoadingVersions, setIsLoadingVersions] = useState(false);

  const { startInstall } = useNPMInstall();

  // 获取可用版本列表
  const fetchAvailableVersions = async () => {
    try {
      setIsLoadingVersions(true);
      const response = await apiClient.getAvailableVersions();
      const versions = response.versions.map(version => ({
        value: version,
        label: `v${version}`
      }));
      setAvailableVersions(versions);
    } catch (error) {
      console.error("[VersionUpgradeDialog] 获取版本列表失败:", error);
      // 如果获取失败，使用默认版本列表
      setAvailableVersions([
        { value: "1.7.8", label: "v1.7.8" },
        { value: "1.7.7", label: "v1.7.7" },
      ]);
    } finally {
      setIsLoadingVersions(false);
    }
  };

  // 当对话框打开时获取版本列表
  useEffect(() => {
    if (isOpen) {
      fetchAvailableVersions();
    }
  }, [isOpen]);

  // 处理版本选择
  const handleVersionSelect = (value: string) => {
    setSelectedVersion(value);
  };

  // 处理确认安装
  const handleConfirmInstall = async () => {
    if (!selectedVersion) {
      return;
    }

    try {
      console.log("[VersionUpgradeDialog] 开始安装版本:", selectedVersion);

      // 关闭版本选择对话框
      setIsOpen(false);

      // 显示安装日志对话框
      setShowInstallDialog(true);

      // 开始安装
      await startInstall(selectedVersion);
    } catch (error) {
      console.error("[VersionUpgradeDialog] 安装失败:", error);
      // 如果安装失败，关闭安装日志对话框
      setShowInstallDialog(false);
    }
  };

  // 处理安装对话框关闭
  const handleInstallDialogClose = () => {
    setShowInstallDialog(false);
    setSelectedVersion("");
  };

  // 处理对话框关闭
  const handleDialogClose = (open: boolean) => {
    if (!open) {
      setSelectedVersion("");
    }
    setIsOpen(open);
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={handleDialogClose}>
        <DialogTrigger asChild>
          {children || (
            <Button className="flex items-center gap-2">
              <Download className="h-4 w-4" />
              升级版本
            </Button>
          )}
        </DialogTrigger>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>选择安装版本</DialogTitle>
            <DialogDescription>
              请选择要安装的 xiaozhi-client 版本
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label htmlFor="version-select" className="text-sm font-medium">
                版本选择
              </label>
              <Select
                value={selectedVersion}
                onValueChange={handleVersionSelect}
                disabled={isLoadingVersions}
              >
                <SelectTrigger id="version-select">
                  <SelectValue placeholder={isLoadingVersions ? "正在获取版本列表..." : "请选择版本"} />
                </SelectTrigger>
                <SelectContent>
                  {isLoadingVersions ? (
                    <SelectItem value="loading" disabled>
                      正在获取版本列表...
                    </SelectItem>
                  ) : (
                    availableVersions.map((version) => (
                      <SelectItem key={version.value} value={version.value}>
                        {version.label}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
              {isLoadingVersions && (
                <p className="text-xs text-muted-foreground">正在从 NPM 获取最新版本列表...</p>
              )}
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setIsOpen(false)}>
              取消
            </Button>
            <Button onClick={handleConfirmInstall} disabled={!selectedVersion || isLoadingVersions}>
              {isLoadingVersions ? "获取版本中..." : "确定安装"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* 安装日志对话框 */}
      <InstallLogDialog
        isOpen={showInstallDialog}
        onClose={handleInstallDialogClose}
        version={selectedVersion}
      />
    </>
  );
}

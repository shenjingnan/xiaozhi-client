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
import { apiClient } from "@/services/api";
import { Alert, AlertDescription, AlertTitle } from "@ui/alert";
import { DownloadIcon, ShieldAlertIcon } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import semver from "semver";
import { InstallLogDialog } from "./InstallLogDialog";

interface VersionUpgradeDialogProps {
  children?: React.ReactNode;
  defaultSelectedVersion?: string;
}

// 版本类型选项
const VERSION_TYPES = [
  { value: "stable", label: "正式版" },
  { value: "rc", label: "预览版" },
  { value: "beta", label: "测试版" },
  { value: "all", label: "全部版本" },
] as const;

type VersionType = (typeof VERSION_TYPES)[number]["value"];

export function VersionUpgradeDialog({
  children,
  defaultSelectedVersion,
}: VersionUpgradeDialogProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedVersion, setSelectedVersion] = useState<string>("");
  const [selectedVersionType, setSelectedVersionType] =
    useState<VersionType>("stable");
  const [showInstallDialog, setShowInstallDialog] = useState(false);
  const [availableVersions, setAvailableVersions] = useState<
    { value: string; label: string }[]
  >([]);
  const [isLoadingVersions, setIsLoadingVersions] = useState(false);

  const { startInstall } = useNPMInstall();

  // 获取可用版本列表
  const fetchAvailableVersions = useCallback(
    async (type: VersionType) => {
      try {
        setIsLoadingVersions(true);
        const response = await apiClient.getAvailableVersions(type);
        const versions = response.versions.map((version) => ({
          value: version,
          label: `v${version}`,
        }));
        setAvailableVersions(versions);
        console.log(
          `[VersionUpgradeDialog] 获取到 ${response.total} 个${type}版本`
        );
        if (
          defaultSelectedVersion &&
          response.versions.includes(defaultSelectedVersion || "")
        ) {
          setSelectedVersion(defaultSelectedVersion || "");
        }
      } catch (error) {
        console.error("[VersionUpgradeDialog] 获取版本列表失败:", error);
        // 如果获取失败，使用默认版本列表
        const defaultVersions = [] as { value: string; label: string }[];
        setAvailableVersions(defaultVersions);
      } finally {
        setIsLoadingVersions(false);
      }
    },
    [defaultSelectedVersion]
  );

  // 当对话框打开时获取版本列表
  useEffect(() => {
    if (isOpen) {
      fetchAvailableVersions(selectedVersionType);
    }
  }, [isOpen, selectedVersionType, fetchAvailableVersions]);

  // 处理版本类型选择
  const handleVersionTypeSelect = (value: VersionType) => {
    setSelectedVersionType(value);
    setSelectedVersion(""); // 清空之前选择的版本
  };

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
      setSelectedVersionType("stable"); // 重置为默认选择
    }
    setIsOpen(open);
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={handleDialogClose}>
        <DialogTrigger asChild>
          {children || (
            <Button className="flex items-center gap-2">
              <DownloadIcon className="h-4 w-4" />
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
            {/* 版本选择 */}
            <div className="space-y-2">
              <label htmlFor="version-select" className="text-sm font-medium">
                版本选择
              </label>
              <div className="flex items-center gap-2">
                <Select
                  value={selectedVersionType}
                  onValueChange={handleVersionTypeSelect}
                >
                  <SelectTrigger id="version-type-select" className="w-[150px]">
                    <SelectValue placeholder="请选择版本类型" />
                  </SelectTrigger>
                  <SelectContent>
                    {VERSION_TYPES.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select
                  value={selectedVersion}
                  onValueChange={handleVersionSelect}
                  disabled={isLoadingVersions}
                >
                  <SelectTrigger id="version-select">
                    <SelectValue
                      placeholder={
                        isLoadingVersions ? "正在获取版本列表..." : "请选择版本"
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {isLoadingVersions ? (
                      <SelectItem value="loading" disabled>
                        正在获取版本列表...
                      </SelectItem>
                    ) : availableVersions.length === 0 ? (
                      <SelectItem value="empty" disabled>
                        暂无可用版本
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
              </div>
              {!isLoadingVersions && availableVersions.length === 0 && (
                <p className="text-xs text-muted-foreground">
                  当前版本类型暂无可用版本
                </p>
              )}
              {selectedVersion && semver.lt(selectedVersion, "1.8.0") && (
                <Alert variant="destructive">
                  <ShieldAlertIcon size={18} />
                  <AlertTitle>重要提醒</AlertTitle>
                  <AlertDescription>
                    指定版本低于1.8.0，安装后无法再使用Web界面重装，需手动通过命令操作，请谨慎操作！
                  </AlertDescription>
                </Alert>
              )}
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setIsOpen(false)}>
              取消
            </Button>
            <Button
              onClick={handleConfirmInstall}
              disabled={!selectedVersion || isLoadingVersions}
            >
              确定安装
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

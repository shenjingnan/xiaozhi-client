/**
 * VersionManager 组件 - 版本管理和更新界面
 *
 * 功能：
 * - 显示当前版本信息
 * - 检查可用更新
 * - 提供版本更新功能
 * - 显示实时安装日志
 */

import {
  AlertCircle,
  Calendar,
  CheckCircle,
  Download,
  ExternalLink,
  Package,
  RefreshCw,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { apiClient } from "../services/api";
import { InstallLogDialog } from "./InstallLogDialog";
import { VersionDisplay } from "./VersionDisplay";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "./ui/card";

interface VersionInfo {
  name: string;
  version: string;
  description: string;
  author: string;
}

interface UpdateInfo {
  currentVersion: string;
  latestVersion: string;
  updateAvailable: boolean;
  releaseNotes?: string;
  publishDate?: string;
}

export function VersionManager() {
  const [currentVersion, setCurrentVersion] = useState<VersionInfo | null>(
    null
  );
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showInstallDialog, setShowInstallDialog] = useState(false);
  const [targetVersion, setTargetVersion] = useState<string>("");

  // 加载当前版本信息
  const loadCurrentVersion = useCallback(async () => {
    try {
      setError(null);
      const versionInfo = await apiClient.getVersion();
      setCurrentVersion(versionInfo);
      console.log("[VersionManager] 当前版本信息:", versionInfo);
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "获取版本信息失败";
      setError(errorMessage);
      console.error("[VersionManager] 获取版本信息失败:", err);
    }
  }, []);

  // 检查更新
  const checkForUpdates = async () => {
    if (!currentVersion) return;

    try {
      setIsLoading(true);
      setError(null);

      // 这里可以调用检查更新的 API
      // 暂时模拟一个检查更新的过程
      console.log("[VersionManager] 检查更新...");

      // 模拟 API 调用延迟
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // 模拟更新检查结果
      // 在实际实现中，这里应该调用真实的 API
      const mockUpdateInfo: UpdateInfo = {
        currentVersion: currentVersion.version,
        latestVersion: "1.8.0", // 模拟最新版本
        updateAvailable: true,
        releaseNotes: "• 修复了若干 bug\n• 新增实时日志功能\n• 性能优化",
        publishDate: new Date().toISOString(),
      };

      setUpdateInfo(mockUpdateInfo);
      console.log("[VersionManager] 更新检查结果:", mockUpdateInfo);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "检查更新失败";
      setError(errorMessage);
      console.error("[VersionManager] 检查更新失败:", err);
    } finally {
      setIsLoading(false);
    }
  };

  // 开始更新
  const startUpdate = (version: string) => {
    console.log("[VersionManager] 开始更新到版本:", version);
    setTargetVersion(version);
    setShowInstallDialog(true);
  };

  // 处理安装对话框关闭
  const handleInstallDialogClose = () => {
    setShowInstallDialog(false);
    setTargetVersion("");
    // 重新加载版本信息
    setTimeout(() => {
      loadCurrentVersion();
    }, 1000);
  };

  // 组件初始化时加载版本信息
  useEffect(() => {
    loadCurrentVersion();
  }, [loadCurrentVersion]);

  return (
    <Card className="w-full max-w-2xl">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              版本管理
            </CardTitle>
            <CardDescription>管理应用版本和更新</CardDescription>
          </div>
          <VersionDisplay />
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {error && (
          <div className="flex items-center gap-2 p-3 bg-destructive/10 border border-destructive/20 rounded-md">
            <AlertCircle className="h-4 w-4 text-destructive" />
            <span className="text-sm text-destructive">{error}</span>
          </div>
        )}

        {/* 当前版本信息 */}
        <div className="space-y-3">
          <h3 className="text-lg font-medium">当前版本</h3>
          {currentVersion ? (
            <div className="p-4 bg-muted/50 rounded-md space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-medium">
                  版本 {currentVersion.version}
                </span>
                <Badge variant="secondary">{currentVersion.name}</Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                {currentVersion.description}
              </p>
              <p className="text-xs text-muted-foreground">
                作者: {currentVersion.author}
              </p>
            </div>
          ) : (
            <div className="p-4 bg-muted/50 rounded-md">
              <span className="text-muted-foreground">加载中...</span>
            </div>
          )}
        </div>

        {/* 更新检查 */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-medium">更新检查</h3>
            <Button
              variant="outline"
              size="sm"
              onClick={checkForUpdates}
              disabled={isLoading || !currentVersion}
              className="flex items-center gap-2"
            >
              <RefreshCw
                className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`}
              />
              {isLoading ? "检查中..." : "检查更新"}
            </Button>
          </div>

          {updateInfo && (
            <div className="p-4 border rounded-md space-y-3">
              {updateInfo.updateAvailable ? (
                <>
                  <div className="flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 text-blue-600" />
                    <span className="font-medium text-blue-600">
                      发现新版本 {updateInfo.latestVersion}
                    </span>
                  </div>

                  {updateInfo.publishDate && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Calendar className="h-3 w-3" />
                      发布日期:{" "}
                      {new Date(updateInfo.publishDate).toLocaleDateString()}
                    </div>
                  )}

                  {updateInfo.releaseNotes && (
                    <div className="mt-3">
                      <h4 className="text-sm font-medium mb-2">更新内容:</h4>
                      <div className="text-sm text-muted-foreground whitespace-pre-line bg-muted/30 p-2 rounded">
                        {updateInfo.releaseNotes}
                      </div>
                    </div>
                  )}

                  <div className="flex gap-2 pt-2">
                    <Button
                      onClick={() => startUpdate(updateInfo.latestVersion)}
                      className="flex items-center gap-2"
                    >
                      <Download className="h-4 w-4" />
                      更新到 {updateInfo.latestVersion}
                    </Button>
                    <Button variant="outline" size="sm" asChild>
                      <a
                        href="https://github.com/shenjingnan/xiaozhi-client/releases"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1"
                      >
                        <ExternalLink className="h-3 w-3" />
                        查看详情
                      </a>
                    </Button>
                  </div>
                </>
              ) : (
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  <span className="text-green-600">
                    当前版本 {updateInfo.currentVersion} 是最新版本
                  </span>
                </div>
              )}
            </div>
          )}
        </div>
      </CardContent>

      {/* 安装日志对话框 */}
      <InstallLogDialog
        isOpen={showInstallDialog}
        onClose={handleInstallDialogClose}
        version={targetVersion}
      />
    </Card>
  );
}

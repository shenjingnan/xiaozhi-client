import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  useWebSocketConfig,
  useWebSocketRestartStatus,
} from "../stores/websocket";
import type { AppConfig } from "../types";

interface ConfigEditorWithStoreProps {
  onChange: (config: AppConfig) => void;
  onRestart?: () => void;
}

/**
 * 使用 zustand store 的 ConfigEditor 示例组件
 * 展示如何从 store 获取 config 和 restartStatus，而不需要通过 props 传递
 */
function ConfigEditorWithStore({
  onChange,
  onRestart,
}: ConfigEditorWithStoreProps) {
  // 直接从 store 获取 config 和 restartStatus
  const config = useWebSocketConfig();
  const restartStatus = useWebSocketRestartStatus();

  const [localConfig, setLocalConfig] = useState<AppConfig | null>(config);
  const [isSaving, setIsSaving] = useState(false);
  const [isRestarting, setIsRestarting] = useState(false);

  useEffect(() => {
    setLocalConfig(config);
  }, [config]);

  // 监听重启状态变化
  useEffect(() => {
    if (restartStatus) {
      if (
        restartStatus.status === "completed" ||
        restartStatus.status === "failed"
      ) {
        // 重启完成或失败时，清除 loading 状态
        setIsRestarting(false);
      }
    }
  }, [restartStatus]);

  const handleChange = (field: string, value: any) => {
    if (!localConfig) return;

    const newConfig = { ...localConfig };

    if (field.includes(".")) {
      const [parent, child] = field.split(".");
      (newConfig as any)[parent] = {
        ...(newConfig as any)[parent],
        [child]: value,
      };
    } else {
      (newConfig as any)[field] = value;
    }

    setLocalConfig(newConfig);
  };

  const handleSave = async () => {
    if (!localConfig) return;

    setIsSaving(true);
    try {
      await onChange(localConfig);
      toast.success("配置已保存");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "保存配置时发生错误"
      );
    } finally {
      setIsSaving(false);
    }
  };

  const handleRestart = async () => {
    if (!onRestart) return;

    setIsRestarting(true);
    try {
      await onRestart();
      toast.success("服务重启成功");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "重启服务时发生错误"
      );
      setIsRestarting(false);
    }
  };

  // 如果 config 还没有加载，显示加载状态
  if (!localConfig) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>配置设置 (使用 Store)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <div className="text-muted-foreground">加载配置中...</div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>配置设置 (使用 Store)</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <label
            htmlFor="mcpEndpoint"
            className="block text-sm font-medium mb-2"
          >
            MCP 接入点
          </label>
          <input
            id="mcpEndpoint"
            type="text"
            value={localConfig.mcpEndpoint}
            onChange={(e) => handleChange("mcpEndpoint", e.target.value)}
            className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
            placeholder="wss://api.xiaozhi.me/mcp/?token=..."
          />
        </div>

        <div className="flex gap-2">
          <Button onClick={handleSave} disabled={isSaving} className="flex-1">
            {isSaving ? "保存中..." : "保存配置"}
          </Button>

          {onRestart && (
            <Button
              onClick={handleRestart}
              disabled={isRestarting}
              variant="outline"
              className="flex items-center gap-2"
            >
              <RefreshCw
                className={`h-4 w-4 ${isRestarting ? "animate-spin" : ""}`}
              />
              {isRestarting ? "重启中..." : "重启服务"}
            </Button>
          )}
        </div>

        {restartStatus && (
          <div className="mt-4 p-3 rounded-md bg-muted">
            <div className="text-sm">
              <strong>重启状态:</strong> {restartStatus.status}
              {restartStatus.error && (
                <div className="text-destructive mt-1">
                  错误: {restartStatus.error}
                </div>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default ConfigEditorWithStore;

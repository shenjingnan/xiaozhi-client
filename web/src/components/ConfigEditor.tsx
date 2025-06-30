import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import type { AppConfig } from "../types";

interface ConfigEditorProps {
  config: AppConfig;
  onChange: (config: AppConfig) => void;
}

function ConfigEditor({ config, onChange }: ConfigEditorProps) {
  const [localConfig, setLocalConfig] = useState(config);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setLocalConfig(config);
  }, [config]);

  const handleChange = (field: string, value: any) => {
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

  return (
    <Card>
      <CardHeader>
        <CardTitle>配置设置</CardTitle>
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

        <div>
          <h4 className="text-sm font-medium mb-2">连接配置</h4>
          <div className="space-y-2 pl-4">
            <div>
              <label
                htmlFor="heartbeatInterval"
                className="block text-xs text-muted-foreground"
              >
                心跳间隔 (毫秒)
              </label>
              <input
                id="heartbeatInterval"
                type="number"
                value={localConfig.connection?.heartbeatInterval || 30000}
                onChange={(e) =>
                  handleChange(
                    "connection.heartbeatInterval",
                    Number(e.target.value)
                  )
                }
                className="w-full px-3 py-1 border rounded-md text-sm"
              />
            </div>

            <div>
              <label
                htmlFor="heartbeatTimeout"
                className="block text-xs text-muted-foreground"
              >
                心跳超时 (毫秒)
              </label>
              <input
                id="heartbeatTimeout"
                type="number"
                value={localConfig.connection?.heartbeatTimeout || 10000}
                onChange={(e) =>
                  handleChange(
                    "connection.heartbeatTimeout",
                    Number(e.target.value)
                  )
                }
                className="w-full px-3 py-1 border rounded-md text-sm"
              />
            </div>

            <div>
              <label
                htmlFor="reconnectInterval"
                className="block text-xs text-muted-foreground"
              >
                重连间隔 (毫秒)
              </label>
              <input
                id="reconnectInterval"
                type="number"
                value={localConfig.connection?.reconnectInterval || 5000}
                onChange={(e) =>
                  handleChange(
                    "connection.reconnectInterval",
                    Number(e.target.value)
                  )
                }
                className="w-full px-3 py-1 border rounded-md text-sm"
              />
            </div>
          </div>
        </div>

        {localConfig.modelscope && (
          <div>
            <label
              htmlFor="modelScopeApiKey"
              className="block text-sm font-medium mb-2"
            >
              ModelScope API Key
            </label>
            <input
              id="modelScopeApiKey"
              type="password"
              value={localConfig.modelscope.apiKey || ""}
              onChange={(e) =>
                handleChange("modelscope.apiKey", e.target.value)
              }
              className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
              placeholder="输入您的 API 密钥"
            />
          </div>
        )}

        <Button
          type="button"
          onClick={handleSave}
          className="w-full"
          disabled={isSaving}
        >
          {isSaving ? "保存中..." : "保存配置"}
        </Button>
      </CardContent>
    </Card>
  );
}

export default ConfigEditor;

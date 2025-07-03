import { AlertCircle, CheckCircle2, Settings } from "lucide-react";
import { useState } from "react";
import { Button } from "./ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";

interface ConnectionSettingsProps {
  wsUrl: string;
  connected: boolean;
  onUrlChange: (url: string) => void;
}

export function ConnectionSettings({
  wsUrl,
  connected,
  onUrlChange,
}: ConnectionSettingsProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [customUrl, setCustomUrl] = useState(wsUrl);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const handleSave = () => {
    onUrlChange(customUrl);
    setIsEditing(false);
  };

  const handleReset = () => {
    setCustomUrl("");
    onUrlChange("");
    setIsEditing(false);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span className="flex items-center gap-2">
            连接状态
            {connected ? (
              <CheckCircle2 className="h-5 w-5 text-green-500" />
            ) : (
              <AlertCircle className="h-5 w-5 text-red-500" />
            )}
          </span>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowAdvanced(!showAdvanced)}
          >
            <Settings className="h-4 w-4" />
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">服务器地址：</span>
          <span className="text-sm font-mono">{wsUrl}</span>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">连接状态：</span>
          <span
            className={`text-sm font-medium ${connected ? "text-green-600" : "text-red-600"}`}
          >
            {connected ? "已连接" : "未连接"}
          </span>
        </div>

        {showAdvanced && (
          <div className="border-t pt-4 space-y-4">
            <h4 className="text-sm font-medium">高级设置</h4>

            {!isEditing ? (
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">
                  当前使用自动检测的服务器地址。如果需要连接到其他服务器，可以手动配置。
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setIsEditing(true);
                    const savedUrl = localStorage.getItem("xiaozhi-ws-url");
                    if (savedUrl) {
                      setCustomUrl(savedUrl);
                    }
                  }}
                >
                  配置服务器地址
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                <div>
                  <label htmlFor="ws-url-input" className="text-sm font-medium">
                    WebSocket 服务器地址
                  </label>
                  <input
                    id="ws-url-input"
                    type="text"
                    value={customUrl}
                    onChange={(e) => setCustomUrl(e.target.value)}
                    placeholder="ws://192.168.1.100:9999"
                    className="mt-1 w-full px-3 py-2 border rounded-md text-sm"
                  />
                  <p className="mt-1 text-xs text-muted-foreground">
                    格式: ws://[IP地址或域名]:[端口号]
                  </p>
                </div>

                <div className="flex gap-2">
                  <Button size="sm" onClick={handleSave}>
                    保存
                  </Button>
                  <Button size="sm" variant="outline" onClick={handleReset}>
                    重置为自动
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setIsEditing(false)}
                  >
                    取消
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

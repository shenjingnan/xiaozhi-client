/**
 * 端口切换功能测试页面
 */

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { WebUrlSettingButton } from "@/components/WebUrlSettingButton";
import { useWebSocket } from "@/hooks/useWebSocket";
import {
  useWebSocketConnected,
  useWebSocketConfig,
  useWebSocketPortChangeStatus,
  useWebSocketUrl,
} from "@/stores/websocket";
import { checkPortAvailability } from "@/utils/portUtils";
import { useState } from "react";

export function PortTestPage() {
  const [testPort, setTestPort] = useState(8848);
  const [testResult, setTestResult] = useState<string>("");
  const [isTestingPort, setIsTestingPort] = useState(false);

  const connected = useWebSocketConnected();
  const config = useWebSocketConfig();
  const portChangeStatus = useWebSocketPortChangeStatus();
  const wsUrl = useWebSocketUrl();
  const { refreshStatus } = useWebSocket();

  const handleTestPort = async () => {
    setIsTestingPort(true);
    setTestResult("正在检测端口...");

    try {
      const isAvailable = await checkPortAvailability(testPort);
      setTestResult(
        isAvailable
          ? `✅ 端口 ${testPort} 可用`
          : `❌ 端口 ${testPort} 不可用`
      );
    } catch (error) {
      setTestResult(
        `❌ 检测失败: ${error instanceof Error ? error.message : "未知错误"}`
      );
    } finally {
      setIsTestingPort(false);
    }
  };

  const getPortChangeStatusText = () => {
    if (!portChangeStatus) return "无";

    const { status, targetPort, currentAttempt, maxAttempts, error } =
      portChangeStatus;

    switch (status) {
      case "idle":
        return "空闲";
      case "checking":
        return `检测端口 ${targetPort}...`;
      case "polling":
        return `等待服务重启 (${currentAttempt}/${maxAttempts})`;
      case "connecting":
        return `连接到端口 ${targetPort}...`;
      case "completed":
        return `✅ 成功切换到端口 ${targetPort}`;
      case "failed":
        return `❌ 切换失败: ${error}`;
      default:
        return status;
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <h1 className="text-3xl font-bold">端口切换功能测试</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* 当前状态 */}
        <Card>
          <CardHeader>
            <CardTitle>当前状态</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <strong>连接状态:</strong>{" "}
              <span className={connected ? "text-green-600" : "text-red-600"}>
                {connected ? "已连接" : "未连接"}
              </span>
            </div>
            <div>
              <strong>WebSocket URL:</strong> {wsUrl || "未设置"}
            </div>
            <div>
              <strong>配置端口:</strong> {config?.webUI?.port || "未设置"}
            </div>
            <div>
              <strong>端口切换状态:</strong> {getPortChangeStatusText()}
            </div>
            <Button onClick={refreshStatus} variant="outline" size="sm">
              刷新状态
            </Button>
          </CardContent>
        </Card>

        {/* 端口测试 */}
        <Card>
          <CardHeader>
            <CardTitle>端口连通性测试</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center space-x-2">
              <input
                type="number"
                value={testPort}
                onChange={(e) => setTestPort(Number(e.target.value))}
                className="border rounded px-3 py-2 w-24"
                min="1"
                max="65535"
              />
              <Button
                onClick={handleTestPort}
                disabled={isTestingPort}
                size="sm"
              >
                {isTestingPort ? "检测中..." : "测试端口"}
              </Button>
            </div>
            <div className="text-sm text-gray-600">{testResult}</div>
          </CardContent>
        </Card>

        {/* 端口设置 */}
        <Card>
          <CardHeader>
            <CardTitle>端口设置</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center space-x-4">
              <span>点击设置按钮修改端口:</span>
              <WebUrlSettingButton />
            </div>
            <div className="mt-4 text-sm text-gray-600">
              <p>
                <strong>场景1 (未连接):</strong>{" "}
                系统会检测新端口是否可用，如果可用则直接连接。
              </p>
              <p>
                <strong>场景2 (已连接):</strong>{" "}
                系统会更新配置、重启服务，然后轮询检测新端口并重新连接。
              </p>
            </div>
          </CardContent>
        </Card>

        {/* 调试信息 */}
        <Card>
          <CardHeader>
            <CardTitle>调试信息</CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="text-xs bg-gray-100 p-3 rounded overflow-auto">
              {JSON.stringify(
                {
                  connected,
                  wsUrl,
                  config: config?.webUI,
                  portChangeStatus,
                },
                null,
                2
              )}
            </pre>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

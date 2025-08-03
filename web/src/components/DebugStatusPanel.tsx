import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useState } from "react";
import { useWebSocket } from "../hooks/useWebSocket";
import {
  useWebSocketConnected,
  useWebSocketStatus,
  useWebSocketStore,
} from "../stores/websocket";

/**
 * 调试面板组件，用于诊断状态同步问题
 */
function DebugStatusPanel() {
  // 从 useWebSocket hook 获取状态
  const webSocketState = useWebSocket();

  // 从 store 获取状态
  const storeConnected = useWebSocketConnected();
  const storeStatus = useWebSocketStatus();
  const fullStore = useWebSocketStore();

  // 手动刷新状态
  const handleRefreshStatus = () => {
    console.log("[Debug] 手动刷新状态");
    webSocketState.refreshStatus();
  };

  // 强制重新渲染以查看最新状态
  const [, forceUpdate] = useState({});
  const handleForceUpdate = () => {
    console.log("[Debug] 强制重新渲染");
    forceUpdate({});
  };

  return (
    <Card className="border-yellow-200 bg-yellow-50 dark:bg-yellow-950 dark:border-yellow-800">
      <CardHeader>
        <CardTitle className="text-yellow-800 dark:text-yellow-200">
          🐛 调试状态面板
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* WebSocket Hook 状态 */}
        <div>
          <h4 className="font-semibold text-sm mb-2">
            useWebSocket Hook 状态:
          </h4>
          <div className="bg-white dark:bg-gray-800 p-3 rounded text-xs font-mono">
            <div>connected: {JSON.stringify(webSocketState.connected)}</div>
            <div>status: {JSON.stringify(webSocketState.status, null, 2)}</div>
            <div>wsUrl: {webSocketState.wsUrl}</div>
          </div>
        </div>

        {/* Store 状态 */}
        <div>
          <h4 className="font-semibold text-sm mb-2">Zustand Store 状态:</h4>
          <div className="bg-white dark:bg-gray-800 p-3 rounded text-xs font-mono">
            <div>connected: {JSON.stringify(storeConnected)}</div>
            <div>status: {JSON.stringify(storeStatus, null, 2)}</div>
            <div>wsUrl: {fullStore.wsUrl}</div>
          </div>
        </div>

        {/* 状态对比 */}
        <div>
          <h4 className="font-semibold text-sm mb-2">状态对比:</h4>
          <div className="bg-white dark:bg-gray-800 p-3 rounded text-xs">
            <div
              className={`p-2 rounded ${
                webSocketState.connected === storeConnected
                  ? "bg-green-100 text-green-800"
                  : "bg-red-100 text-red-800"
              }`}
            >
              Connected 同步:{" "}
              {webSocketState.connected === storeConnected ? "✅" : "❌"}
              <br />
              Hook: {JSON.stringify(webSocketState.connected)} | Store:{" "}
              {JSON.stringify(storeConnected)}
            </div>

            <div
              className={`p-2 rounded mt-2 ${
                JSON.stringify(webSocketState.status) ===
                JSON.stringify(storeStatus)
                  ? "bg-green-100 text-green-800"
                  : "bg-red-100 text-red-800"
              }`}
            >
              Status 同步:{" "}
              {JSON.stringify(webSocketState.status) ===
              JSON.stringify(storeStatus)
                ? "✅"
                : "❌"}
              <br />
              Hook status: {webSocketState.status?.status || "null"}
              <br />
              Store status: {storeStatus?.status || "null"}
            </div>
          </div>
        </div>

        {/* 实时时间戳 */}
        <div>
          <h4 className="font-semibold text-sm mb-2">实时更新:</h4>
          <div className="bg-white dark:bg-gray-800 p-3 rounded text-xs font-mono">
            <div>当前时间: {new Date().toLocaleTimeString()}</div>
            <div>
              最后心跳:{" "}
              {webSocketState.status?.lastHeartbeat
                ? new Date(
                    webSocketState.status.lastHeartbeat
                  ).toLocaleTimeString()
                : "N/A"}
            </div>
          </div>
        </div>

        {/* 调试操作 */}
        <div>
          <h4 className="font-semibold text-sm mb-2">调试操作:</h4>
          <div className="space-y-2">
            <Button
              onClick={handleRefreshStatus}
              size="sm"
              variant="outline"
              className="w-full"
            >
              手动刷新状态
            </Button>
            <Button
              onClick={handleForceUpdate}
              size="sm"
              variant="outline"
              className="w-full"
            >
              强制重新渲染
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default DebugStatusPanel;

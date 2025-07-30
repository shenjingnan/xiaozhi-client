import { useRef, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useWebSocket } from "../hooks/useWebSocket";
import {
  useWebSocketConnected,
  useWebSocketStatus,
  useWebSocketActions,
  useWebSocketConnectionInfo,
  useWebSocketData
} from "../stores/websocket";

/**
 * 渲染次数测试组件 - 用于检测无限循环问题
 */
function RenderCountTest() {
  // 渲染计数器
  const renderCount = useRef(0);
  const lastRenderTime = useRef(Date.now());
  
  // 各种 hook 的渲染计数
  const useWebSocketRenderCount = useRef(0);
  const useWebSocketConnectedRenderCount = useRef(0);
  const useWebSocketStatusRenderCount = useRef(0);
  const useWebSocketActionsRenderCount = useRef(0);
  const useWebSocketConnectionInfoRenderCount = useRef(0);
  const useWebSocketDataRenderCount = useRef(0);

  // 调用各种 hooks
  const webSocketState = useWebSocket();
  const connected = useWebSocketConnected();
  const status = useWebSocketStatus();
  const actions = useWebSocketActions();
  const connectionInfo = useWebSocketConnectionInfo();
  const data = useWebSocketData();

  // 更新渲染计数
  renderCount.current += 1;
  useWebSocketRenderCount.current += 1;
  useWebSocketConnectedRenderCount.current += 1;
  useWebSocketStatusRenderCount.current += 1;
  useWebSocketActionsRenderCount.current += 1;
  useWebSocketConnectionInfoRenderCount.current += 1;
  useWebSocketDataRenderCount.current += 1;

  const currentTime = Date.now();
  const timeSinceLastRender = currentTime - lastRenderTime.current;
  lastRenderTime.current = currentTime;

  // 检测快速重渲染（可能的无限循环）
  const isRapidRerender = timeSinceLastRender < 100; // 100ms 内的重渲染认为是快速重渲染
  
  useEffect(() => {
    if (renderCount.current > 10 && isRapidRerender) {
      console.warn("⚠️ 检测到可能的无限循环：组件在短时间内多次重渲染");
    }
  }, [isRapidRerender]);

  // 重置计数器
  const resetCounters = () => {
    renderCount.current = 0;
    useWebSocketRenderCount.current = 0;
    useWebSocketConnectedRenderCount.current = 0;
    useWebSocketStatusRenderCount.current = 0;
    useWebSocketActionsRenderCount.current = 0;
    useWebSocketConnectionInfoRenderCount.current = 0;
    useWebSocketDataRenderCount.current = 0;
  };

  return (
    <Card className="border-purple-200 bg-purple-50 dark:bg-purple-950 dark:border-purple-800">
      <CardHeader>
        <CardTitle className="text-purple-800 dark:text-purple-200">
          🔄 渲染次数监控
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* 总体渲染信息 */}
        <div>
          <h4 className="font-semibold text-sm mb-2">总体渲染信息:</h4>
          <div className="bg-white dark:bg-gray-800 p-3 rounded text-xs space-y-1">
            <div className={`p-2 rounded ${
              renderCount.current > 20 
                ? 'bg-red-100 text-red-800' 
                : renderCount.current > 10 
                ? 'bg-yellow-100 text-yellow-800'
                : 'bg-green-100 text-green-800'
            }`}>
              总渲染次数: {renderCount.current}
            </div>
            
            <div className={`p-2 rounded ${
              isRapidRerender 
                ? 'bg-red-100 text-red-800' 
                : 'bg-green-100 text-green-800'
            }`}>
              距离上次渲染: {timeSinceLastRender}ms
              {isRapidRerender && " ⚠️ 快速重渲染"}
            </div>
          </div>
        </div>

        {/* Hook 渲染计数 */}
        <div>
          <h4 className="font-semibold text-sm mb-2">各 Hook 渲染次数:</h4>
          <div className="bg-white dark:bg-gray-800 p-3 rounded text-xs space-y-1">
            <div>useWebSocket: {useWebSocketRenderCount.current}</div>
            <div>useWebSocketConnected: {useWebSocketConnectedRenderCount.current}</div>
            <div>useWebSocketStatus: {useWebSocketStatusRenderCount.current}</div>
            <div>useWebSocketActions: {useWebSocketActionsRenderCount.current}</div>
            <div>useWebSocketConnectionInfo: {useWebSocketConnectionInfoRenderCount.current}</div>
            <div>useWebSocketData: {useWebSocketDataRenderCount.current}</div>
          </div>
        </div>

        {/* Hook 返回值稳定性检查 */}
        <div>
          <h4 className="font-semibold text-sm mb-2">Hook 返回值稳定性:</h4>
          <div className="bg-white dark:bg-gray-800 p-3 rounded text-xs space-y-1">
            <div>actions 对象引用: {typeof actions === 'object' ? '✅ 对象' : '❌ 非对象'}</div>
            <div>connectionInfo 对象引用: {typeof connectionInfo === 'object' ? '✅ 对象' : '❌ 非对象'}</div>
            <div>data 对象引用: {typeof data === 'object' ? '✅ 对象' : '❌ 非对象'}</div>
          </div>
        </div>

        {/* 当前状态快照 */}
        <div>
          <h4 className="font-semibold text-sm mb-2">当前状态快照:</h4>
          <div className="bg-white dark:bg-gray-800 p-3 rounded text-xs space-y-1">
            <div>连接状态: {String(connected)}</div>
            <div>状态: {status?.status || 'null'}</div>
            <div>WebSocket URL: {connectionInfo.wsUrl || 'empty'}</div>
            <div>配置: {data.config ? '已加载' : '未加载'}</div>
          </div>
        </div>

        {/* 控制按钮 */}
        <div className="flex gap-2">
          <button
            onClick={resetCounters}
            className="px-3 py-1 bg-purple-600 text-white rounded text-xs hover:bg-purple-700"
          >
            重置计数器
          </button>
          <button
            onClick={() => window.location.reload()}
            className="px-3 py-1 bg-gray-600 text-white rounded text-xs hover:bg-gray-700"
          >
            刷新页面测试
          </button>
        </div>
      </CardContent>
    </Card>
  );
}

export default RenderCountTest;

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useWebSocket } from "../hooks/useWebSocket";
import {
  useWebSocketConnected,
  useWebSocketStatus,
  useWebSocketStore
} from "../stores/websocket";

/**
 * WebSocket 状态同步测试组件
 */
function WebSocketSyncTest() {
  const [testResults, setTestResults] = useState<string[]>([]);
  
  // 从 useWebSocket hook 获取状态
  const webSocketState = useWebSocket();
  
  // 从 store 获取状态
  const storeConnected = useWebSocketConnected();
  const storeStatus = useWebSocketStatus();
  const fullStore = useWebSocketStore();

  // 添加测试结果
  const addTestResult = (result: string) => {
    setTestResults(prev => [...prev.slice(-9), `${new Date().toLocaleTimeString()}: ${result}`]);
  };

  // 运行同步测试
  const runSyncTest = () => {
    addTestResult("开始同步测试...");
    
    // 测试连接状态同步
    const hookConnected = webSocketState.connected;
    const storeConnectedValue = storeConnected;
    
    if (hookConnected === storeConnectedValue) {
      addTestResult(`✅ 连接状态同步正常: ${hookConnected}`);
    } else {
      addTestResult(`❌ 连接状态不同步: Hook=${hookConnected}, Store=${storeConnectedValue}`);
    }
    
    // 测试状态对象同步
    const hookStatus = webSocketState.status;
    const storeStatusValue = storeStatus;
    
    if (JSON.stringify(hookStatus) === JSON.stringify(storeStatusValue)) {
      addTestResult(`✅ 状态对象同步正常`);
    } else {
      addTestResult(`❌ 状态对象不同步`);
      addTestResult(`Hook status: ${hookStatus?.status || 'null'}`);
      addTestResult(`Store status: ${storeStatusValue?.status || 'null'}`);
    }
    
    // 测试 URL 同步
    const hookUrl = webSocketState.wsUrl;
    const storeUrl = fullStore.wsUrl;
    
    if (hookUrl === storeUrl) {
      addTestResult(`✅ URL 同步正常: ${hookUrl}`);
    } else {
      addTestResult(`❌ URL 不同步: Hook=${hookUrl}, Store=${storeUrl}`);
    }
  };

  // 自动运行测试
  useEffect(() => {
    const interval = setInterval(() => {
      runSyncTest();
    }, 5000);
    
    // 立即运行一次
    runSyncTest();
    
    return () => clearInterval(interval);
  }, [webSocketState.connected, webSocketState.status, webSocketState.wsUrl, storeConnected, storeStatus, fullStore.wsUrl]);

  return (
    <Card className="border-blue-200 bg-blue-50 dark:bg-blue-950 dark:border-blue-800">
      <CardHeader>
        <CardTitle className="text-blue-800 dark:text-blue-200">
          🧪 WebSocket 状态同步测试
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* 当前状态对比 */}
        <div>
          <h4 className="font-semibold text-sm mb-2">当前状态对比:</h4>
          <div className="bg-white dark:bg-gray-800 p-3 rounded text-xs space-y-1">
            <div className={`p-2 rounded ${
              webSocketState.connected === storeConnected
                ? 'bg-green-100 text-green-800'
                : 'bg-red-100 text-red-800'
            }`}>
              连接状态: Hook={String(webSocketState.connected)} | Store={String(storeConnected)}
            </div>
            
            <div className={`p-2 rounded ${
              JSON.stringify(webSocketState.status) === JSON.stringify(storeStatus)
                ? 'bg-green-100 text-green-800'
                : 'bg-red-100 text-red-800'
            }`}>
              状态对象: Hook={webSocketState.status?.status || 'null'} | Store={storeStatus?.status || 'null'}
            </div>
            
            <div className={`p-2 rounded ${
              webSocketState.wsUrl === fullStore.wsUrl
                ? 'bg-green-100 text-green-800'
                : 'bg-red-100 text-red-800'
            }`}>
              WebSocket URL: {webSocketState.wsUrl === fullStore.wsUrl ? '同步' : '不同步'}
            </div>
          </div>
        </div>

        {/* 测试结果日志 */}
        <div>
          <h4 className="font-semibold text-sm mb-2">测试结果日志:</h4>
          <div className="bg-white dark:bg-gray-800 p-3 rounded text-xs font-mono max-h-40 overflow-y-auto">
            {testResults.length === 0 ? (
              <div className="text-gray-500">等待测试结果...</div>
            ) : (
              testResults.map((result, index) => (
                <div key={index} className="mb-1">
                  {result}
                </div>
              ))
            )}
          </div>
        </div>

        {/* 手动测试按钮 */}
        <div>
          <Button
            onClick={runSyncTest}
            size="sm"
            variant="outline"
            className="w-full"
          >
            手动运行同步测试
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export default WebSocketSyncTest;

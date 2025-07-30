import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useWebSocketStore } from "../stores/websocket";

/**
 * 状态同步测试组件
 * 用于测试 store 状态更新是否能正确触发组件重新渲染
 */
function StatusSyncTest() {
  const store = useWebSocketStore();

  // 模拟服务端发送 connected 状态
  const simulateConnected = () => {
    console.log("[Test] 模拟设置 connected = true");
    store.setConnected(true);
    
    // 模拟服务端发送状态数据
    setTimeout(() => {
      console.log("[Test] 模拟发送 status 数据");
      store.setStatus({
        status: "connected",
        mcpEndpoint: "ws://localhost:9999",
        activeMCPServers: ["test-server"],
        lastHeartbeat: Date.now()
      });
    }, 1000);
  };

  // 模拟服务端发送 disconnected 状态
  const simulateDisconnected = () => {
    console.log("[Test] 模拟设置 connected = false");
    store.setConnected(false);
    store.setStatus({
      status: "disconnected",
      mcpEndpoint: "ws://localhost:9999",
      activeMCPServers: [],
      lastHeartbeat: Date.now()
    });
  };

  // 重置状态
  const resetState = () => {
    console.log("[Test] 重置状态");
    store.reset();
  };

  return (
    <Card className="border-blue-200 bg-blue-50 dark:bg-blue-950 dark:border-blue-800">
      <CardHeader>
        <CardTitle className="text-blue-800 dark:text-blue-200">
          🧪 状态同步测试
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="text-sm text-muted-foreground">
          使用这些按钮来测试状态同步是否正常工作：
        </div>
        
        <div className="grid grid-cols-1 gap-2">
          <Button 
            onClick={simulateConnected}
            variant="default"
            size="sm"
          >
            模拟连接成功
          </Button>
          
          <Button 
            onClick={simulateDisconnected}
            variant="secondary"
            size="sm"
          >
            模拟连接断开
          </Button>
          
          <Button 
            onClick={resetState}
            variant="outline"
            size="sm"
          >
            重置状态
          </Button>
        </div>

        <div className="text-xs text-muted-foreground">
          点击按钮后，观察 StatusCardWithStore 组件是否正确更新显示状态。
        </div>
      </CardContent>
    </Card>
  );
}

export default StatusSyncTest;

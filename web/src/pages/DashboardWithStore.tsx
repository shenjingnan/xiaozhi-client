import ConfigEditorWithStore from "../components/ConfigEditorWithStore";
import { ConnectionSettings } from "../components/ConnectionSettings";
import DebugStatusPanel from "../components/DebugStatusPanel";
import MCPServerList from "../components/MCPServerList";
import RenderCountTest from "../components/RenderCountTest";
import { RestartNotification } from "../components/RestartNotification";
import StatusCardWithStore from "../components/StatusCardWithStore";
import WebSocketSyncTest from "../components/WebSocketSyncTest";
import { useWebSocket } from "../hooks/useWebSocket";
import {
  useWebSocketConfig,
  useWebSocketConnectionInfo,
  useWebSocketRestartStatus,
} from "../stores/websocket";

/**
 * 使用 zustand store 的 Dashboard 示例页面
 * 展示如何混合使用 useWebSocket hook 和 zustand store
 */
function DashboardWithStore() {
  // 仍然需要 useWebSocket 来维持 WebSocket 连接和提供操作方法
  const { updateConfig, restartService, setCustomWsUrl } = useWebSocket();

  // 从 store 获取状态数据，避免 props 传递
  const config = useWebSocketConfig();
  const { connected, wsUrl } = useWebSocketConnectionInfo();
  const restartStatus = useWebSocketRestartStatus();

  return (
    <div className="container mx-auto px-4 py-8">
      <header className="mb-8">
        <h1 className="text-3xl font-bold">小智配置管理 (使用 Store)</h1>
        <p className="text-muted-foreground mt-2">
          展示如何使用 zustand store 管理 WebSocket 数据，避免 props 层层传递
        </p>
      </header>

      <RestartNotification restartStatus={restartStatus} />

      {/* 调试面板 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <DebugStatusPanel />
        <WebSocketSyncTest />
      </div>

      {/* 渲染监控面板 */}
      <div className="mb-6">
        <RenderCountTest />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        {/* 使用 store 的 StatusCard，不需要传递 props */}
        <StatusCardWithStore />

        <div className="lg:col-span-2">
          <ConnectionSettings
            wsUrl={wsUrl}
            connected={connected}
            onUrlChange={setCustomWsUrl}
          />
        </div>
      </div>

      {config && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <MCPServerList
            servers={config.mcpServers}
            serverConfig={config.mcpServerConfig}
            onChange={(servers, serverConfig) => {
              updateConfig({
                ...config,
                mcpServers: servers,
                mcpServerConfig: serverConfig,
              });
            }}
          />

          {/* 使用 store 的 ConfigEditor，只需要传递操作方法 */}
          <ConfigEditorWithStore
            onChange={updateConfig}
            onRestart={restartService}
          />
        </div>
      )}

      <div className="mt-8 p-4 bg-muted rounded-lg">
        <h3 className="text-lg font-semibold mb-2">使用说明</h3>
        <div className="text-sm text-muted-foreground space-y-2">
          <p>
            • <strong>StatusCardWithStore</strong>: 直接从 store 获取 connected
            和 status，无需 props
          </p>
          <p>
            • <strong>ConfigEditorWithStore</strong>: 从 store 获取 config 和
            restartStatus，只需传递操作方法
          </p>
          <p>
            • <strong>ConnectionSettings</strong>: 仍使用
            props，因为它需要的数据较少且逻辑简单
          </p>
          <p>
            • <strong>MCPServerList</strong>: 仍使用
            props，因为它有复杂的本地状态管理
          </p>
        </div>
      </div>
    </div>
  );
}

export default DashboardWithStore;

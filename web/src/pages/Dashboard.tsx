import ConfigEditor from "../components/ConfigEditor";
import MCPServerList from "../components/MCPServerList";
import StatusCard from "../components/StatusCard";
import { useWebSocket } from "../hooks/useWebSocket";

function Dashboard() {
  const { connected, config, status, updateConfig } = useWebSocket();

  return (
    <div className="container mx-auto px-4 py-8">
      <header className="mb-8">
        <h1 className="text-3xl font-bold">小智配置管理</h1>
        <p className="text-muted-foreground mt-2">
          管理您的小智 AI 客户端配置和 MCP 服务
        </p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        <StatusCard connected={connected} status={status} />
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

          <ConfigEditor config={config} onChange={updateConfig} />
        </div>
      )}
    </div>
  );
}

export default Dashboard;

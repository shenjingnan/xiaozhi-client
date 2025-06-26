import React from "react";
import type { ClientStatus } from "../types";

interface StatusCardProps {
  connected: boolean;
  status: ClientStatus | null;
}

function StatusCard({ connected, status }: StatusCardProps) {
  const getStatusColor = () => {
    if (!connected) return "bg-gray-100 text-gray-800";
    if (status?.status === "connected") return "bg-green-100 text-green-800";
    return "bg-red-100 text-red-800";
  };

  const getStatusText = () => {
    if (!connected) return "未连接到配置服务器";
    if (status?.status === "connected") return "已连接";
    return "未连接到小智服务";
  };

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h3 className="text-lg font-medium mb-4">连接状态</h3>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-600">配置服务器</span>
          <span
            className={`px-2 py-1 rounded-full text-xs font-medium ${connected ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}`}
          >
            {connected ? "已连接" : "未连接"}
          </span>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-600">小智服务</span>
          <span
            className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor()}`}
          >
            {getStatusText()}
          </span>
        </div>

        {status?.mcpEndpoint && (
          <div className="pt-3 border-t">
            <p className="text-xs text-gray-500">接入点</p>
            <p className="text-sm font-mono break-all">{status.mcpEndpoint}</p>
          </div>
        )}

        {status?.activeMCPServers && status.activeMCPServers.length > 0 && (
          <div className="pt-3 border-t">
            <p className="text-xs text-gray-500 mb-1">活跃 MCP 服务</p>
            <div className="flex flex-wrap gap-1">
              {status.activeMCPServers.map((server) => (
                <span
                  key={server}
                  className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded"
                >
                  {server}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default StatusCard;

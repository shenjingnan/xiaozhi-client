import { useState } from "react";
import type { MCPServerConfig, MCPServerToolsConfig } from "../types";

interface MCPServerListProps {
  servers: Record<string, MCPServerConfig>;
  serverConfig?: Record<string, MCPServerToolsConfig>;
  onChange: (
    servers: Record<string, MCPServerConfig>,
    serverConfig?: Record<string, MCPServerToolsConfig>
  ) => void;
}

function MCPServerList({
  servers,
  serverConfig,
  onChange,
}: MCPServerListProps) {
  const [editingServer, setEditingServer] = useState<string | null>(null);
  const [newServerName, setNewServerName] = useState("");
  const [showAddForm, setShowAddForm] = useState(false);

  const isSSEServer = (
    config: MCPServerConfig
  ): config is { type: "sse"; url: string } => {
    return "type" in config && config.type === "sse";
  };

  const handleDeleteServer = (name: string) => {
    const newServers = { ...servers };
    delete newServers[name];

    const newServerConfig = serverConfig ? { ...serverConfig } : undefined;
    if (newServerConfig && name in newServerConfig) {
      delete newServerConfig[name];
    }

    onChange(newServers, newServerConfig);
  };

  const handleAddServer = () => {
    if (newServerName && !servers[newServerName]) {
      const newServers = {
        ...servers,
        [newServerName]: {
          command: "node",
          args: ["./mcpServers/example.js"],
        },
      };
      onChange(newServers, serverConfig);
      setNewServerName("");
      setShowAddForm(false);
      setEditingServer(newServerName);
    }
  };

  const handleUpdateServer = (name: string, config: MCPServerConfig) => {
    onChange(
      {
        ...servers,
        [name]: config,
      },
      serverConfig
    );
  };

  const renderServerEditor = (name: string, config: MCPServerConfig) => {
    if (isSSEServer(config)) {
      return (
        <div className="mt-2 space-y-2">
          <input
            type="text"
            value={config.url}
            onChange={(e) =>
              handleUpdateServer(name, { type: "sse", url: e.target.value })
            }
            className="w-full px-3 py-1 border border-gray-300 rounded text-sm"
            placeholder="SSE URL"
          />
        </div>
      );
    }

    return (
      <div className="mt-2 space-y-2">
        <input
          type="text"
          value={config.command}
          onChange={(e) =>
            handleUpdateServer(name, { ...config, command: e.target.value })
          }
          className="w-full px-3 py-1 border border-gray-300 rounded text-sm"
          placeholder="命令"
        />
        <input
          type="text"
          value={config.args.join(" ")}
          onChange={(e) =>
            handleUpdateServer(name, {
              ...config,
              args: e.target.value.split(" ").filter((arg) => arg),
            })
          }
          className="w-full px-3 py-1 border border-gray-300 rounded text-sm"
          placeholder="参数"
        />
      </div>
    );
  };

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="space-y-4">
        {Object.entries(servers).map(([name, config]) => (
          <div key={name} className="border rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <h4 className="font-medium">{name}</h4>
                <span className="text-xs px-2 py-1 bg-gray-100 rounded">
                  {isSSEServer(config) ? "SSE" : "Local"}
                </span>
              </div>
              <div className="flex space-x-2">
                <button
                  type="button"
                  onClick={() =>
                    setEditingServer(editingServer === name ? null : name)
                  }
                  className="text-sm text-blue-600 hover:text-blue-800"
                >
                  {editingServer === name ? "完成" : "编辑"}
                </button>
                <button
                  type="button"
                  onClick={() => handleDeleteServer(name)}
                  className="text-sm text-red-600 hover:text-red-800"
                >
                  删除
                </button>
              </div>
            </div>

            {editingServer === name && renderServerEditor(name, config)}

            {!editingServer && (
              <div className="mt-2 text-sm text-gray-600">
                {isSSEServer(config) ? (
                  <span>URL: {config.url}</span>
                ) : (
                  <span>
                    {config.command} {config.args.join(" ")}
                  </span>
                )}
              </div>
            )}
          </div>
        ))}

        {showAddForm ? (
          <div className="border rounded-lg p-4 bg-gray-50">
            <div className="flex space-x-2">
              <input
                type="text"
                value={newServerName}
                onChange={(e) => setNewServerName(e.target.value)}
                placeholder="服务名称"
                className="flex-1 px-3 py-2 border border-gray-300 rounded"
                onKeyPress={(e) => e.key === "Enter" && handleAddServer()}
              />
              <button
                type="button"
                onClick={handleAddServer}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                添加
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowAddForm(false);
                  setNewServerName("");
                }}
                className="px-4 py-2 bg-gray-300 text-gray-700 rounded hover:bg-gray-400"
              >
                取消
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setShowAddForm(true)}
            className="w-full py-2 border-2 border-dashed border-gray-300 rounded-lg text-gray-600 hover:border-gray-400 hover:text-gray-700"
          >
            + 添加 MCP 服务
          </button>
        )}
      </div>
    </div>
  );
}

export default MCPServerList;

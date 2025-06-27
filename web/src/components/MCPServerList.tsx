import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Edit2, Plus, Trash2, X } from "lucide-react";
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
            className="w-full px-3 py-1 border rounded-md text-sm"
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
          className="w-full px-3 py-1 border rounded-md text-sm"
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
          className="w-full px-3 py-1 border rounded-md text-sm"
          placeholder="参数"
        />
      </div>
    );
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>MCP 服务</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {Object.entries(servers).map(([name, config]) => (
          <div key={name} className="border rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <h4 className="font-medium">{name}</h4>
                <span className="text-xs px-2 py-1 bg-muted rounded">
                  {isSSEServer(config) ? "SSE" : "Local"}
                </span>
              </div>
              <div className="flex space-x-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() =>
                    setEditingServer(editingServer === name ? null : name)
                  }
                >
                  {editingServer === name ? (
                    <X className="h-4 w-4" />
                  ) : (
                    <Edit2 className="h-4 w-4" />
                  )}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => handleDeleteServer(name)}
                  className="text-destructive hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {editingServer === name && renderServerEditor(name, config)}

            {!editingServer && (
              <div className="mt-2 text-sm text-muted-foreground">
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
          <div className="border rounded-lg p-4 bg-muted/50">
            <div className="flex space-x-2">
              <input
                type="text"
                value={newServerName}
                onChange={(e) => setNewServerName(e.target.value)}
                placeholder="服务名称"
                className="flex-1 px-3 py-2 border rounded-md"
                onKeyPress={(e) => e.key === "Enter" && handleAddServer()}
              />
              <Button type="button" onClick={handleAddServer} size="sm">
                添加
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setShowAddForm(false);
                  setNewServerName("");
                }}
              >
                取消
              </Button>
            </div>
          </div>
        ) : (
          <Button
            type="button"
            variant="outline"
            className="w-full border-dashed"
            onClick={() => setShowAddForm(true)}
          >
            <Plus className="h-4 w-4 mr-2" />
            添加 MCP 服务
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

export default MCPServerList;

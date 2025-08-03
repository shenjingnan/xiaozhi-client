import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Edit2, Plus, Trash2, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import type { MCPServerConfig, MCPServerToolsConfig } from "../types";
import { getMcpServerCommunicationType } from "../utils/mcpServerUtils";

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
  const [editingServerJson, setEditingServerJson] = useState<string>("");
  const [newServerInput, setNewServerInput] = useState("");
  const [showAddForm, setShowAddForm] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [serverToDelete, setServerToDelete] = useState<string | null>(null);

  // 使用统一的工具函数来判断服务类型

  const handleDeleteServer = () => {
    if (!serverToDelete) return;

    const newServers = { ...servers };
    delete newServers[serverToDelete];

    const newServerConfig = serverConfig ? { ...serverConfig } : undefined;
    if (newServerConfig && serverToDelete in newServerConfig) {
      delete newServerConfig[serverToDelete];
    }

    onChange(newServers, newServerConfig);
    toast.success(`MCP 服务 "${serverToDelete}" 已删除`);
    setDeleteConfirmOpen(false);
    setServerToDelete(null);
  };

  const openDeleteConfirm = (name: string) => {
    setServerToDelete(name);
    setDeleteConfirmOpen(true);
  };

  const parseMCPConfig = (
    input: string
  ): Record<string, MCPServerConfig> | null => {
    try {
      const trimmed = input.trim();
      if (!trimmed) return null;

      const parsed = JSON.parse(trimmed);

      // 检查是否包含 mcpServers 层
      if (parsed.mcpServers && typeof parsed.mcpServers === "object") {
        return parsed.mcpServers;
      }

      // 检查是否是直接的服务配置对象
      if (typeof parsed === "object" && !Array.isArray(parsed)) {
        // 判断是否是单个服务配置（有 command 或 type 字段）
        if (
          "command" in parsed ||
          ("type" in parsed && parsed.type === "sse")
        ) {
          // 生成一个默认名称
          const defaultName = parsed.command
            ? parsed.command.split("/").pop() || "mcp-server"
            : "sse-server";
          return { [defaultName]: parsed };
        }

        // 否则认为是多个服务的配置对象
        return parsed;
      }

      return null;
    } catch (error) {
      console.error("解析配置失败:", error);
      return null;
    }
  };

  const handleAddServer = () => {
    const parsedServers = parseMCPConfig(newServerInput);

    if (!parsedServers) {
      toast.error("配置格式错误: 请输入有效的 JSON 配置");
      return;
    }

    // 检查是否有重名的服务
    const existingNames = Object.keys(parsedServers).filter(
      (name) => name in servers
    );
    if (existingNames.length > 0) {
      toast.error(`服务名称冲突: 以下服务已存在: ${existingNames.join(", ")}`);
      return;
    }

    const newServers = {
      ...servers,
      ...parsedServers,
    };

    onChange(newServers, serverConfig);
    setNewServerInput("");
    setShowAddForm(false);

    const addedCount = Object.keys(parsedServers).length;
    toast.success(
      addedCount === 1
        ? `已添加 MCP 服务 "${Object.keys(parsedServers)[0]}"`
        : `已添加 ${addedCount} 个 MCP 服务`
    );
  };

  const handleUpdateServer = (name: string, jsonStr: string): boolean => {
    try {
      const config = JSON.parse(jsonStr);
      onChange(
        {
          ...servers,
          [name]: config,
        },
        serverConfig
      );
      toast.success(`MCP 服务 "${name}" 配置已更新`);
      return true;
    } catch (error) {
      toast.error("配置格式错误: 请输入有效的 JSON 配置");
      return false;
    }
  };

  const renderServerEditor = (name: string) => {
    return (
      <div className="mt-2 space-y-2">
        <textarea
          value={editingServerJson}
          onChange={(e) => setEditingServerJson(e.target.value)}
          className="w-full px-3 py-2 border rounded-md text-sm font-mono"
          placeholder="输入 JSON 配置"
          rows={8}
        />
        <div className="flex justify-end space-x-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              setEditingServer(null);
              setEditingServerJson("");
            }}
          >
            取消
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={() => {
              const success = handleUpdateServer(name, editingServerJson);
              if (success) {
                setEditingServer(null);
                setEditingServerJson("");
              }
            }}
          >
            保存
          </Button>
        </div>
      </div>
    );
  };

  return (
    <>
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
                    {getMcpServerCommunicationType(config)}
                  </span>
                </div>
                <div className="flex space-x-2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      if (editingServer === name) {
                        setEditingServer(null);
                        setEditingServerJson("");
                      } else {
                        setEditingServer(name);
                        setEditingServerJson(JSON.stringify(config, null, 2));
                      }
                    }}
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
                    onClick={() => openDeleteConfirm(name)}
                    className="text-destructive hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {editingServer === name && renderServerEditor(name)}

              {!editingServer && (
                <div className="mt-2 text-sm text-muted-foreground">
                  {(() => {
                    const type = getMcpServerCommunicationType(config);
                    if (type === "stdio" && "command" in config) {
                      return (
                        <span>
                          {config.command} {config.args?.join(" ") || ""}
                        </span>
                      );
                      // biome-ignore lint/style/noUselessElse: <explanation>
                    } else if (
                      (type === "sse" || type === "streamable-http") &&
                      "url" in config
                    ) {
                      return <span>URL: {config.url}</span>;
                    }
                    return <span>配置信息不可用</span>;
                  })()}
                </div>
              )}
            </div>
          ))}

          {showAddForm ? (
            <div className="border rounded-lg p-4 bg-muted/50 space-y-2">
              <p className="text-sm text-muted-foreground mb-2">
                粘贴 MCP 服务的 JSON 配置：
              </p>
              <textarea
                value={newServerInput}
                onChange={(e) => setNewServerInput(e.target.value)}
                placeholder={`例如：
{
  "mcpServers": {
    "example-server": {
      "command": "npx",
      "args": ["-y", "@example/mcp-server"]
    }
  }
}`}
                className="w-full px-3 py-2 border rounded-md font-mono text-sm"
                rows={6}
              />
              <div className="flex justify-end space-x-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setShowAddForm(false);
                    setNewServerInput("");
                  }}
                >
                  取消
                </Button>
                <Button type="button" onClick={handleAddServer} size="sm">
                  添加
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

      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除</AlertDialogTitle>
            <AlertDialogDescription>
              确定要删除 MCP 服务 "{serverToDelete}" 吗？此操作无法撤销。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteServer}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

export default MCPServerList;

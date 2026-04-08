/**
 * McpServerList 组件 - MCP 服务器列表管理
 *
 * 功能：
 * - 显示所有已配置的 MCP 服务器
 * - 支持删除 MCP 服务器
 * - 支持编辑服务器配置
 * - 支持添加新的 MCP 服务器
 * - 集成 Coze 工作流配置
 */

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import {
  useConfigActions,
  useMcpServers,
} from "@/stores/config";
import { getMcpServerCommunicationType } from "@/utils/mcpServerUtils";
import type {
  AppConfig,
  MCPServerConfig,
} from "@xiaozhi-client/shared-types";
import { CoffeeIcon } from "lucide-react";
import { useCallback, useState } from "react";
import { toast } from "sonner";
import { AddMcpServerButton } from "./add-mcp-server-button";
import { CozeWorkflowIntegration } from "./coze-workflow-integration";
import { McpServerSettingButton } from "./mcp-server-setting-button";
import { RemoveMcpServerButton } from "./remove-mcp-server-button";
import { RestartButton } from "./restart-button";

interface McpServerListProps {
  updateConfig?: (config: AppConfig) => Promise<void>;
  className?: string;
}

export function McpServerList({
  updateConfig: _updateConfig,
  className,
}: McpServerListProps) {
  const mcpServers = useMcpServers();
  const { refreshConfig } = useConfigActions();

  // 添加刷新状态管理
  const [isRefreshing, setIsRefreshing] = useState(false);

  // 数据刷新处理函数 - 用于删除MCP服务后的状态同步
  const handleRefreshData = useCallback(async () => {
    if (isRefreshing) return; // 防止重复刷新

    try {
      setIsRefreshing(true);
      await refreshConfig();
    } catch (error) {
      console.error("刷新数据失败:", error);
      toast.error("刷新数据失败");
    } finally {
      setIsRefreshing(false);
    }
  }, [refreshConfig, isRefreshing]);

  // 工具添加回调（传递给 CozeWorkflowIntegration）
  const handleToolAdded = useCallback(async () => {
    await refreshConfig();
  }, [refreshConfig]);

  if (!mcpServers || Object.keys(mcpServers).length === 0) {
    return (
      <div className="@container/main flex flex-1 flex-col gap-2">
        <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
          <div className="flex items-center justify-between px-4 lg:px-6">
            <div>
              <h2 className="text-lg font-semibold">你的聚合 MCP 服务</h2>
              <p className="text-sm text-muted-foreground">
                在这里管理你的 MCP 服务器和工具。
              </p>
            </div>
            {/* <AddMcpServerButton /> */}
          </div>

          <div className="px-4 lg:px-6">
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-12">
                <CoffeeIcon className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">还没有 MCP 服务</h3>
                <p className="text-sm text-muted-foreground text-center mb-4">
                  添加你的第一个 MCP 服务器来开始使用强大的工具集成功能。
                </p>
                <AddMcpServerButton />
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={className}>
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <AddMcpServerButton />
          <RestartButton />
        </div>
        <CozeWorkflowIntegration onToolAdded={handleToolAdded} />
        {Object.entries(mcpServers || {}).map(([mcpServerName, mcpServer]) => (
          <Card key={mcpServerName} className={"transition-all duration-200"}>
            <CardContent className="p-0">
              <div className="p-4 pb-2">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-4 flex-1">
                    {/* <div className="mt-1">{getStatusIcon(service.status)}</div> */}
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <h3 className="text-lg font-semibold">
                          {mcpServerName}
                        </h3>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 ml-4">
                    <McpServerSettingButton
                      mcpServerName={mcpServerName}
                      mcpServer={mcpServer as MCPServerConfig}
                    />
                    <RemoveMcpServerButton
                      mcpServerName={mcpServerName}
                      onRemoveSuccess={handleRefreshData}
                      disabled={isRefreshing}
                    />
                  </div>
                </div>
              </div>
            </CardContent>
            <CardFooter className="p-4 pt-2">
              <Badge variant="outline" className="text-xs">
                {getMcpServerCommunicationType(mcpServer)}
              </Badge>
            </CardFooter>
          </Card>
        ))}
      </div>
    </div>
  );
}

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import {
  useWebSocketConfig,
  useWebSocketMcpServerConfig,
  useWebSocketMcpServers,
} from "@/stores/websocket";
import type { MCPServerConfig } from "@/types";
import { getMcpServerCommunicationType } from "@/utils/mcpServerUtils";
import { CoffeeIcon, MinusIcon, PlusIcon, Wrench } from "lucide-react";
import { useMemo } from "react";
import { toast } from "sonner";
import { AddMcpServerButton } from "./AddMcpServerButton";
import { McpServerSettingButton } from "./McpServerSettingButton";
import { RemoveMcpServerButton } from "./RemoveMcpServerButton";
import { RestartButton } from "./RestartButton";

interface McpServerListProps {
  updateConfig?: (config: any) => Promise<void>;
}

export function McpServerList({ updateConfig }: McpServerListProps) {
  const mcpServerConfig = useWebSocketMcpServerConfig();
  const mcpServers = useWebSocketMcpServers();
  const config = useWebSocketConfig();

  const tools = useMemo(() => {
    return Object.entries(mcpServerConfig || {}).flatMap(
      ([serverName, value]) => {
        return Object.entries(value?.tools || {}).map(([toolName, tool]) => ({
          serverName,
          toolName,
          ...tool,
        }));
      }
    );
  }, [mcpServerConfig]);

  const handleToggleTool = async (
    serverName: string,
    toolName: string,
    currentEnable: boolean
  ) => {
    if (!updateConfig) {
      toast.error("updateConfig 方法未提供");
      return;
    }

    if (!config) {
      toast.error("配置未加载");
      return;
    }

    try {
      // 创建新的配置对象
      const newConfig = {
        ...config,
        mcpServerConfig: {
          ...config.mcpServerConfig,
          [serverName]: {
            ...config.mcpServerConfig?.[serverName],
            tools: {
              ...config.mcpServerConfig?.[serverName]?.tools,
              [toolName]: {
                ...config.mcpServerConfig?.[serverName]?.tools?.[toolName],
                enable: !currentEnable,
              },
            },
          },
        },
      };

      // 更新配置
      await updateConfig(newConfig);

      // 显示成功提示
      const action = !currentEnable ? "启用" : "禁用";
      toast.success(`${action}工具 ${toolName} 成功`);
    } catch (error) {
      console.error("切换工具状态失败:", error);
      toast.error(error instanceof Error ? error.message : "切换工具状态失败");
    }
  };

  const enabledTools = tools.filter((tool) => tool.enable);
  const disabledTools = tools.filter((tool) => !tool.enable);

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
    <div className="flex flex-col gap-4 px-4 lg:px-6">
      <h2 className="text-2xl font-bold">你的聚合 MCP 服务</h2>
      <p className="text-sm text-muted-foreground">
        你可以在这里管理你的 MCP
        服务，包括启用/禁用工具，以及查看工具的详细信息。
        最终暴露给小智服务端和其他MCP客户端的是这里聚合MCP
      </p>
      <div className="*:data-[slot=card]:shadow-xs @xl/main:grid-cols-8 @5xl/main:grid-cols-8 grid grid-cols-1 gap-4 *:data-[slot=card]:bg-gradient-to-t *:data-[slot=card]:from-primary/5 *:data-[slot=card]:to-card dark:*:data-[slot=card]:bg-card">
        {/* <div>{JSON.stringify(enabledTools, null, 2)}</div> */}
        <Card className="transition-all duration-200 col-span-3">
          <CardContent className="p-4">
            <div className="flex-col">
              <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
                <Wrench className="h-4 w-4" />
                使用中的工具 ({enabledTools.length})
              </h4>
              <div className="flex-1 space-y-2">
                {enabledTools.map((tool) => (
                  <div
                    key={tool.toolName}
                    className="flex items-start justify-between p-4 bg-gray-50 rounded-md font-mono"
                  >
                    <div className="text-md flex flex-col gap-2">
                      {tool.toolName}
                      <p className="text-sm text-muted-foreground">
                        {tool.description}
                      </p>
                    </div>

                    <div className="flex items-center gap-2 ml-4">
                      <Button
                        variant="secondary"
                        size="icon"
                        className="size-8 hover:bg-red-500 hover:text-white"
                        onClick={() =>
                          handleToggleTool(tool.serverName, tool.toolName, true)
                        }
                      >
                        <MinusIcon size={18} />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="transition-all duration-200 col-span-3">
          <CardContent className="p-4">
            <div className="flex-col">
              <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
                <Wrench className="h-4 w-4" />
                未使用的工具 ({disabledTools.length})
              </h4>
              {disabledTools.length === 0 && (
                <div className="flex-1 flex flex-col items-center gap-4 py-20 px-4 bg-gray-50 rounded-md font-mono h-full">
                  <CoffeeIcon
                    strokeWidth={1.5}
                    size={48}
                    className="text-muted-foreground"
                  />
                  <span className="text-sm text-muted-foreground">
                    全部工具都已经启用
                  </span>
                </div>
              )}
              <div className="flex-1 space-y-2">
                {disabledTools.map((tool) => (
                  <div
                    key={tool.toolName}
                    className="flex items-start justify-between p-4 bg-gray-50 rounded-md font-mono"
                  >
                    <div className="text-md flex flex-col gap-2">
                      {tool.toolName}
                      <p className="text-sm text-muted-foreground">
                        {tool.description}
                      </p>
                    </div>

                    <div className="flex items-center gap-2 ml-4">
                      <Button
                        variant="secondary"
                        size="icon"
                        className="size-8 hover:bg-green-500 hover:text-white"
                        onClick={() =>
                          handleToggleTool(
                            tool.serverName,
                            tool.toolName,
                            false
                          )
                        }
                      >
                        <PlusIcon className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
        <div className="transition-all duration-200 gap-4 flex flex-col col-span-2">
          <div className="flex items-center gap-2">
            <AddMcpServerButton />
            <RestartButton />
          </div>
          {Object.entries(mcpServers || {}).map(
            ([mcpServerName, mcpServer]) => (
              <Card
                key={mcpServerName}
                className={"transition-all duration-200"}
              >
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
                        <RemoveMcpServerButton mcpServerName={mcpServerName} />
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
            )
          )}
        </div>
      </div>
    </div>
  );
}

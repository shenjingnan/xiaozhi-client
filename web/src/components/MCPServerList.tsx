import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { useWebSocket } from "@/hooks/useWebSocket";
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

export function McpServerList() {
  const mcpServerConfig = useWebSocketMcpServerConfig();
  const mcpServers = useWebSocketMcpServers();
  const config = useWebSocketConfig();
  const { updateConfig } = useWebSocket();

  const tools = useMemo(() => {
    return Object.entries(mcpServerConfig || {}).flatMap(
      ([serverName, value]) => {
        return Object.entries(value?.tools || {}).map(([toolName, tool]) => ({
          serverName,
          toolName,
          tool,
        }));
      }
    );
  }, [mcpServerConfig]);

  const enabledTools = useMemo(() => {
    return tools.filter(({ tool }) => tool.enable);
  }, [tools]);
  const disabledTools = useMemo(() => {
    return tools.filter(({ tool }) => !tool.enable);
  }, [tools]);

  const handleToggleTool = async (serverName: string, toolName: string) => {
    if (!config || !mcpServerConfig) {
      toast.error("配置数据未加载，请稍后重试");
      return;
    }

    try {
      // 找到包含该工具的服务器
      const targetServerName = serverName;
      const targetTool = mcpServerConfig[serverName]?.tools?.[toolName];

      if (!targetServerName || !targetTool) {
        toast.error(`未找到工具 "${toolName}" 的配置`);
        return;
      }

      // 创建新的配置对象
      const newConfig = {
        ...config,
        mcpServerConfig: {
          ...config.mcpServerConfig,
          [targetServerName]: {
            ...config.mcpServerConfig![targetServerName],
            tools: {
              ...config.mcpServerConfig![targetServerName].tools,
              [toolName]: {
                ...targetTool,
                enable: !targetTool.enable,
              },
            },
          },
        },
      };

      // 更新配置
      await updateConfig(newConfig);

      // 显示成功提示
      const action = !targetTool.enable ? "启用" : "禁用";
      toast.success(`工具 "${toolName}" 已${action}`);
    } catch (error) {
      console.error("切换工具状态失败:", error);
      toast.error(
        `切换工具状态失败: ${
          error instanceof Error ? error.message : "未知错误"
        }`
      );
    }
  };

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
                聚合后的MCP服务 ({enabledTools.length})
              </h4>
              <div className="flex-1 space-y-2 h-[500px] overflow-y-auto">
                {enabledTools.map((tool) => (
                  <div
                    key={tool.toolName}
                    className="flex items-start justify-between p-4 bg-gray-50 rounded-md font-mono"
                  >
                    <div className="text-md flex flex-col gap-2">
                      {tool.toolName}
                      <p className="text-sm text-muted-foreground">
                        {tool.tool.description}
                      </p>
                    </div>

                    <div className="flex items-center gap-2 ml-4">
                      <Button
                        variant="secondary"
                        size="icon"
                        className="size-8 hover:bg-red-500 hover:text-white"
                        onClick={() =>
                          handleToggleTool(tool.serverName, tool.toolName)
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
                可用工具 ({disabledTools.length})
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
              <div className="flex-1 space-y-2 h-[500px] overflow-y-auto">
                {disabledTools.map((tool) => (
                  <div
                    key={tool.toolName}
                    className="flex items-start justify-between p-4 bg-gray-50 rounded-md font-mono"
                  >
                    <div className="text-md flex flex-col gap-2">
                      {tool.toolName}
                      <p className="text-sm text-muted-foreground">
                        {tool.tool.description}
                      </p>
                    </div>

                    <div className="flex items-center gap-2 ml-4">
                      <Button
                        variant="secondary"
                        size="icon"
                        className="size-8 hover:bg-green-500 hover:text-white"
                        onClick={() =>
                          handleToggleTool(tool.serverName, tool.toolName)
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
};

/**
 * MCP 服务状态卡片组件
 *
 * 显示当前连接的 MCP 服务数量，并提供服务器列表和工具调用日志查看入口。
 */

import { ToolCallLogsDialog } from "@/components/ToolCallLogsDialog";
import { McpServerTableDialog } from "@/components/mcp-server/mcp-server-table-dialog";
import {
  Card,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useMcpServersWithStatus } from "@/stores/config";
import { MiniCircularProgress } from "./mini-circular-progress";

/**
 * MCP 服务状态卡片组件
 *
 * 显示当前连接的 MCP 服务数量，右上角显示服务数量指示器。
 */
export function ServerStatusCard() {
  const { servers } = useMcpServersWithStatus();

  const totalServers = servers.length;
  const connectedServers = servers.filter((s) => s.connected).length;

  return (
    <Card className="@container/card">
      <CardHeader className="relative">
        <CardDescription>MCP服务</CardDescription>
        <CardTitle className="@[250px]/card:text-3xl text-2xl font-semibold tabular-nums">
          {connectedServers}/{totalServers}
        </CardTitle>
        <div className="absolute right-4 top-4">
          <MiniCircularProgress
            showValue={false}
            value={connectedServers}
            maxValue={Math.max(totalServers, 1)}
            activeColor="#16a34a"
            inactiveColor="#f87171"
            size={30}
            symbol=""
          />
        </div>
      </CardHeader>
      <CardFooter className="flex items-center justify-between gap-1 text-sm">
        <div className="text-muted-foreground">
          已连接 {connectedServers} 个，共 {totalServers} 个服务
        </div>
        <div className="flex gap-2">
          <McpServerTableDialog />
          <ToolCallLogsDialog />
        </div>
      </CardFooter>
    </Card>
  );
}

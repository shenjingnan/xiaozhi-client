import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { ClientStatus } from "../types";

interface StatusCardProps {
  connected: boolean;
  status: ClientStatus | null;
}

function StatusCard({ connected, status }: StatusCardProps) {
  const getStatusColor = () => {
    if (!connected) return "bg-muted text-muted-foreground";
    if (status?.status === "connected")
      return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100";
    return "bg-destructive/10 text-destructive";
  };

  const getStatusText = () => {
    if (!connected) return "未连接到配置服务器";
    if (status?.status === "connected") return "已连接";
    return "未连接到小智服务";
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>连接状态</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">配置服务器</span>
          <span
            className={cn(
              "px-2 py-1 rounded-full text-xs font-medium",
              connected
                ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100"
                : "bg-destructive/10 text-destructive"
            )}
          >
            {connected ? "已连接" : "未连接"}
          </span>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">小智服务</span>
          <span
            className={cn(
              "px-2 py-1 rounded-full text-xs font-medium",
              getStatusColor()
            )}
          >
            {getStatusText()}
          </span>
        </div>

        {status?.activeMCPServers && status.activeMCPServers.length > 0 && (
          <div className="pt-3 border-t">
            <p className="text-xs text-muted-foreground mb-1">活跃 MCP 服务</p>
            <div className="flex flex-wrap gap-1">
              {status.activeMCPServers.map((server) => (
                <span
                  key={server}
                  className="px-2 py-1 bg-primary/10 text-primary text-xs rounded"
                >
                  {server}
                </span>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default StatusCard;

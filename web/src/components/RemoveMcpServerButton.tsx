import { Button } from "@/components/ui/button";
import { useWebSocket } from "@/hooks/useWebSocket";
import { useWebSocketConfig } from "@/stores/websocket";
import { TrashIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "./ui/alert-dialog";

export function RemoveMcpServerButton({
  mcpServerName,
}: {
  mcpServerName: string;
}) {
  const [isLoading, setIsLoading] = useState(false);
  const { updateConfig } = useWebSocket();
  const config = useWebSocketConfig();

  const onRemove = async () => {
    if (!config) {
      toast.error("配置未加载，无法删除服务");
      return;
    }

    try {
      setIsLoading(true);

      // 创建新的服务器配置，删除指定的服务器
      const newMcpServers = { ...config.mcpServers };
      delete newMcpServers[mcpServerName];

      // 创建新的服务器工具配置，删除对应的工具配置
      const newMcpServerConfig = config.mcpServerConfig
        ? { ...config.mcpServerConfig }
        : undefined;

      if (newMcpServerConfig && mcpServerName in newMcpServerConfig) {
        delete newMcpServerConfig[mcpServerName];
      }

      // 构建新的配置对象
      const newConfig = {
        ...config,
        mcpServers: newMcpServers,
        mcpServerConfig: newMcpServerConfig,
      };

      // 更新配置
      await updateConfig(newConfig);

      toast.success(`MCP 服务 "${mcpServerName}" 已删除`);
    } catch (error) {
      console.error("删除 MCP 服务失败:", error);
      toast.error(`删除 MCP 服务失败: ${error instanceof Error ? error.message : "未知错误"}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="destructive" size="icon" className="size-8">
          <TrashIcon className="h-4 w-4" />
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            确定要删除这个({mcpServerName})MCP服务吗？
          </AlertDialogTitle>
          <AlertDialogDescription>
            删除后，对应的工具列表也会移除。
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>取消</AlertDialogCancel>
          <AlertDialogAction
            onClick={onRemove}
            disabled={isLoading}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {isLoading ? "删除中..." : "确定"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

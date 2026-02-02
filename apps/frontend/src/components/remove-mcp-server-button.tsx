import { cn } from "@/lib/utils";
import { mcpServerApi } from "@/services/api";
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
} from "@ui/alert-dialog";
import { TrashIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export function RemoveMcpServerButton({
  mcpServerName,
  onRemoveSuccess,
  disabled = false,
}: {
  mcpServerName: string;
  onRemoveSuccess?: () => Promise<void>;
  disabled?: boolean;
}) {
  const [isLoading, setIsLoading] = useState(false);

  const onRemove = async () => {
    try {
      setIsLoading(true);

      // 调用API删除服务器
      const result = await mcpServerApi.removeServer(mcpServerName);

      if (!result) {
        throw new Error("删除服务器失败");
      }

      toast.success(`MCP 服务 "${mcpServerName}" 已删除`);

      // 调用成功回调
      if (onRemoveSuccess) {
        await onRemoveSuccess();
      }
    } catch (error) {
      console.error("删除 MCP 服务失败:", error);
      toast.error(
        `删除 MCP 服务失败: ${error instanceof Error ? error.message : "未知错误"}`
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <button
          type="button"
          disabled={disabled || isLoading}
          className={cn(
            "flex items-center gap-1 hover:cursor-pointer text-destructive hover:text-red-700 transition-all duration-100",
            (disabled || isLoading) && "opacity-50 cursor-not-allowed"
          )}
        >
          <TrashIcon size={14} />
          <span>卸载</span>
        </button>
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
            disabled={disabled || isLoading}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {isLoading ? "删除中..." : "确定"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

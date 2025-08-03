import { Button } from "@/components/ui/button";

import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
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
import { useWebSocket } from "@/hooks/useWebSocket";
import { useMcpEndpoint, useWebSocketConfig } from "@/stores/websocket";
import { CopyIcon, PlusIcon, SettingsIcon, TrashIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

const sliceEndpoint = (endpoint: string) => {
  return `${endpoint.slice(0, 30)}...${endpoint.slice(-10)}`;
};

export function McpEndpointSettingButton() {
  const [open, setOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [endpointToDelete, setEndpointToDelete] = useState<string>("");
  const [isDeleting, setIsDeleting] = useState(false);

  const config = useWebSocketConfig();
  const mcpEndpoint = useMcpEndpoint();
  const { updateConfig } = useWebSocket();

  // 复制接入点地址到剪贴板
  const handleCopy = async (endpoint: string) => {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(endpoint);
        toast.success("接入点地址已复制到剪贴板");
      } else {
        // 降级方案：使用传统的复制方法
        const textArea = document.createElement("textarea");
        textArea.value = endpoint;
        textArea.style.position = "fixed";
        textArea.style.opacity = "0";
        document.body.appendChild(textArea);
        textArea.select();
        const successful = document.execCommand("copy");
        document.body.removeChild(textArea);
        if (successful) {
          toast.success("接入点地址已复制到剪贴板");
        } else {
          throw new Error("复制命令执行失败");
        }
      }
    } catch (error) {
      console.error("复制失败:", error);
      toast.error("复制失败，请手动复制");
    }
  };

  // 删除接入点
  const handleDeleteEndpoint = async () => {
    if (!config || !endpointToDelete) {
      toast.error("配置数据未加载或未选择要删除的接入点");
      return;
    }

    setIsDeleting(true);
    try {
      const currentEndpoints = Array.isArray(mcpEndpoint) ? mcpEndpoint : [mcpEndpoint];
      const updatedEndpoints = currentEndpoints.filter(ep => ep !== endpointToDelete);

      // 如果删除后没有接入点了，设置为空字符串
      const newMcpEndpoint = updatedEndpoints.length > 0 ?
        (updatedEndpoints.length === 1 ? updatedEndpoints[0] : updatedEndpoints) :
        "";

      const updatedConfig = {
        ...config,
        mcpEndpoint: newMcpEndpoint,
      };

      await updateConfig(updatedConfig);
      toast.success("接入点已删除");
      setDeleteConfirmOpen(false);
      setEndpointToDelete("");
    } catch (error) {
      console.error("删除接入点失败:", error);
      toast.error(error instanceof Error ? error.message : "删除接入点失败");
    } finally {
      setIsDeleting(false);
    }
  };

  // 打开删除确认对话框
  const openDeleteConfirm = (endpoint: string) => {
    setEndpointToDelete(endpoint);
    setDeleteConfirmOpen(true);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="secondary" size="icon" className="size-8">
          <SettingsIcon className="size-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader className="mb-4">
          <DialogTitle>配置小智服务端接入点</DialogTitle>
          <DialogDescription>
            点击保存后，需要重启服务才会生效。
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-2">
          {(Array.isArray(mcpEndpoint) ? mcpEndpoint : [mcpEndpoint]).map(
            (item) => (
              <div
                key={item}
                className="flex items-center justify-between p-4 bg-gray-50 rounded-md font-mono"
              >
                <span className="flex-1 text-ellipsis overflow-hidden whitespace-nowrap">
                  {sliceEndpoint(item)}
                </span>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => handleCopy(item)}
                    title="复制完整地址"
                  >
                    <CopyIcon className="size-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => openDeleteConfirm(item)}
                    title="删除此接入点"
                  >
                    <TrashIcon className="size-4 text-red-500" />
                  </Button>
                </div>
              </div>
            )
          )}
          <div className="flex items-center gap-2">
            <Button
              size="icon"
              className="flex-1 flex items-center gap-2"
            >
              <PlusIcon className="size-4" />
              <span>添加小智服务端接入点</span>
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="flex-1 flex items-center gap-2"
              onClick={() => window.open('https://xiaozhi.me/console/agents', '_blank')}
            >
              <span>打开小智服务端</span>
            </Button>
          </div>
        </div>

        {/* <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)}>
            <div className="grid gap-4">
              <FormField
                control={form.control}
                name="config"
                render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <Textarea
                        placeholder="MCP服务配置"
                        className="resize-none h-[300px] font-mono text-sm"
                        disabled={isLoading}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </form>
        </Form> */}
        {/* <DialogFooter className="mt-4">
          <DialogClose asChild>
            <Button variant="outline">
              取消
            </Button>
          </DialogClose>
          <Button type="submit">
            保存
          </Button>
        </DialogFooter> */}
      </DialogContent>

      {/* 删除确认对话框 */}
      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除接入点</AlertDialogTitle>
            <AlertDialogDescription>
              确定要删除接入点 "{sliceEndpoint(endpointToDelete)}" 吗？此操作无法撤销。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteEndpoint}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? "删除中..." : "确定删除"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  );
}

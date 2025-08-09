import { Button } from "@/components/ui/button";

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
import { Input } from "@/components/ui/input";
import { useWebSocket } from "@/hooks/useWebSocket";
import { useMcpEndpoint, useWebSocketConfig } from "@/stores/websocket";
import {
  BadgeInfoIcon,
  CopyIcon,
  PlusIcon,
  SettingsIcon,
  TrashIcon,
} from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

const sliceEndpoint = (endpoint: string) => {
  return `${endpoint.slice(0, 30)}...${endpoint.slice(-10)}`;
};

// 验证接入点格式
const validateEndpoint = (endpoint: string): string | null => {
  if (!endpoint.trim()) {
    return "请输入接入点地址";
  }

  // 检查是否以正确的前缀开头
  const expectedPrefix = "wss://api.xiaozhi.me/mcp/?token=";
  if (!endpoint.startsWith(expectedPrefix)) {
    return "接入点格式无效，请输入正确的小智服务端接入点地址";
  }

  // 提取 token 部分
  const token = endpoint.substring(expectedPrefix.length);
  if (!token) {
    return "接入点格式无效，缺少 token 参数";
  }

  // 验证 JWT 格式（应该有两个点分隔的三个部分）
  const jwtParts = token.split(".");
  if (jwtParts.length !== 3) {
    return "接入点格式无效，token 格式不正确";
  }

  // 检查每个部分是否为有效的 base64 字符串（简单检查）
  for (const part of jwtParts) {
    if (!part || !/^[A-Za-z0-9_-]+$/.test(part)) {
      return "接入点格式无效，token 格式不正确";
    }
  }

  return null; // 验证通过
};

export function McpEndpointSettingButton() {
  const [open, setOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [endpointToDelete, setEndpointToDelete] = useState<string>("");
  const [isDeleting, setIsDeleting] = useState(false);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [newEndpoint, setNewEndpoint] = useState("");
  const [isAdding, setIsAdding] = useState(false);
  const [validationError, setValidationError] = useState("");

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
      const currentEndpoints = Array.isArray(mcpEndpoint)
        ? mcpEndpoint
        : [mcpEndpoint];
      const updatedEndpoints = currentEndpoints.filter(
        (ep) => ep !== endpointToDelete
      );

      // 如果删除后没有接入点了，设置为空字符串
      const newMcpEndpoint =
        updatedEndpoints.length > 0
          ? updatedEndpoints.length === 1
            ? updatedEndpoints[0]
            : updatedEndpoints
          : "";

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

  // 添加新接入点
  const handleAddEndpoint = async () => {
    const error = validateEndpoint(newEndpoint);
    if (error) {
      setValidationError(error);
      return;
    }

    // 检查是否与现有接入点重复
    const currentEndpoints = Array.isArray(mcpEndpoint)
      ? mcpEndpoint
      : [mcpEndpoint];
    if (currentEndpoints.includes(newEndpoint)) {
      setValidationError("该接入点已存在");
      return;
    }

    if (!config) {
      toast.error("配置数据未加载，请稍后重试");
      return;
    }

    setIsAdding(true);
    try {
      // 将新接入点添加到数组的第一位
      const updatedEndpoints = [
        newEndpoint,
        ...currentEndpoints.filter((ep) => ep),
      ];

      const updatedConfig = {
        ...config,
        mcpEndpoint: updatedEndpoints,
      };

      await updateConfig(updatedConfig);
      toast.success("接入点添加成功");
      setAddDialogOpen(false);
      setNewEndpoint("");
      setValidationError("");
    } catch (error) {
      console.error("添加接入点失败:", error);
      toast.error(error instanceof Error ? error.message : "添加接入点失败");
    } finally {
      setIsAdding(false);
    }
  };

  // 打开添加接入点对话框
  const openAddDialog = () => {
    setNewEndpoint("");
    setValidationError("");
    setAddDialogOpen(true);
  };

  // 处理输入变化
  const handleInputChange = (value: string) => {
    setNewEndpoint(value);
    if (validationError) {
      setValidationError("");
    }
  };

  // 打开删除确认对话框
  const openDeleteConfirm = (endpoint: string) => {
    setEndpointToDelete(endpoint);
    setDeleteConfirmOpen(true);
  };

  const mcpEndpoints = useMemo(() => {
    let list: string[] = [];
    if (Array.isArray(mcpEndpoint)) list = mcpEndpoint;
    if (typeof mcpEndpoint === "string" && mcpEndpoint.length) {
      list.push(mcpEndpoint);
    }
    return list;
  }, [mcpEndpoint]);

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
          {mcpEndpoints.map((item) => (
            <div
              key={item}
              className="flex items-center justify-between p-4 bg-slate-50 rounded-md font-mono"
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
          ))}
          {mcpEndpoints.length === 0 && (
            <div className="flex flex-col items-center flex-1 text-sm text-muted-foreground text-center justify-center gap-2">
              <BadgeInfoIcon />
              <span>暂无接入点，请添加</span>
            </div>
          )}
          <div className="flex items-center gap-2 mt-4">
            <Button
              size="icon"
              className="flex-1 flex items-center gap-2"
              onClick={openAddDialog}
            >
              <PlusIcon className="size-4" />
              <span>添加小智服务端接入点</span>
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="flex-1 flex items-center gap-2"
              onClick={() =>
                window.open("https://xiaozhi.me/console/agents", "_blank")
              }
            >
              <span>打开小智服务端</span>
            </Button>
          </div>
        </div>
      </DialogContent>

      {/* 删除确认对话框 */}
      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除接入点</AlertDialogTitle>
            <AlertDialogDescription>
              确定要删除接入点 "{sliceEndpoint(endpointToDelete)}"
              吗？此操作无法撤销。
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

      {/* 添加接入点对话框 */}
      <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>添加新的接入点</DialogTitle>
            <DialogDescription>请输入小智服务端接入点地址</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Input
                placeholder="请输入接入点地址，例如：wss://api.xiaozhi.me/mcp/?token=..."
                value={newEndpoint}
                onChange={(e) => handleInputChange(e.target.value)}
                disabled={isAdding}
                className="font-mono text-sm"
              />
              {validationError && (
                <p className="text-sm text-red-500">{validationError}</p>
              )}
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline" disabled={isAdding}>
                取消
              </Button>
            </DialogClose>
            <Button
              onClick={handleAddEndpoint}
              disabled={isAdding || !newEndpoint.trim()}
            >
              {isAdding ? "添加中..." : "确定"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Dialog>
  );
}

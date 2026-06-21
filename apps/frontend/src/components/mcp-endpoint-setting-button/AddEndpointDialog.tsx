import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

/**
 * 验证接入点格式
 */
const validateEndpoint = (endpoint: string): string | null => {
  if (!endpoint.trim()) {
    return "请输入接入点地址";
  }

  // 检查是否是有效的 WebSocket URL
  if (!endpoint.startsWith("ws://") && !endpoint.startsWith("wss://")) {
    return "接入点格式无效，请输入正确的WebSocket URL (ws:// 或 wss://)";
  }

  // 检查是否是有效的 URL
  try {
    new URL(endpoint);
  } catch {
    return "接入点格式无效，请输入正确的URL格式";
  }

  return null; // 验证通过
};

/**
 * 添加接入点对话框组件
 * 用于添加新的小智服务端接入点
 */
export function AddEndpointDialog({
  open,
  onOpenChange,
  onAdd,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdd: (endpoint: string) => Promise<void>;
}) {
  const [newEndpoint, setNewEndpoint] = useState("");
  const [isAdding, setIsAdding] = useState(false);
  const [validationError, setValidationError] = useState("");

  // 重置表单状态
  const resetForm = useCallback(() => {
    setNewEndpoint("");
    setValidationError("");
    setIsAdding(false);
  }, []);

  // 当对话框打开/关闭时重置表单
  useEffect(() => {
    if (!open) {
      resetForm();
    }
  }, [open, resetForm]);

  // 处理添加接入点
  const handleAdd = async () => {
    const error = validateEndpoint(newEndpoint);
    if (error) {
      setValidationError(error);
      return;
    }

    setIsAdding(true);
    try {
      await onAdd(newEndpoint);
      onOpenChange(false);
      resetForm();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "添加接入点失败";
      setValidationError(errorMessage);
      // 同时显示 toast 错误提示
      toast.error(errorMessage);
    } finally {
      setIsAdding(false);
    }
  };

  // 处理输入变化
  const handleInputChange = (value: string) => {
    setNewEndpoint(value);
    if (validationError) {
      setValidationError("");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>添加新的接入点</DialogTitle>
          <DialogDescription>请输入小智服务端接入点地址</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="space-y-2">
            <Input
              placeholder="请输入接入点地址，例如：wss://api.xiaozhi.me/mcp/?token=... 或 ws(s)://<hostname>:<port>"
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
            onClick={handleAdd}
            disabled={isAdding || !newEndpoint.trim()}
          >
            {isAdding ? "添加中..." : "确定"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

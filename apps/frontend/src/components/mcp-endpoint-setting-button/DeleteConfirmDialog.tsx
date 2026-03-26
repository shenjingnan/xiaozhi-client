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
import { useCallback, useState } from "react";

/**
 * 切片显示接入点地址
 */
const sliceEndpoint = (endpoint: string) => {
  return `${endpoint.slice(0, 30)}...${endpoint.slice(-10)}`;
};

/**
 * 删除接入点确认对话框组件
 * 用于确认删除操作
 */
export function DeleteConfirmDialog({
  open,
  onOpenChange,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => Promise<void>;
}) {
  const [isDeleting, setIsDeleting] = useState(false);
  const [endpointToDelete, setEndpointToDelete] = useState("");

  // 打开对话框并设置要删除的端点
  const openDialog = useCallback((endpoint: string) => {
    setEndpointToDelete(endpoint);
    onOpenChange(true);
  }, [onOpenChange]);

  // 处理确认删除
  const handleConfirm = async () => {
    setIsDeleting(true);
    try {
      await onConfirm();
      onOpenChange(false);
      setEndpointToDelete("");
    } catch {
      // 错误已在调用方处理
    } finally {
      setIsDeleting(false);
    }
  };

  // 暴露打开对话框的方法
  (DeleteConfirmDialog as any).open = openDialog;

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
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
            onClick={handleConfirm}
            disabled={isDeleting}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {isDeleting ? "删除中..." : "确定删除"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

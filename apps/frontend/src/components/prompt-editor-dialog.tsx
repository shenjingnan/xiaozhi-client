/**
 * 提示词编辑器对话框组件
 *
 * 提供查看、编辑、新建提示词文件的功能
 */

import { AlertCircle, FileText, Loader2, Plus, Trash2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Alert, AlertDescription } from "@/components/ui/alert";
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
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { apiClient } from "@/services/api";

/**
 * 对话框模式
 */
type DialogMode = "view" | "edit" | "create";

interface PromptEditorDialogProps {
  /** 对话框是否打开 */
  open: boolean;
  /** 打开/关闭状态变化回调 */
  onOpenChange: (open: boolean) => void;
  /** 当前选中的提示词文件路径（用于编辑模式） */
  selectedPath?: string;
  /** 提示词文件更新后的回调 */
  onPromptUpdated?: () => void;
  /** 新提示词文件创建后的回调 */
  onPromptCreated?: (relativePath: string) => void;
  /** 提示词文件删除后的回调 */
  onPromptDeleted?: () => void;
}

/**
 * 提示词编辑器对话框组件
 */
export function PromptEditorDialog({
  open,
  onOpenChange,
  selectedPath,
  onPromptUpdated,
  onPromptCreated,
  onPromptDeleted,
}: PromptEditorDialogProps) {
  const [mode, setMode] = useState<DialogMode>("view");
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [content, setContent] = useState("");
  const [originalContent, setOriginalContent] = useState("");
  const [fileName, setFileName] = useState("");
  const [error, setError] = useState<string | null>(null);

  // 加载提示词文件内容
  const loadPromptContent = useCallback(async (path: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await apiClient.getPromptFileContent(path);
      setContent(result.content);
      setOriginalContent(result.content);
      setFileName(result.fileName);
    } catch (err) {
      setError(err instanceof Error ? err.message : "加载提示词文件失败");
    } finally {
      setIsLoading(false);
    }
  }, []);

  // 当对话框打开或选中的路径变化时，加载内容
  useEffect(() => {
    if (open) {
      if (mode === "create") {
        // 新建模式：清空内容
        setContent("");
        setOriginalContent("");
        setFileName("");
        setError(null);
      } else if (selectedPath) {
        // 查看/编辑模式：加载文件内容
        loadPromptContent(selectedPath);
      } else {
        // 没有选中文件：切换到新建模式
        setMode("create");
        setContent("");
        setOriginalContent("");
        setFileName("");
        setError(null);
      }
    }
  }, [open, selectedPath, mode, loadPromptContent]);

  // 重置模式
  useEffect(() => {
    if (!open) {
      setMode("view");
    }
  }, [open]);

  // 保存提示词
  const handleSave = async () => {
    if (mode === "create") {
      // 新建模式：验证文件名
      if (!fileName.trim()) {
        setError("请输入文件名");
        return;
      }
      if (!fileName.endsWith(".md")) {
        setError("文件名必须以 .md 结尾");
        return;
      }
    }

    setIsSaving(true);
    setError(null);
    try {
      if (mode === "create") {
        // 创建新文件
        const result = await apiClient.createPromptFile(fileName, content);
        toast.success("提示词文件创建成功");
        onPromptCreated?.(result.relativePath);
        onOpenChange(false);
      } else if (selectedPath) {
        // 更新现有文件
        await apiClient.updatePromptFileContent(selectedPath, content);
        toast.success("提示词文件保存成功");
        setOriginalContent(content);
        onPromptUpdated?.();
        setMode("view");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "保存失败");
    } finally {
      setIsSaving(false);
    }
  };

  // 删除提示词
  const handleDelete = async () => {
    if (!selectedPath) return;

    // 确认删除
    if (!window.confirm(`确定要删除文件 "${fileName}" 吗？此操作无法撤销。`)) {
      return;
    }

    setIsSaving(true);
    setError(null);
    try {
      await apiClient.deletePromptFile(selectedPath);
      toast.success("提示词文件删除成功");
      onPromptDeleted?.();
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "删除失败");
    } finally {
      setIsSaving(false);
    }
  };

  // 判断是否有修改
  const hasChanges = content !== originalContent;

  // 获取对话框标题
  const getTitle = () => {
    switch (mode) {
      case "create":
        return "新建提示词文件";
      case "edit":
        return "编辑提示词";
      default:
        return "查看提示词";
    }
  };

  // 获取对话框描述
  const getDescription = () => {
    if (mode === "create") {
      return "创建一个新的系统提示词文件";
    }
    return selectedPath || "提示词文件";
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[700px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="size-5" />
            {getTitle()}
          </DialogTitle>
          <DialogDescription>{getDescription()}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="size-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {mode === "create" && (
            <div className="space-y-2">
              <Label htmlFor="fileName">文件名</Label>
              <Input
                id="fileName"
                placeholder="例如：custom-prompt.md"
                value={fileName}
                onChange={(e) => setFileName(e.target.value)}
                disabled={isSaving}
              />
            </div>
          )}

          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="size-6 animate-spin text-muted-foreground" />
              <span className="ml-2 text-muted-foreground">加载中...</span>
            </div>
          ) : (
            <div className="space-y-2">
              <Label htmlFor="content">提示词内容</Label>
              <Textarea
                id="content"
                placeholder="请输入系统提示词内容..."
                className="min-h-[300px] font-mono text-sm"
                value={content}
                onChange={(e) => setContent(e.target.value)}
                disabled={isSaving || (mode === "view" && !isSaving)}
              />
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          {mode === "view" && selectedPath && (
            <>
              <Button
                variant="destructive"
                size="sm"
                onClick={handleDelete}
                disabled={isSaving}
                className="mr-auto"
              >
                <Trash2 className="size-4 mr-1" />
                删除
              </Button>
              <Button
                variant="outline"
                onClick={() => setMode("edit")}
                disabled={isSaving}
              >
                编辑
              </Button>
              <DialogClose asChild>
                <Button variant="secondary">关闭</Button>
              </DialogClose>
            </>
          )}

          {mode === "edit" && (
            <>
              <Button
                variant="outline"
                onClick={() => {
                  setMode("view");
                  setContent(originalContent);
                  setError(null);
                }}
                disabled={isSaving}
              >
                取消
              </Button>
              <Button onClick={handleSave} disabled={isSaving || !hasChanges}>
                {isSaving ? (
                  <>
                    <Loader2 className="size-4 mr-1 animate-spin" />
                    保存中...
                  </>
                ) : (
                  "保存"
                )}
              </Button>
            </>
          )}

          {mode === "create" && (
            <>
              <DialogClose asChild>
                <Button variant="outline" disabled={isSaving}>
                  取消
                </Button>
              </DialogClose>
              <Button
                onClick={handleSave}
                disabled={isSaving || !content.trim() || !fileName.trim()}
              >
                {isSaving ? (
                  <>
                    <Loader2 className="size-4 mr-1 animate-spin" />
                    创建中...
                  </>
                ) : (
                  <>
                    <Plus className="size-4 mr-1" />
                    创建
                  </>
                )}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

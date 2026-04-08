"use client";

import { Button } from "@/components/ui/button";
import { BrushCleaningIcon, Loader2, PlayIcon } from "lucide-react";

interface ToolActionsProps {
  onClear: () => void;
  onCallTool: () => Promise<void>;
  loading: boolean;
  isJsonModeValid: boolean;
  hasNoParams: boolean;
  getShortcutText: () => string;
}

/**
 * 工具操作按钮组件
 *
 * @description 负责工具调试对话框底部的操作按钮，包括清空和调用工具按钮。
 */
export function ToolActions({
  onClear,
  onCallTool,
  loading,
  isJsonModeValid,
  hasNoParams,
  getShortcutText,
}: ToolActionsProps) {
  return (
    <div className="flex justify-end gap-2 pt-4 border-t">
      <Button variant="outline" onClick={onClear} disabled={loading}>
        <BrushCleaningIcon className="h-4 w-4" />
        清空
      </Button>
      <Button
        onClick={onCallTool}
        disabled={
          loading ||
          // 只有有参数工具且在JSON模式时才检查JSON格式
          (!hasNoParams && !isJsonModeValid)
        }
      >
        {loading ? (
          <>
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            调用中...
          </>
        ) : (
          <>
            <PlayIcon className="h-4 w-4" />
            {hasNoParams ? "直接调用" : "调用工具"} ({getShortcutText()})
          </>
        )}
      </Button>
    </div>
  );
}

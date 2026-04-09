"use client";

import { useCallback, useEffect } from "react";
import { toast } from "sonner";

/**
 * 工具调用快捷键 Hook
 *
 * @description 处理工具调试对话框的 Cmd/Ctrl+Enter 快捷键
 * 在对话框打开且不在加载状态时，允许用户通过快捷键快速调用工具
 */

interface UseToolShortcutOptions {
  /** 对话框是否打开 */
  open: boolean;
  /** 是否正在加载 */
  loading: boolean;
  /** 当前工具信息 */
  tool: {
    name: string;
    serverName: string;
    toolName: string;
    description?: string;
    inputSchema?: any;
  } | null;
  /** 当前输入模式 */
  inputMode: "form" | "json";
  /** JSON 输入内容 */
  jsonInput: string;
  /** JSON 验证函数 */
  validateJSON: (jsonString: string) => boolean;
  /** 调用工具的回调函数 */
  handleCallTool: () => Promise<void>;
}

/**
 * 使用工具快捷键
 *
 * @description 在对话框打开时添加键盘事件监听器，处理 Cmd/Ctrl+Enter 快捷键
 *
 * @param options - 快捷键配置选项
 *
 * @example
 * ```tsx
 * useToolShortcut({
 *   open: dialogOpen,
 *   loading: isLoading,
 *   tool: currentTool,
 *   inputMode: "form",
 *   jsonInput: "{}",
 *   validateJSON: (str) => { try { JSON.parse(str); return true; } catch { return false; } },
 *   handleCallTool: async () => { await callTool(); }
 * });
 * ```
 */
export function useToolShortcut(options: UseToolShortcutOptions) {
  const {
    open,
    loading,
    tool,
    inputMode,
    jsonInput,
    validateJSON,
    handleCallTool,
  } = options;

  const handleKeyDown = useCallback(
    async (event: KeyboardEvent) => {
      // 检查是否是 Command+Enter (Mac) 或 Ctrl+Enter (Windows/Linux)
      const isMac = /Mac|iPhone|iPad|iPod/.test(navigator.platform);
      const isShortcutKey = isMac
        ? event.metaKey && event.key === "Enter"
        : event.ctrlKey && event.key === "Enter";

      if (isShortcutKey && open && !loading) {
        // 阻止默认行为
        event.preventDefault();

        // 检查是否无参数工具，或者是有参数工具且JSON模式时验证格式
        const hasNoParams =
          !tool?.inputSchema?.properties ||
          Object.keys(tool.inputSchema.properties).length === 0;

        if (!hasNoParams && inputMode === "json" && !validateJSON(jsonInput)) {
          toast.error("输入参数不是有效的JSON格式");
          return;
        }

        // 调用工具
        await handleCallTool();
      }
    },
    [
      open,
      loading,
      inputMode,
      jsonInput,
      validateJSON,
      handleCallTool,
      tool?.inputSchema?.properties,
    ]
  );

  // 添加键盘事件监听器
  useEffect(() => {
    if (open) {
      window.addEventListener("keydown", handleKeyDown);
      return () => {
        window.removeEventListener("keydown", handleKeyDown);
      };
    }
  }, [open, handleKeyDown]);
}

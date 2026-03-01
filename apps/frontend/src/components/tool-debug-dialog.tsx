"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  createDefaultValues,
  createZodSchemaFromJsonSchema,
} from "@/lib/schema-utils";
import { zodResolver } from "@hookform/resolvers/zod";
import { Zap } from "lucide-react";
import { useCallback, useEffect, useMemo } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import {
  ToolActions,
  ToolInfoCard,
  ToolInputPanel,
  ToolResultPanel,
  useInputModeSync,
  useToolCall,
} from "./tool-debug-dialog-parts";

interface ToolDebugDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tool: {
    name: string;
    serverName: string;
    toolName: string;
    description?: string;
    inputSchema?: any;
  } | null;
}

/**
 * 工具调试对话框组件
 *
 * @description 提供工具调试界面，支持表单模式和 JSON 模式输入参数，展示工具调用结果。
 */
export function ToolDebugDialog({
  open,
  onOpenChange,
  tool,
}: ToolDebugDialogProps) {
  // 创建动态 schema
  const formSchema = useMemo(() => {
    if (!tool?.inputSchema) return z.object({});
    return createZodSchemaFromJsonSchema(tool.inputSchema);
  }, [tool?.inputSchema]);

  // 创建默认值
  const defaultValues = useMemo(() => {
    if (!tool?.inputSchema) return {};
    return createDefaultValues(tool.inputSchema);
  }, [tool?.inputSchema]);

  // 初始化表单
  const form = useForm({
    resolver: zodResolver(formSchema as any),
    defaultValues,
    mode: "onChange",
  });

  // 使用自定义 Hook 管理输入模式同步
  const { inputMode, jsonInput, setJsonInput, handleModeChange, setInputMode } =
    useInputModeSync(form, defaultValues, tool?.inputSchema);

  // 使用自定义 Hook 管理工具调用
  const { result, loading, error, callTool } = useToolCall(tool);

  // 重置状态
  const resetState = useCallback(() => {
    setInputMode("form");
    setJsonInput("{\n  \n}");
    // 只在有工具且有输入schema时才重置表单
    if (tool?.inputSchema) {
      form.reset(defaultValues);
    }
  }, [tool?.inputSchema, defaultValues, form, setInputMode, setJsonInput]);

  // 当弹窗关闭时重置状态
  const handleDialogOpenChange = useCallback(
    (newOpen: boolean) => {
      if (!newOpen) {
        resetState();
      }
      onOpenChange(newOpen);
    },
    [onOpenChange, resetState]
  );

  // 验证JSON格式
  const validateJSON = useCallback((jsonString: string) => {
    try {
      JSON.parse(jsonString);
      return true;
    } catch {
      return false;
    }
  }, []);

  // 调用工具
  const handleCallTool = useCallback(async () => {
    if (!tool) return;

    let args: any;

    // 检查是否无参数工具
    const hasNoParams =
      !tool?.inputSchema?.properties ||
      Object.keys(tool.inputSchema.properties).length === 0;

    if (hasNoParams) {
      // 无参数工具使用空对象
      args = {};
    } else if (inputMode === "form") {
      const values = form.getValues();
      const isValid = await form.trigger();
      if (!isValid) {
        toast.error("请检查表单中的错误");
        return;
      }
      args = values;
    } else {
      // 验证JSON格式
      if (!validateJSON(jsonInput)) {
        toast.error("输入参数不是有效的JSON格式");
        return;
      }
      args = JSON.parse(jsonInput);
    }

    await callTool(args);
  }, [tool, inputMode, form, jsonInput, validateJSON, callTool]);

  // 清空输入
  const handleClear = useCallback(() => {
    if (inputMode === "form" && tool?.inputSchema) {
      // 在表单模式下，重置为默认值
      form.reset(defaultValues);
      try {
        setJsonInput(JSON.stringify(defaultValues, null, 2));
      } catch {
        setJsonInput("{\n  \n}");
      }
    } else {
      // 在JSON模式或无schema时，清空JSON输入
      setJsonInput("{\n  \n}");
      if (tool?.inputSchema) {
        // 如果有schema，也重置表单
        form.reset(defaultValues);
      } else {
        form.reset({});
      }
    }
  }, [inputMode, tool?.inputSchema, defaultValues, form, setJsonInput]);

  // 检测操作系统并获取快捷键文本
  const getShortcutText = useCallback(() => {
    if (typeof window === "undefined") return "⌘+Enter";
    const isMac = /Mac|iPhone|iPad|iPod/.test(navigator.platform);
    return isMac ? "⌘+Enter" : "Ctrl+Enter";
  }, []);

  // 处理键盘事件
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

  return (
    <Dialog open={open} onOpenChange={handleDialogOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5" />
            工具调试
          </DialogTitle>
        </DialogHeader>

        {tool && (
          <div className="flex flex-col gap-4 h-[80vh]">
            <ToolInfoCard tool={tool} />

            <div className="flex-1 flex min-h-0 w-full overflow-hidden">
              <ToolInputPanel
                tool={tool}
                form={form}
                inputMode={inputMode}
                jsonInput={jsonInput}
                onModeChange={handleModeChange}
                onJsonInputChange={setJsonInput}
                loading={loading}
                validateJSON={validateJSON}
              />
              <ToolResultPanel
                result={result}
                error={error}
                loading={loading}
              />
            </div>

            <ToolActions
              onClear={handleClear}
              onCallTool={handleCallTool}
              loading={loading}
              isJsonModeValid={
                inputMode === "json" ? validateJSON(jsonInput) : true
              }
              hasNoParams={
                !tool?.inputSchema?.properties ||
                Object.keys(tool.inputSchema.properties).length === 0
              }
              getShortcutText={getShortcutText}
            />
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

/**
 * MCP 表单对话框 Hook
 *
 * 封装 MCP 服务器添加/编辑对话框的共享逻辑
 * 包括表单/JSON 模式切换、状态管理、表单验证等功能
 */

import { mcpFormSchema } from "@/schemas/mcp-form";
import {
  formToJson,
  jsonToFormData,
} from "@/utils/mcpFormConverter";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useCallback, useState } from "react";
import { useForm } from "react-hook-form";

// 高级模式的 JSON 表单 schema
export const jsonFormSchema = z.object({
  config: z.string().min(2, {
    message: "配置不能为空",
  }),
});

export interface UseMcpFormDialogOptions {
  /** 表单模式的默认值 */
  defaultFormValues: z.infer<typeof mcpFormSchema>;
  /** 高级模式的默认 JSON 配置（可选） */
  defaultJsonConfig?: string;
  /** 对话框关闭时的回调（可选） */
  onDialogClose?: () => void;
}

export function useMcpFormDialog({
  defaultFormValues,
  defaultJsonConfig = "",
  onDialogClose,
}: UseMcpFormDialogOptions) {
  const [open, setOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [inputMode, setInputMode] = useState<"form" | "json">("form");
  const [jsonInput, setJsonInput] = useState<string>(defaultJsonConfig);

  // 表单模式的表单实例
  const form = useForm<z.infer<typeof mcpFormSchema>>({
    resolver: zodResolver(mcpFormSchema),
    defaultValues: defaultFormValues,
  });

  // 高级模式的表单实例
  const advancedForm = useForm<z.infer<typeof jsonFormSchema>>({
    resolver: zodResolver(jsonFormSchema),
    defaultValues: {
      config: defaultJsonConfig,
    },
  });

  // 当弹窗关闭时重置状态
  const handleOpenChange = useCallback(
    (newOpen: boolean) => {
      if (!newOpen) {
        // 重置表单和状态
        form.reset(defaultFormValues);
        advancedForm.reset();
        setJsonInput(defaultJsonConfig);
        setInputMode("form");
        onDialogClose?.();
      }
      setOpen(newOpen);
    },
    [form, advancedForm, defaultFormValues, defaultJsonConfig, onDialogClose]
  );

  // 处理模式切换
  const handleModeChange = useCallback(
    (newMode: string) => {
      if (newMode !== "form" && newMode !== "json") {
        return; // 忽略无效值
      }

      if (newMode === "json" && inputMode === "form") {
        // 表单 → JSON
        const formValues = form.getValues();
        try {
          setJsonInput(formToJson(formValues));
        } catch {
          setJsonInput("");
        }
      } else if (newMode === "form" && inputMode === "json") {
        // JSON → 表单
        const formData = jsonToFormData(jsonInput);
        if (formData) {
          form.reset(formData);
        }
      }
      setInputMode(newMode);
    },
    [inputMode, form, jsonInput]
  );

  return {
    // 对话框状态
    open,
    setOpen,
    isLoading,
    setIsLoading,
    // 模式切换状态
    inputMode,
    setInputMode,
    jsonInput,
    setJsonInput,
    // 表单实例
    form,
    advancedForm,
    // 事件处理器
    handleOpenChange,
    handleModeChange,
    // Schema（供组件使用）
    jsonFormSchema,
  };
}

export type UseMcpFormDialogReturn = ReturnType<typeof useMcpFormDialog>;

/**
 * MCP 配置编辑器组件
 * 用于添加和编辑 MCP 服务配置，支持表单模式和高级模式
 */

import { McpServerForm } from "@/components/mcp-server-form";
import { Button } from "@/components/ui/button";
import { DialogClose, DialogFooter } from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from "@/components/ui/form";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { MCP_CONFIG_PLACEHOLDER_TEXT } from "@/constants/mcp-config-examples";
import type { mcpFormSchema } from "@/schemas/mcp-form";
import { formToJson, jsonToFormData } from "@/utils/mcpFormConverter";
import { zodResolver } from "@hookform/resolvers/zod";
import { useCallback, useState } from "react";
import { type UseFormReturn, useForm } from "react-hook-form";
import { z } from "zod";

// 高级模式的 JSON 表单 schema
const jsonFormSchema = z.object({
  config: z.string().min(2, {
    message: "配置不能为空",
  }),
});

interface MCPConfigEditorProps {
  /** 表单实例（表单模式） */
  form: UseFormReturn<z.infer<typeof mcpFormSchema>>;
  /** 表单默认值（用于重置） */
  defaultValues?: z.infer<typeof mcpFormSchema>;
  /** 表单模式提交回调 */
  onFormSubmit: (values: z.infer<typeof mcpFormSchema>) => Promise<void>;
  /** 高级模式提交回调 */
  onJsonSubmit: (values: z.infer<typeof jsonFormSchema>) => Promise<void>;
  /** 是否禁用表单 */
  disabled?: boolean;
  /** 是否正在加载 */
  isLoading?: boolean;
  /** 提交按钮文本 */
  submitText?: string;
  /** 初始 JSON 配置（用于编辑模式） */
  initialJsonConfig?: string;
}

export function MCPConfigEditor({
  form,
  defaultValues,
  onFormSubmit,
  onJsonSubmit,
  disabled = false,
  isLoading = false,
  submitText = "保存",
  initialJsonConfig = "",
}: MCPConfigEditorProps) {
  const [inputMode, setInputMode] = useState<"form" | "json">("form");
  const [jsonInput, setJsonInput] = useState<string>(initialJsonConfig);

  // 高级模式的表单实例
  const advancedForm = useForm<z.infer<typeof jsonFormSchema>>({
    resolver: zodResolver(jsonFormSchema),
    defaultValues: {
      config: initialJsonConfig,
    },
  });

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
          const jsonStr = formToJson(formValues);
          setJsonInput(jsonStr);
          advancedForm.setValue("config", jsonStr);
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
    [inputMode, form, jsonInput, advancedForm]
  );

  // 重置编辑器状态
  const resetState = useCallback(() => {
    form.reset(defaultValues);
    advancedForm.reset();
    setJsonInput(initialJsonConfig);
    setInputMode("form");
  }, [form, advancedForm, defaultValues, initialJsonConfig]);

  return {
    // 状态和重置方法
    inputMode,
    resetState,
    // 模式切换处理
    handleModeChange,
    // 渲染方法
    renderTabs: () => (
      <Tabs value={inputMode} onValueChange={handleModeChange}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="form">表单模式</TabsTrigger>
          <TabsTrigger value="json">高级模式 (JSON)</TabsTrigger>
        </TabsList>

        {/* 表单模式 */}
        <TabsContent value="form" className="mt-4">
          <McpServerForm
            form={form}
            defaultValues={defaultValues}
            onSubmit={onFormSubmit}
            disabled={disabled}
            submitText={isLoading ? "保存中..." : submitText}
          />
        </TabsContent>

        {/* 高级模式 */}
        <TabsContent value="json" className="mt-4">
          <Form {...advancedForm}>
            <form onSubmit={advancedForm.handleSubmit(onJsonSubmit)}>
              <div className="grid gap-4">
                <FormField
                  control={advancedForm.control}
                  name="config"
                  render={({ field }) => (
                    <FormItem>
                      <FormControl>
                        <Textarea
                          className="resize-none h-[300px] font-mono text-sm"
                          disabled={isLoading}
                          placeholder={MCP_CONFIG_PLACEHOLDER_TEXT}
                          {...field}
                          onChange={(event) => {
                            field.onChange(event);
                            setJsonInput(event.target.value);
                          }}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <DialogFooter className="mt-4">
                <DialogClose asChild>
                  <Button variant="outline" disabled={isLoading}>
                    取消
                  </Button>
                </DialogClose>
                <Button type="submit" disabled={isLoading}>
                  {isLoading ? "保存中..." : "保存"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </TabsContent>
      </Tabs>
    ),
  };
}

// 导出 jsonFormSchema 供外部使用（如果需要）
export { jsonFormSchema };

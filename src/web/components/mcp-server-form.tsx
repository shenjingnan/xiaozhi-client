/**
 * MCP 服务表单组件
 * 用于可视化添加 MCP 服务配置
 * 采用配置驱动的方式自动生成表单字段
 */

import {
  renderFormField,
  renderSelectFieldWithHandler,
} from "@/components/form-fields";
import { Button } from "@/components/ui/button";
import { Form } from "@/components/ui/form";
import { mcpFormFields } from "@/config/mcp-form-fields";
import { mcpFormSchema } from "@/schemas/mcp-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { type UseFormReturn, useForm } from "react-hook-form";
import type { z } from "zod";

interface McpServerFormProps {
  /** 表单实例（可选，如果不提供则内部创建） */
  form?: UseFormReturn<z.infer<typeof mcpFormSchema>>;
  /** 表单默认值 */
  defaultValues?: z.infer<typeof mcpFormSchema>;
  /** 表单提交回调 */
  onSubmit: (values: z.infer<typeof mcpFormSchema>) => void;
  /** 是否禁用表单 */
  disabled?: boolean;
  /** 提交按钮文本 */
  submitText?: string;
}

export function McpServerForm({
  form: externalForm,
  defaultValues,
  onSubmit,
  disabled = false,
  submitText = "保存配置",
}: McpServerFormProps) {
  // 使用外部传入的 form 实例，或者内部创建
  const form: UseFormReturn<z.infer<typeof mcpFormSchema>> =
    externalForm ||
    useForm<z.infer<typeof mcpFormSchema>>({
      resolver: zodResolver(mcpFormSchema),
      defaultValues: defaultValues || {
        type: "stdio",
        name: "",
        command: "",
        env: "",
      },
    });

  // 自定义逻辑：切换类型时重置字段
  const handleTypeChange = (value: "stdio" | "http" | "sse") => {
    form.setValue("type", value);
    // 切换类型时重置部分字段
    // 使用类型断言处理不同类型下的字段差异
    const anyForm = form as unknown as UseFormReturn<Record<string, unknown>>;
    if (value === "stdio") {
      anyForm.setValue("url", "");
      anyForm.setValue("headers", "");
    } else {
      anyForm.setValue("command", "");
      anyForm.setValue("env", "");
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-2">
        {mcpFormFields.map((config) =>
          config.name === "type"
            ? renderSelectFieldWithHandler(
                config,
                form,
                handleTypeChange,
                disabled
              )
            : renderFormField(config, form, disabled)
        )}
        <Button type="submit" className="w-full" disabled={disabled}>
          {submitText}
        </Button>
      </form>
    </Form>
  );
}

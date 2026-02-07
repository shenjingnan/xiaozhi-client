import { zodResolver } from "@hookform/resolvers/zod";
import type {
  CozeWorkflow,
  WorkflowParameter,
} from "@xiaozhi-client/shared-types";
import { Plus, Trash2 } from "lucide-react";
import { useEffect } from "react";
import { useFieldArray, useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

/**
 * 参数验证Schema
 */
const parameterSchema = z.object({
  fieldName: z
    .string()
    .min(1, "字段名不能为空")
    .regex(
      /^[a-zA-Z][a-zA-Z0-9_]*$/,
      "字段名必须以字母开头，只能包含字母、数字和下划线"
    ),
  description: z
    .string()
    .min(1, "描述不能为空")
    .max(200, "描述不能超过200个字符"),
  type: z.enum(["string", "number", "boolean"]),
  required: z.boolean(),
});

/**
 * 表单验证Schema
 */
const formSchema = z.object({
  parameters: z.array(parameterSchema).refine(
    (parameters) => {
      const fieldNames = parameters.map((p) => p.fieldName);
      return fieldNames.length === new Set(fieldNames).size;
    },
    {
      message: "字段名不能重复",
    }
  ),
});

type FormData = z.infer<typeof formSchema>;

/**
 * WorkflowParameterConfigDialog组件属性
 */
export interface WorkflowParameterConfigDialogProps {
  /** 对话框是否打开 */
  open: boolean;
  /** 对话框打开状态变化回调 */
  onOpenChange: (open: boolean) => void;
  /** 工作流信息 */
  workflow: CozeWorkflow;
  /** 确认回调 */
  onConfirm: (workflow: CozeWorkflow, parameters: WorkflowParameter[]) => void;
  /** 取消回调 */
  onCancel: () => void;
  /** 自定义标题 */
  title?: string;
}

/**
 * 从 inputSchema 提取现有参数配置
 */
function extractParametersFromSchema(inputSchema: any): FormData["parameters"] {
  if (!inputSchema || !inputSchema.properties) {
    return [];
  }

  const properties = inputSchema.properties;
  const required = inputSchema.required || [];

  return Object.entries(properties).map(
    ([fieldName, schema]: [string, any]) => {
      let type: "string" | "number" | "boolean" = "string";

      if (schema.type === "integer" || schema.type === "number") {
        type = "number";
      } else if (schema.type === "boolean") {
        type = "boolean";
      }

      return {
        fieldName,
        description: schema.description || "",
        type,
        required: required.includes(fieldName),
      };
    }
  );
}

/**
 * 工作流参数配置对话框组件
 *
 * 提供通用的工作流参数配置界面，支持：
 * - 动态添加/删除参数
 * - 参数类型选择（string/number/boolean）
 * - 字段名和描述验证
 * - 必填参数设置
 */
export function WorkflowParameterConfigDialog({
  open,
  onOpenChange,
  workflow,
  onConfirm,
  onCancel,
  title,
}: WorkflowParameterConfigDialogProps) {
  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      parameters: [],
    },
  });

  useEffect(() => {
    if (open) {
      form.reset({
        parameters: extractParametersFromSchema(workflow.inputSchema),
      });
    }
  }, [open, workflow, form.reset, form]);

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "parameters",
  });

  /**
   * 添加新参数
   */
  const handleAddParameter = () => {
    append({
      fieldName: "",
      description: "",
      type: "string",
      required: false,
    });
  };

  /**
   * 删除参数
   */
  const handleRemoveParameter = (index: number) => {
    remove(index);
  };

  /**
   * 表单提交处理
   */
  const handleSubmit = (data: FormData) => {
    onConfirm(workflow, data.parameters);
    form.reset();
  };

  /**
   * 取消处理
   */
  const handleCancel = () => {
    form.reset();
    onCancel();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {title || `配置工作流参数 - ${workflow.workflow_name}`}
          </DialogTitle>
          <DialogDescription>
            为工作流配置输入参数，这些参数将用于生成工具的输入架构。
            您可以跳过此步骤使用默认的空参数配置。
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(handleSubmit)}
            className="space-y-6"
          >
            <div className="space-y-4 mb-10">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-medium">参数列表</h3>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleAddParameter}
                  className="flex items-center gap-2"
                >
                  <Plus className="h-4 w-4" />
                  添加参数
                </Button>
              </div>

              {fields.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  暂无参数，点击"添加参数"开始配置
                </div>
              )}

              {fields.map((field, index) => (
                <div key={field.id} className="flex gap-2">
                  <FormField
                    control={form.control}
                    name={`parameters.${index}.fieldName`}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>字段名</FormLabel>
                        <FormControl>
                          <Input placeholder="例如: userName" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name={`parameters.${index}.description`}
                    render={({ field }) => (
                      <FormItem className="flex-1">
                        <FormLabel>描述</FormLabel>
                        <FormControl>
                          <Input placeholder="例如: 用户名称" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name={`parameters.${index}.type`}
                    render={({ field }) => (
                      <FormItem className="w-[140px]">
                        <FormLabel>参数类型</FormLabel>
                        <Select
                          onValueChange={field.onChange}
                          defaultValue={field.value}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="选择参数类型" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="string">string</SelectItem>
                            <SelectItem value="number">number</SelectItem>
                            <SelectItem value="boolean">boolean</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name={`parameters.${index}.required`}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>是否必填</FormLabel>
                        <FormControl>
                          <div className="flex items-center justify-center h-[40px]">
                            <Checkbox
                              checked={field.value}
                              onCheckedChange={field.onChange}
                            />
                          </div>
                        </FormControl>
                      </FormItem>
                    )}
                  />

                  <div className="flex flex-col h-[72px] justify-end">
                    <Button
                      type="button"
                      variant="link"
                      size="sm"
                      onClick={() => handleRemoveParameter(index)}
                      className="text-destructive mb-[4px]"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={handleCancel}>
                取消
              </Button>
              <Button type="submit">确认配置</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

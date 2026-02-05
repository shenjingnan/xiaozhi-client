"use client";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  createDefaultValues,
  createZodSchemaFromJsonSchema,
} from "@/lib/schema-utils";
import { apiClient } from "@/services/api";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  AlertCircle,
  BrushCleaningIcon,
  CheckIcon,
  Code,
  CopyIcon,
  InfoIcon,
  Loader2,
  PlayIcon,
  Plus,
  Trash2,
  Zap,
} from "lucide-react";
import type React from "react";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Controller, useFieldArray, useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

// 数组字段渲染器组件
interface ArrayFieldProps {
  name: string;
  schema: any;
  form: any;
  renderFormField: (
    fieldName: string,
    fieldSchema: any
  ) => React.ReactElement | null;
}

const ArrayField = memo(function ArrayField({
  name,
  schema,
  form,
  renderFormField,
}: ArrayFieldProps) {
  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: name as any,
  });

  const addItem = () => {
    const itemSchema = schema.items;
    let newItem: any;

    switch (itemSchema.type) {
      case "string":
        newItem = itemSchema.enum ? itemSchema.enum[0] : "";
        break;
      case "number":
      case "integer":
        newItem = 0;
        break;
      case "boolean":
        newItem = false;
        break;
      case "array":
        newItem = [];
        break;
      case "object":
        newItem = {};
        break;
      default:
        newItem = "";
    }

    append(newItem);
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">
          数组项目 ({schema.items?.type || "unknown"})
        </span>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={addItem}
          className="h-8 px-2"
        >
          <Plus className="h-3 w-3 mr-1" />
          添加
        </Button>
      </div>
      {fields.length === 0 ? (
        <div className="text-center py-4 border border-dashed rounded-md">
          <span className="text-sm text-muted-foreground">暂无数组项目</span>
        </div>
      ) : (
        <div className="space-y-3">
          {fields.map((field, index) => (
            <div
              key={field.id}
              className="relative p-3 border rounded-md bg-muted/20"
            >
              <div className="absolute top-2 right-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => remove(index)}
                  className="h-6 w-6 p-0 text-red-500 hover:text-red-700"
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
              <div className="pr-8">
                <span className="text-xs font-medium text-muted-foreground mb-2 block">
                  项目 {index + 1}
                </span>
                <FormField
                  control={form.control}
                  name={`${name}.${index}` as any}
                  render={() => (
                    <FormItem>
                      {(() => {
                        if (
                          schema.items?.type === "object" ||
                          schema.items?.type === "array"
                        ) {
                          return (
                            <div className="ml-6 border-l-2 border-muted pl-4">
                              {renderFormField(
                                `${name}.${index}`,
                                schema.items
                              )}
                            </div>
                          );
                        }
                        return renderFormField(
                          `${name}.${index}`,
                          schema.items
                        );
                      })()}
                    </FormItem>
                  )}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
});

// 对象字段渲染器组件
interface ObjectFieldProps {
  name: string;
  schema: any;
  form: any;
  renderFormField: (
    fieldName: string,
    fieldSchema: any
  ) => React.ReactElement | null;
  getTypeBadge: (type: string) => string;
}

const ObjectField = memo(function ObjectField({
  name,
  schema,
  form,
  renderFormField,
  getTypeBadge,
}: ObjectFieldProps) {
  if (!schema.properties || Object.keys(schema.properties).length === 0) {
    return (
      <div className="text-center py-4 border border-dashed rounded-md">
        <span className="text-sm text-muted-foreground">对象无定义字段</span>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <span className="text-sm font-medium">对象字段</span>
      {Object.entries(schema.properties).map(
        ([fieldName, fieldSchema]: [string, any]) => (
          <div
            key={`${name}-${fieldName}`}
            className="ml-6 border-l-2 border-muted pl-4"
          >
            <FormField
              control={form.control}
              name={`${name}.${fieldName}` as any}
              render={() => (
                <FormItem>
                  <div className="flex items-center gap-2">
                    <FormLabel>
                      {schema.required?.includes(fieldName) && (
                        <span className="text-red-500 mr-1">*</span>
                      )}
                      {fieldName}
                    </FormLabel>
                    <Badge
                      variant="secondary"
                      className={`text-xs ${getTypeBadge(fieldSchema.type)}`}
                    >
                      {fieldSchema.type}
                    </Badge>
                    {fieldSchema.description && (
                      <Tooltip>
                        <TooltipTrigger>
                          <InfoIcon className="h-4 w-4 text-muted-foreground" />
                        </TooltipTrigger>
                        <TooltipContent>
                          <p className="max-w-xs whitespace-pre-wrap">
                            {fieldSchema.description}
                          </p>
                        </TooltipContent>
                      </Tooltip>
                    )}
                  </div>
                  {renderFormField(`${name}.${fieldName}`, fieldSchema)}
                  {fieldSchema.description && (
                    <FormDescription>{fieldSchema.description}</FormDescription>
                  )}
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        )
      )}
    </div>
  );
});

// 无参数提示组件
const NoParamsMessage = memo(function NoParamsMessage() {
  return (
    <div className="h-full flex items-center justify-center">
      <div className="text-center space-y-4 max-w-sm mx-auto p-6">
        <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
          <CheckIcon className="h-8 w-8 text-green-600" />
        </div>
        <div className="space-y-2">
          <h3 className="text-lg font-semibold text-foreground">
            无需输入参数
          </h3>
          <p className="text-sm text-muted-foreground">
            点击"调用工具"按钮执行，无需输入任何参数。
          </p>
        </div>
      </div>
    </div>
  );
});

// 表单渲染器组件
interface FormRendererProps {
  tool: ToolDebugDialogProps["tool"];
  form: any;
  renderFormField: (
    fieldName: string,
    fieldSchema: any
  ) => React.ReactElement | null;
}

const FormRenderer = memo(function FormRenderer({
  tool,
  form,
  renderFormField,
}: FormRendererProps) {
  if (!tool?.inputSchema?.properties) {
    return (
      <div className="text-center py-8">
        <Code className="h-8 w-8 mx-auto mb-2 opacity-50" />
        <p className="text-muted-foreground">该工具无参数定义</p>
      </div>
    );
  }

  return (
    <Form {...form}>
      <ScrollArea className="h-full">
        <div className="space-y-4 p-2">
          {Object.entries(tool.inputSchema.properties).map(
            ([fieldName, fieldSchema]: [string, any]) => (
              <FormField
                key={`${tool.name}-${fieldName}`} // 添加工具名称作为前缀，确保 key 的唯一性和稳定性
                control={form.control}
                name={fieldName as any}
                render={() => (
                  <FormItem>
                    <div className="flex items-center gap-2">
                      <FormLabel>
                        {tool.inputSchema.required?.includes(fieldName) && (
                          <span className="text-red-500 mr-1">*</span>
                        )}
                        {fieldName}
                      </FormLabel>
                      <Badge
                        variant="secondary"
                        className={`text-xs ${
                          fieldSchema.type === "string"
                            ? "bg-blue-100 text-blue-800"
                            : fieldSchema.type === "number" ||
                                fieldSchema.type === "integer"
                              ? "bg-green-100 text-green-800"
                              : fieldSchema.type === "boolean"
                                ? "bg-purple-100 text-purple-800"
                                : fieldSchema.type === "array"
                                  ? "bg-orange-100 text-orange-800"
                                  : fieldSchema.type === "object"
                                    ? "bg-gray-100 text-gray-800"
                                    : "bg-gray-100 text-gray-800"
                        }`}
                      >
                        {fieldSchema.type}
                      </Badge>
                      {fieldSchema.description && (
                        <Tooltip>
                          <TooltipTrigger>
                            <InfoIcon className="h-4 w-4 text-muted-foreground" />
                          </TooltipTrigger>
                          <TooltipContent>
                            <p className="max-w-xs whitespace-pre-wrap">
                              {fieldSchema.description}
                            </p>
                          </TooltipContent>
                        </Tooltip>
                      )}
                    </div>
                    {renderFormField(fieldName, fieldSchema)}
                    <FormMessage />
                  </FormItem>
                )}
              />
            )
          )}
        </div>
      </ScrollArea>
    </Form>
  );
});

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

export function ToolDebugDialog({
  open,
  onOpenChange,
  tool,
}: ToolDebugDialogProps) {
  const [inputMode, setInputMode] = useState<"form" | "json">("form");
  const [jsonInput, setJsonInput] = useState<string>("{\n  \n}");
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const copiedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  // 当工具变化时重置表单
  useEffect(() => {
    if (tool?.inputSchema) {
      // 重置表单到默认值
      form.reset(defaultValues);
      try {
        setJsonInput(JSON.stringify(defaultValues, null, 2));
      } catch {
        setJsonInput("{\n  \n}");
      }
    } else {
      form.reset({});
      setJsonInput("{\n  \n}");
    }
  }, [tool?.inputSchema, defaultValues, form]); // 添加 form 依赖以满足 linter 要求

  useEffect(() => {
    return () => {
      if (copiedTimerRef.current) {
        clearTimeout(copiedTimerRef.current);
      }
    };
  }, []);

  // 重置状态
  const resetState = useCallback(() => {
    setInputMode("form");
    setJsonInput("{\n  \n}");
    setResult(null);
    setError(null);
    setCopied(false);
    // 只在有工具且有输入schema时才重置表单
    if (tool?.inputSchema) {
      form.reset(defaultValues);
    }
  }, [tool?.inputSchema, defaultValues, form]);

  // 处理Tab切换
  const handleModeChange = useCallback(
    (newMode: "form" | "json") => {
      if (newMode === "json" && inputMode === "form") {
        // 从表单模式切换到JSON模式时，同步数据
        const currentValues = form.getValues();
        try {
          setJsonInput(JSON.stringify(currentValues, null, 2));
        } catch {
          setJsonInput("{\n  \n}");
        }
      } else if (newMode === "form" && inputMode === "json") {
        // 从JSON模式切换到表单模式时，同步数据
        try {
          const parsedData = JSON.parse(jsonInput);
          // 使用 setValue 而不是 reset 来避免表单重新初始化导致的失焦
          for (const key of Object.keys(parsedData)) {
            form.setValue(key as any, parsedData[key]);
          }
        } catch {
          // JSON 解析失败，保持表单数据不变
        }
      }
      setInputMode(newMode);
    },
    [inputMode, jsonInput, form]
  );

  // 当弹窗关闭时重置状态
  const handleOpenChange = useCallback(
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

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const response = await apiClient.callTool(
        tool.serverName,
        tool.toolName,
        args
      );

      setResult(response);
      toast.success("工具调用成功");
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "调用工具失败";
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [tool, inputMode, form, jsonInput, validateJSON]);

  // 复制结果
  const handleCopy = useCallback(async () => {
    const content = result ? JSON.stringify(result, null, 2) : error || "";
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      toast.success("已复制到剪贴板");
      if (copiedTimerRef.current) {
        clearTimeout(copiedTimerRef.current);
      }
      copiedTimerRef.current = setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("复制失败");
    }
  }, [result, error]);

  // 清空输入
  const handleClear = useCallback(() => {
    setResult(null);
    setError(null);

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
  }, [inputMode, tool?.inputSchema, defaultValues, form]);

  // 渲染表单字段的辅助函数 - 使用 useMemo 优化性能
  const renderFormField = useMemo(() => {
    const getTypeBadge = (type: string) => {
      const colors: Record<string, string> = {
        string: "bg-blue-100 text-blue-800",
        number: "bg-green-100 text-green-800",
        integer: "bg-green-100 text-green-800",
        boolean: "bg-purple-100 text-purple-800",
        array: "bg-orange-100 text-orange-800",
        object: "bg-gray-100 text-gray-800",
      };

      return colors[type] || "bg-gray-100 text-gray-800";
    };

    return (fieldName: string, fieldSchema: any): React.ReactElement | null => {
      switch (fieldSchema.type) {
        case "string":
          if (fieldSchema.enum) {
            return (
              <Controller
                name={fieldName as any}
                control={form.control}
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder={`选择${fieldName}`} />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {fieldSchema.enum.map((option: string) => (
                        <SelectItem key={option} value={option}>
                          {option}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            );
          }
          return (
            <Controller
              name={fieldName as any}
              control={form.control}
              render={({ field }) => (
                <FormControl>
                  <Input
                    {...field}
                    placeholder={`输入${fieldName}`}
                    type={
                      fieldSchema.format === "password" ? "password" : "text"
                    }
                  />
                </FormControl>
              )}
            />
          );

        case "number":
        case "integer":
          return (
            <Controller
              name={fieldName as any}
              control={form.control}
              render={({ field }) => (
                <FormControl>
                  <Input
                    {...field}
                    type="number"
                    placeholder={`输入${fieldName}`}
                    step={fieldSchema.type === "integer" ? "1" : "0.1"}
                    onChange={(e) => {
                      const value = e.target.value;
                      field.onChange(value === "" ? "" : Number(value));
                    }}
                  />
                </FormControl>
              )}
            />
          );

        case "boolean":
          return (
            <Controller
              name={fieldName as any}
              control={form.control}
              render={({ field }) => (
                <Select
                  value={field.value?.toString()}
                  onValueChange={(value) => field.onChange(value === "true")}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder={`选择${fieldName}`} />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="true">true</SelectItem>
                    <SelectItem value="false">false</SelectItem>
                  </SelectContent>
                </Select>
              )}
            />
          );

        case "array":
          return (
            <ArrayField
              name={fieldName}
              schema={fieldSchema}
              form={form}
              renderFormField={renderFormField}
            />
          );

        case "object":
          return (
            <ObjectField
              name={fieldName}
              schema={fieldSchema}
              form={form}
              renderFormField={renderFormField}
              getTypeBadge={getTypeBadge}
            />
          );

        default:
          return (
            <Controller
              name={fieldName as any}
              control={form.control}
              render={({ field }) => (
                <FormControl>
                  <Input {...field} placeholder={`输入${fieldName}`} />
                </FormControl>
              )}
            />
          );
      }
    };
  }, [form]);

  // 格式化结果显示
  const formatResult = useCallback((data: any) => {
    try {
      return JSON.stringify(data, null, 2);
    } catch {
      return String(data);
    }
  }, []);

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
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <TooltipProvider>
        <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5" />
              工具调试
            </DialogTitle>
          </DialogHeader>

          {tool && (
            <div className="flex flex-col gap-4 h-[80vh]">
              {/* 工具信息 */}
              <Card>
                <CardHeader className="pb-0">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Badge variant="secondary">{tool.serverName}</Badge>
                    {tool.toolName}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {tool.description && (
                    <p className="text-sm text-muted-foreground mt-2">
                      {tool.description}
                    </p>
                  )}
                </CardContent>
              </Card>

              {/* 输入参数 */}
              <div className="flex-1 flex min-h-0 w-full overflow-hidden">
                <div className="w-1/2 flex flex-col gap-2 flex-shrink-0 overflow-hidden pr-0.5">
                  <div className="flex items-center justify-between h-[40px]">
                    <h3 className="text-sm font-medium">输入参数</h3>
                    {tool?.inputSchema?.properties &&
                      Object.keys(tool.inputSchema.properties).length > 0 && (
                        <Tabs
                          value={inputMode}
                          onValueChange={(value) =>
                            handleModeChange(value as "form" | "json")
                          }
                        >
                          <TabsList className="grid w-full grid-cols-2">
                            <TabsTrigger value="form" className="text-xs">
                              表单模式
                            </TabsTrigger>
                            <TabsTrigger value="json" className="text-xs">
                              高级模式
                            </TabsTrigger>
                          </TabsList>
                        </Tabs>
                      )}
                  </div>
                  <div className="flex-1 min-h-0">
                    {tool?.inputSchema?.properties &&
                    Object.keys(tool.inputSchema.properties).length > 0 ? (
                      <Tabs
                        value={inputMode}
                        onValueChange={(value) =>
                          handleModeChange(value as "form" | "json")
                        }
                        className="h-full flex flex-col"
                      >
                        <TabsContent
                          value="form"
                          className="flex-1 data-[state=active]:flex data-[state=active]:flex-col mt-0"
                        >
                          <FormRenderer
                            tool={tool}
                            form={form}
                            renderFormField={renderFormField}
                          />
                        </TabsContent>
                        <TabsContent
                          value="json"
                          className="flex-1 data-[state=active]:flex data-[state=active]:flex-col mt-0"
                        >
                          <div className="flex-1 flex flex-col">
                            <Textarea
                              value={jsonInput}
                              onChange={(e) => setJsonInput(e.target.value)}
                              placeholder="请输入JSON格式的参数..."
                              className="flex-1 font-mono text-sm resize-none min-h-[200px]"
                              disabled={loading}
                            />
                            {!validateJSON(jsonInput) &&
                              jsonInput.trim() !== "{\n  \n}" && (
                                <Alert className="mt-2">
                                  <AlertCircle className="h-4 w-4" />
                                  <AlertDescription>
                                    JSON格式错误，请检查输入
                                  </AlertDescription>
                                </Alert>
                              )}
                          </div>
                        </TabsContent>
                      </Tabs>
                    ) : (
                      <NoParamsMessage />
                    )}
                  </div>
                </div>

                {/* 结果显示 */}
                <div className="w-1/2 flex flex-col gap-2 flex-shrink-0 overflow-hidden pl-0.5">
                  <div className="flex items-center justify-between h-[40px]">
                    <h3 className="text-sm font-medium">调用结果</h3>
                    {(result || error) && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleCopy}
                        className="gap-0"
                      >
                        {copied ? (
                          <>
                            <CheckIcon className="h-4 w-4 mr-1" />
                            已复制
                          </>
                        ) : (
                          <>
                            <CopyIcon className="h-4 w-4 mr-1" />
                            复制结果
                          </>
                        )}
                      </Button>
                    )}
                  </div>
                  <div className="flex-1 min-h-0">
                    {loading ? (
                      <div className="h-full flex items-center justify-center border rounded-md">
                        <div className="flex flex-col items-center gap-2">
                          <Loader2 className="h-8 w-8 animate-spin" />
                          <span className="text-sm text-muted-foreground">
                            正在调用工具...
                          </span>
                        </div>
                      </div>
                    ) : error ? (
                      <div className="h-full">
                        <Alert variant="destructive" className="h-full">
                          <AlertDescription className="font-mono text-sm whitespace-pre-wrap break-words">
                            {error}
                          </AlertDescription>
                        </Alert>
                      </div>
                    ) : result ? (
                      <ScrollArea className="h-full border rounded-md">
                        <pre className="p-3 text-sm font-mono whitespace-pre-wrap break-words min-w-0">
                          {formatResult(result)}
                        </pre>
                      </ScrollArea>
                    ) : (
                      <div className="h-full flex items-center justify-center border rounded-md">
                        <div className="text-center text-muted-foreground">
                          <Code className="h-8 w-8 mx-auto mb-2 opacity-50" />
                          <p>等待调用工具...</p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* 底部操作按钮 */}
              <div className="flex justify-end gap-2 pt-4 border-t">
                <Button
                  variant="outline"
                  onClick={handleClear}
                  disabled={loading}
                >
                  <BrushCleaningIcon className="h-4 w-4" />
                  清空
                </Button>
                <Button
                  onClick={handleCallTool}
                  disabled={
                    loading ||
                    // 只有有参数工具且在JSON模式时才检查JSON格式
                    (() => {
                      const hasNoParams =
                        !tool?.inputSchema?.properties ||
                        Object.keys(tool.inputSchema.properties).length === 0;
                      return (
                        !hasNoParams &&
                        inputMode === "json" &&
                        !validateJSON(jsonInput)
                      );
                    })()
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
                      {(() => {
                        const hasNoParams =
                          !tool?.inputSchema?.properties ||
                          Object.keys(tool.inputSchema.properties).length === 0;
                        return hasNoParams ? "直接调用" : "调用工具";
                      })()} ({getShortcutText()})
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </TooltipProvider>
    </Dialog>
  );
}

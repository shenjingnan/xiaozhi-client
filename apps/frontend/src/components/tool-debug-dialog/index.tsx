/**
 * 工具调试对话框组件
 *
 * @description 提供工具调试功能的对话框组件，支持表单模式和 JSON 模式两种输入方式。
 * 用户可以通过此对话框查看工具信息、输入参数并调用工具查看结果。
 */

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
import { FormControl } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ScrollArea } from "@/components/ui/scroll-area";
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
  Loader2,
  PlayIcon,
  Zap,
} from "lucide-react";
import type React from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { ArrayField } from "./array-field";
import { FormRenderer } from "./form-renderer";
import { NoParamsMessage } from "./no-params-message";
import { ObjectField } from "./object-field";
import type { ToolDebugDialogProps } from "./types";

/**
 * 获取类型徽章颜色类
 *
 * @param type - 字段类型
 * @returns 对应的 CSS 类名
 */
const getTypeBadgeColor = (type: string): string => {
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

/**
 * 工具调试对话框组件
 *
 * @param props - 组件属性
 * @param props.open - 对话框是否打开
 * @param props.onOpenChange - 打开状态变化回调
 * @param props.tool - 工具信息对象
 */
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
  }, [tool?.inputSchema, defaultValues, form]);

  // 清理定时器
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
    if (tool?.inputSchema) {
      form.reset(defaultValues);
    }
  }, [tool?.inputSchema, defaultValues, form]);

  // 处理Tab切换
  const handleModeChange = useCallback(
    (newMode: "form" | "json") => {
      if (newMode === "json" && inputMode === "form") {
        const currentValues = form.getValues();
        try {
          setJsonInput(JSON.stringify(currentValues, null, 2));
        } catch {
          setJsonInput("{\n  \n}");
        }
      } else if (newMode === "form" && inputMode === "json") {
        try {
          const parsedData = JSON.parse(jsonInput);
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

    const hasNoParams =
      !tool?.inputSchema?.properties ||
      Object.keys(tool.inputSchema.properties).length === 0;

    if (hasNoParams) {
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
      form.reset(defaultValues);
      try {
        setJsonInput(JSON.stringify(defaultValues, null, 2));
      } catch {
        setJsonInput("{\n  \n}");
      }
    } else {
      setJsonInput("{\n  \n}");
      if (tool?.inputSchema) {
        form.reset(defaultValues);
      } else {
        form.reset({});
      }
    }
  }, [inputMode, tool?.inputSchema, defaultValues, form]);

  // 渲染表单字段
  const renderFormField = useMemo(() => {
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
              getTypeBadge={getTypeBadgeColor}
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

  // 获取快捷键文本
  const getShortcutText = useCallback(() => {
    if (typeof window === "undefined") return "⌘+Enter";
    const isMac = /Mac|iPhone|iPad|iPod/.test(navigator.platform);
    return isMac ? "⌘+Enter" : "Ctrl+Enter";
  }, []);

  // 处理键盘事件
  const handleKeyDown = useCallback(
    async (event: KeyboardEvent) => {
      const isMac = /Mac|iPhone|iPad|iPod/.test(navigator.platform);
      const isShortcutKey = isMac
        ? event.metaKey && event.key === "Enter"
        : event.ctrlKey && event.key === "Enter";

      if (isShortcutKey && open && !loading) {
        event.preventDefault();

        const hasNoParams =
          !tool?.inputSchema?.properties ||
          Object.keys(tool.inputSchema.properties).length === 0;
        if (!hasNoParams && inputMode === "json" && !validateJSON(jsonInput)) {
          toast.error("输入参数不是有效的JSON格式");
          return;
        }

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

  // 检查是否无参数工具
  const hasNoParams =
    !tool?.inputSchema?.properties ||
    Object.keys(tool.inputSchema.properties).length === 0;

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
                    (!hasNoParams && inputMode === "json" && !validateJSON(jsonInput))
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
            </div>
          )}
        </DialogContent>
      </TooltipProvider>
    </Dialog>
  );
}
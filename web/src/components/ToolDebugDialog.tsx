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
import { apiClient } from "@/services/api";
import {
  AlertCircle,
  CheckIcon,
  Code,
  CopyIcon,
  InfoIcon,
  Loader2,
  PlayIcon,
  Plus,
  RotateCcwIcon,
  Trash2,
  Zap,
} from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { toast } from "sonner";

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
  const [inputParams, setInputParams] = useState<string>("{\n  \n}");
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [inputMode, setInputMode] = useState<"form" | "json">("form");
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // 初始化表单数据
  const initializeFormData = useCallback((schema: any) => {
    if (!schema || !schema.properties) return {};

    const initValue = (schema: any, key: string): any => {
      const prop = schema.properties[key];
      if (!prop) return undefined;

      if (schema.required?.includes(key)) {
        // 根据类型设置默认值
        switch (prop.type) {
          case "string":
            return prop.enum ? prop.enum[0] : "";
          case "number":
          case "integer":
            return 0;
          case "boolean":
            return false;
          case "array":
            return [];
          case "object":
            return {};
          default:
            return "";
        }
      }
      return undefined;
    };

    const data: Record<string, any> = {};
    for (const key of Object.keys(schema.properties)) {
      const value = initValue(schema, key);
      if (value !== undefined) {
        data[key] = value;
      }
    }

    return data;
  }, []);

  // 重置状态
  const resetState = useCallback(() => {
    setInputParams("{\n  \n}");
    setFormData({});
    setInputMode("form");
    setResult(null);
    setError(null);
    setCopied(false);
  }, []);

  // 表单数据转JSON字符串
  const formDataToJson = useCallback((data: Record<string, any>): string => {
    try {
      return JSON.stringify(data, null, 2);
    } catch {
      return "{}";
    }
  }, []);

  // JSON字符串转表单数据
  const jsonToFormData = useCallback(
    (jsonString: string): Record<string, any> => {
      try {
        return JSON.parse(jsonString);
      } catch {
        return {};
      }
    },
    []
  );

  // 当工具变化时初始化表单数据
  useMemo(() => {
    if (tool?.inputSchema && inputMode === "form") {
      const initialData = initializeFormData(tool.inputSchema);
      setFormData(initialData);
      setInputParams(formDataToJson(initialData));
    }
  }, [tool, inputMode, initializeFormData, formDataToJson]);

  // 处理Tab切换
  const handleModeChange = useCallback(
    (newMode: "form" | "json") => {
      if (newMode === "json" && inputMode === "form") {
        // 从表单模式切换到JSON模式时，同步数据
        setInputParams(formDataToJson(formData));
      } else if (newMode === "form" && inputMode === "json") {
        // 从JSON模式切换到表单模式时，同步数据
        const parsedData = jsonToFormData(inputParams);
        setFormData(parsedData);
      }
      setInputMode(newMode);
    },
    [inputMode, formData, inputParams, formDataToJson, jsonToFormData]
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

    if (inputMode === "form") {
      args = formData;
    } else {
      // 验证JSON格式
      if (!validateJSON(inputParams)) {
        toast.error("输入参数不是有效的JSON格式");
        return;
      }
      args = JSON.parse(inputParams);
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
  }, [tool, inputMode, formData, inputParams, validateJSON]);

  // 复制结果
  const handleCopy = useCallback(async () => {
    const content = result ? JSON.stringify(result, null, 2) : error || "";
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      toast.success("已复制到剪贴板");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("复制失败");
    }
  }, [result, error]);

  // 清空输入
  const handleClear = useCallback(() => {
    if (inputMode === "form" && tool?.inputSchema) {
      const initialData = initializeFormData(tool.inputSchema);
      setFormData(initialData);
      setInputParams(formDataToJson(initialData));
    } else {
      setInputParams("{\n  \n}");
      setFormData({});
    }
    setResult(null);
    setError(null);
  }, [inputMode, tool, initializeFormData, formDataToJson]);

  // 动态表单字段渲染器
  interface FormFieldProps {
    name: string;
    schema: any;
    value: any;
    onChange: (value: any) => void;
    required?: boolean;
    level?: number;
  }

  function FormField({
    name,
    schema,
    value,
    onChange,
    required = false,
    level = 0,
  }: FormFieldProps) {
    const renderField = () => {
      switch (schema.type) {
        case "string":
          if (schema.enum) {
            return (
              <Select value={value} onValueChange={onChange}>
                <SelectTrigger>
                  <SelectValue placeholder={`选择${name}`} />
                </SelectTrigger>
                <SelectContent>
                  {schema.enum.map((option: string) => (
                    <SelectItem key={option} value={option}>
                      {option}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            );
          }
          return (
            <Input
              value={value || ""}
              onChange={(e) => onChange(e.target.value)}
              placeholder={`输入${name}`}
              type={schema.format === "password" ? "password" : "text"}
            />
          );

        case "number":
        case "integer":
          return (
            <Input
              type="number"
              value={value || ""}
              onChange={(e) =>
                onChange(
                  schema.type === "integer"
                    ? Number.parseInt(e.target.value) || 0
                    : Number.parseFloat(e.target.value) || 0
                )
              }
              placeholder={`输入${name}`}
              step={schema.type === "integer" ? "1" : "0.1"}
            />
          );

        case "boolean":
          return (
            <Select
              value={value?.toString()}
              onValueChange={(val) => onChange(val === "true")}
            >
              <SelectTrigger>
                <SelectValue placeholder={`选择${name}`} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="true">true</SelectItem>
                <SelectItem value="false">false</SelectItem>
              </SelectContent>
            </Select>
          );

        case "array":
          return (
            <ArrayField
              name={name}
              schema={schema}
              value={value || []}
              onChange={onChange}
              level={level}
            />
          );

        case "object":
          return (
            <ObjectField
              name={name}
              schema={schema}
              value={value || {}}
              onChange={onChange}
              level={level}
            />
          );

        default:
          return (
            <Input
              value={value || ""}
              onChange={(e) => onChange(e.target.value)}
              placeholder={`输入${name}`}
            />
          );
      }
    };

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

    return (
      <div
        className={`space-y-2 ${
          level > 0 ? "ml-6 border-l-2 border-muted pl-4" : ""
        }`}
      >
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">
            {required && <span className="text-red-500 mr-1">*</span>}
            {name}
          </span>
          <Badge
            variant="secondary"
            className={`text-xs ${getTypeBadge(schema.type)}`}
          >
            {schema.type}
          </Badge>
          {/* TODO: 我希望，鼠标移动到这个 InfoIcon 时，才展示 schema.description */}
          <InfoIcon />
          {schema.description && (
            <span className="text-xs text-muted-foreground">
              ({schema.description})
            </span>
          )}
        </div>
        {renderField()}
      </div>
    );
  }

  // 数组字段渲染器
  interface ArrayFieldProps {
    name: string;
    schema: any;
    value: any[];
    onChange: (value: any[]) => void;
    level: number;
  }

  function ArrayField({
    name,
    schema,
    value,
    onChange,
    level,
  }: ArrayFieldProps) {
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

      onChange([...value, newItem]);
    };

    const removeItem = (index: number) => {
      onChange(value.filter((_, i) => i !== index));
    };

    const updateItem = (index: number, itemValue: any) => {
      const newValue = [...value];
      newValue[index] = itemValue;
      onChange(newValue);
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
        {value.length === 0 ? (
          <div className="text-center py-4 border border-dashed rounded-md">
            <span className="text-sm text-muted-foreground">暂无数组项目</span>
          </div>
        ) : (
          <div className="space-y-3">
            {value.map((item, index) => (
              <div
                key={`${name}-${index}-${JSON.stringify(item)}`}
                className="relative p-3 border rounded-md bg-muted/20"
              >
                <div className="absolute top-2 right-2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => removeItem(index)}
                    className="h-6 w-6 p-0 text-red-500 hover:text-red-700"
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
                <div className="pr-8">
                  <span className="text-xs font-medium text-muted-foreground mb-2 block">
                    项目 {index + 1}
                  </span>
                  {schema.items?.type === "object" ||
                  schema.items?.type === "array" ? (
                    <FormField
                      name={`${name}[${index}]`}
                      schema={schema.items}
                      value={item}
                      onChange={(newValue) => updateItem(index, newValue)}
                      level={level + 1}
                    />
                  ) : (
                    <FormField
                      name={`${name}[${index}]`}
                      schema={schema.items}
                      value={item}
                      onChange={(newValue) => updateItem(index, newValue)}
                      level={0}
                    />
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  // 对象字段渲染器
  interface ObjectFieldProps {
    name: string;
    schema: any;
    value: Record<string, any>;
    onChange: (value: Record<string, any>) => void;
    level: number;
  }

  function ObjectField({ schema, value, onChange, level }: ObjectFieldProps) {
    const updateField = (fieldName: string, fieldValue: any) => {
      onChange({
        ...value,
        [fieldName]: fieldValue,
      });
    };

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
            <FormField
              key={fieldName}
              name={fieldName}
              schema={fieldSchema}
              value={value[fieldName]}
              onChange={(fieldValue) => updateField(fieldName, fieldValue)}
              required={schema.required?.includes(fieldName)}
              level={level + 1}
            />
          )
        )}
      </div>
    );
  }

  // 表单渲染器
  function FormRenderer({
    tool,
    formData,
    setFormData,
  }: {
    tool: ToolDebugDialogProps["tool"];
    formData: Record<string, any>;
    setFormData: (data: Record<string, any>) => void;
  }) {
    if (!tool?.inputSchema?.properties) {
      return (
        <div className="text-center py-8">
          <Code className="h-8 w-8 mx-auto mb-2 opacity-50" />
          <p className="text-muted-foreground">该工具无参数定义</p>
        </div>
      );
    }

    const updateField = (fieldName: string, value: any) => {
      setFormData({
        ...formData,
        [fieldName]: value,
      });
    };

    return (
      <ScrollArea className="h-full">
        <div className="space-y-4 p-2">
          {Object.entries(tool.inputSchema.properties).map(
            ([fieldName, fieldSchema]: [string, any]) => (
              <FormField
                key={fieldName}
                name={fieldName}
                schema={fieldSchema}
                value={formData[fieldName]}
                onChange={(value) => updateField(fieldName, value)}
                required={tool.inputSchema.required?.includes(fieldName)}
              />
            )
          )}
        </div>
      </ScrollArea>
    );
  }

  // 格式化结果显示
  const formatResult = useCallback((data: any) => {
    try {
      return JSON.stringify(data, null, 2);
    } catch {
      return String(data);
    }
  }, []);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh]">
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
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Code className="h-4 w-4" />
                  {tool.name}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">服务器:</span>
                  <Badge variant="secondary">{tool.serverName}</Badge>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">工具:</span>
                  <Badge variant="outline">{tool.toolName}</Badge>
                </div>
                {tool.description && (
                  <p className="text-sm text-muted-foreground mt-2">
                    {tool.description}
                  </p>
                )}
              </CardContent>
            </Card>

            {/* 输入参数 */}
            <div className="flex-1 flex gap-4 min-h-0">
              <div className="w-1/2 flex flex-col gap-2">
                <div className="flex items-center justify-between">
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
                          formData={formData}
                          setFormData={setFormData}
                        />
                      </TabsContent>
                      <TabsContent
                        value="json"
                        className="flex-1 data-[state=active]:flex data-[state=active]:flex-col mt-0"
                      >
                        <div className="flex-1 flex flex-col">
                          <Textarea
                            value={inputParams}
                            onChange={(e) => setInputParams(e.target.value)}
                            placeholder="请输入JSON格式的参数..."
                            className="flex-1 font-mono text-sm resize-none min-h-[200px]"
                            disabled={loading}
                          />
                          {!validateJSON(inputParams) &&
                            inputParams.trim() !== "{\n  \n}" && (
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
                    <div className="flex-1 flex flex-col">
                      <Textarea
                        value={inputParams}
                        onChange={(e) => setInputParams(e.target.value)}
                        placeholder="请输入JSON格式的参数..."
                        className="flex-1 font-mono text-sm resize-none"
                        disabled={loading}
                      />
                      {!validateJSON(inputParams) &&
                        inputParams.trim() !== "{\n  \n}" && (
                          <Alert className="mt-2">
                            <AlertCircle className="h-4 w-4" />
                            <AlertDescription>
                              JSON格式错误，请检查输入
                            </AlertDescription>
                          </Alert>
                        )}
                    </div>
                  )}
                </div>
              </div>

              {/* 结果显示 */}
              <div className="w-1/2 flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-medium">调用结果</h3>
                  {(result || error) && (
                    <Button variant="outline" size="sm" onClick={handleCopy}>
                      {copied ? (
                        <>
                          <CheckIcon className="h-4 w-4 mr-1" />
                          已复制
                        </>
                      ) : (
                        <>
                          <CopyIcon className="h-4 w-4 mr-1" />
                          复制
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
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription className="font-mono text-sm">
                          {error}
                        </AlertDescription>
                      </Alert>
                    </div>
                  ) : result ? (
                    <ScrollArea className="h-full border rounded-md">
                      <pre className="p-3 text-sm font-mono whitespace-pre-wrap break-words">
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
                <RotateCcwIcon className="h-4 w-4 mr-2" />
                清空
              </Button>
              <Button
                onClick={handleCallTool}
                disabled={
                  loading ||
                  (inputMode === "json" && !validateJSON(inputParams))
                }
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    调用中...
                  </>
                ) : (
                  <>
                    <PlayIcon className="h-4 w-4 mr-2" />
                    调用工具
                  </>
                )}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

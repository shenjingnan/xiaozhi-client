"use client";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import {
  Form,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { AlertCircle, Code, InfoIcon } from "lucide-react";
import { CheckIcon, Plus, Trash2 } from "lucide-react";
import type React from "react";
import { memo, useMemo } from "react";
import { Controller, useFieldArray } from "react-hook-form";

/**
 * 数组字段渲染器组件
 *
 * @private
 * @description 这是 ToolDebugDialog 的专用内部组件，用于渲染数组类型的 JSON Schema 字段。
 */
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
        <button
          type="button"
          onClick={addItem}
          className="h-8 px-2 border rounded-md text-sm hover:bg-muted"
        >
          <Plus className="h-3 w-3 mr-1 inline" />
          添加
        </button>
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
                <button
                  type="button"
                  onClick={() => remove(index)}
                  className="h-6 w-6 p-0 text-red-500 hover:text-red-700"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
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

/**
 * 对象字段渲染器组件
 *
 * @private
 * @description 这是 ToolDebugDialog 的专用内部组件，用于渲染对象类型的 JSON Schema 字段。
 */
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
                    <p className="text-sm text-muted-foreground">
                      {fieldSchema.description}
                    </p>
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

/**
 * 表单渲染器组件
 *
 * @private
 * @description 这是 ToolDebugDialog 的专用内部组件，用于根据 JSON Schema 渲染完整的表单界面。
 */
interface FormRendererProps {
  tool: Tool;
  form: any;
  renderFormField: (
    fieldName: string,
    fieldSchema: any
  ) => React.ReactElement | null;
}

interface Tool {
  name: string;
  serverName: string;
  toolName: string;
  description?: string;
  inputSchema?: any;
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
                key={`${tool.name}-${fieldName}`}
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

/**
 * 无参数提示组件
 *
 * @private
 * @description 这是 ToolDebugDialog 的专用内部组件，用于显示无需输入参数的提示信息。
 */
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

interface ToolInputPanelProps {
  tool: Tool;
  form: any;
  inputMode: "form" | "json";
  jsonInput: string;
  onModeChange: (mode: "form" | "json") => void;
  onJsonInputChange: (value: string) => void;
  loading: boolean;
  validateJSON: (jsonString: string) => boolean;
}

/**
 * 工具输入面板组件
 *
 * @description 负责工具调试对话框中的输入参数区域，包括表单模式和 JSON 模式切换。
 */
export function ToolInputPanel({
  tool,
  form,
  inputMode,
  jsonInput,
  onModeChange,
  onJsonInputChange,
  loading,
  validateJSON,
}: ToolInputPanelProps) {
  // 渲染表单字段的辅助函数
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
                  <select
                    {...field}
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  >
                    <option value="" disabled>
                      选择{fieldName}
                    </option>
                    {fieldSchema.enum.map((option: string) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                )}
              />
            );
          }
          return (
            <Controller
              name={fieldName as any}
              control={form.control}
              render={({ field }) => (
                <input
                  {...field}
                  placeholder={`输入${fieldName}`}
                  type={fieldSchema.format === "password" ? "password" : "text"}
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                />
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
                <input
                  {...field}
                  type="number"
                  placeholder={`输入${fieldName}`}
                  step={fieldSchema.type === "integer" ? "1" : "0.1"}
                  onChange={(e) => {
                    const value = e.target.value;
                    field.onChange(value === "" ? "" : Number(value));
                  }}
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                />
              )}
            />
          );

        case "boolean":
          return (
            <Controller
              name={fieldName as any}
              control={form.control}
              render={({ field }) => (
                <select
                  {...field}
                  value={field.value?.toString()}
                  onChange={(e) => field.onChange(e.target.value === "true")}
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                >
                  <option value="" disabled>
                    选择{fieldName}
                  </option>
                  <option value="true">true</option>
                  <option value="false">false</option>
                </select>
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
                <input
                  {...field}
                  placeholder={`输入${fieldName}`}
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                />
              )}
            />
          );
      }
    };
  }, [form]);

  const hasNoParams =
    !tool?.inputSchema?.properties ||
    Object.keys(tool.inputSchema.properties).length === 0;

  return (
    <div className="w-1/2 flex flex-col gap-2 flex-shrink-0 overflow-hidden pr-0.5">
      <div className="flex items-center justify-between h-[40px]">
        <h3 className="text-sm font-medium">输入参数</h3>
        {!hasNoParams && (
          <Tabs
            value={inputMode}
            onValueChange={(value) => onModeChange(value as "form" | "json")}
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
        {!hasNoParams ? (
          <Tabs
            value={inputMode}
            onValueChange={(value) => onModeChange(value as "form" | "json")}
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
                  onChange={(e) => onJsonInputChange(e.target.value)}
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
  );
}

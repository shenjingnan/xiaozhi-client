/**
 * 表单渲染器组件
 *
 * @description 根据工具的 JSON Schema 渲染完整的表单界面。
 * 该组件遍历工具的 inputSchema 属性，使用 renderFormField 函数渲染每个字段。
 */

import { Badge } from "@/components/ui/badge";
import { Form, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Code, InfoIcon } from "lucide-react";
import { memo } from "react";
import type { FormRendererProps } from "./types";

/**
 * 表单渲染器组件
 *
 * @param props - 组件属性
 * @param props.tool - 工具信息对象
 * @param props.form - react-hook-form 表单实例
 * @param props.renderFormField - 渲染单个字段的函数
 */
export const FormRenderer = memo(function FormRenderer({
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
/**
 * 对象字段渲染器组件
 *
 * @description 用于渲染对象类型的 JSON Schema 字段。
 * 该组件支持嵌套属性、必填标记和类型徽章显示。
 */

import { Badge } from "@/components/ui/badge";
import { FormField, FormDescription, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { InfoIcon } from "lucide-react";
import { memo } from "react";
import type { ObjectFieldProps } from "./types";

/**
 * 对象字段渲染器组件
 *
 * @param props - 组件属性
 * @param props.name - 字段名称
 * @param props.schema - JSON Schema 定义
 * @param props.form - react-hook-form 表单实例
 * @param props.renderFormField - 渲染单个字段的函数
 * @param props.getTypeBadge - 获取类型徽章颜色类的函数
 */
export const ObjectField = memo(function ObjectField({
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
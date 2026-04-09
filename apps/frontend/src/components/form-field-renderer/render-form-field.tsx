"use client";

import { FormControl } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type React from "react";
import { Controller, type useForm } from "react-hook-form";

/**
 * 表单字段渲染辅助模块
 *
 * @description 为 ToolDebugDialog 提供表单字段渲染功能
 * 根据 JSON Schema 字段类型渲染对应的表单控件
 */

/**
 * 获取类型徽章的颜色样式
 *
 * @param type - JSON Schema 字段类型
 * @returns Tailwind CSS 类名字符串
 */
export function getTypeBadgeColor(type: string): string {
  const colors: Record<string, string> = {
    string: "bg-blue-100 text-blue-800",
    number: "bg-green-100 text-green-800",
    integer: "bg-green-100 text-green-800",
    boolean: "bg-purple-100 text-purple-800",
    array: "bg-orange-100 text-orange-800",
    object: "bg-gray-100 text-gray-800",
  };

  return colors[type] || "bg-gray-100 text-gray-800";
}

/**
 * 表单字段渲染器类型定义
 *
 * @description 渲染单个表单字段，支持各种 JSON Schema 类型
 */
export type FormFieldRenderer = (
  fieldName: string,
  fieldSchema: any
) => React.ReactElement | null;

/**
 * 创建表单字段渲染器
 *
 * @description 根据 JSON Schema 字段类型创建对应的表单控件渲染器
 * 支持嵌套的数组和对象类型，通过递归调用渲染器实现
 *
 * @param form - react-hook-form 的表单实例
 * @param ArrayFieldComponent - 数组字段渲染组件
 * @param ObjectFieldComponent - 对象字段渲染组件
 * @returns 表单字段渲染函数
 *
 * @example
 * ```tsx
 * const form = useForm({ resolver: zodResolver(schema) });
 * const renderFormField = createFormFieldRenderer(form, ArrayField, ObjectField);
 *
 * // 在 JSX 中使用
 * {renderFormField("fieldName", { type: "string" })}
 * ```
 */
export function createFormFieldRenderer(
  form: ReturnType<typeof useForm>,
  ArrayFieldComponent: React.ComponentType<{
    name: string;
    schema: any;
    form: ReturnType<typeof useForm>;
    renderFormField: FormFieldRenderer;
  }>,
  ObjectFieldComponent: React.ComponentType<{
    name: string;
    schema: any;
    form: ReturnType<typeof useForm>;
    renderFormField: FormFieldRenderer;
    getTypeBadge: (type: string) => string;
  }>
): FormFieldRenderer {
  const renderFormField: FormFieldRenderer = (
    fieldName: string,
    fieldSchema: any
  ): React.ReactElement | null => {
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
                  type={fieldSchema.format === "password" ? "password" : "text"}
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
          <ArrayFieldComponent
            name={fieldName}
            schema={fieldSchema}
            form={form}
            renderFormField={renderFormField}
          />
        );

      case "object":
        return (
          <ObjectFieldComponent
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

  return renderFormField;
}

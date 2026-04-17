/**
 * 通用表单字段渲染组件
 * 根据配置自动渲染不同类型的表单字段
 */

import {
  FormControl,
  FormDescription,
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
import { Textarea } from "@/components/ui/textarea";
import type { FieldConfig } from "@/types/form-config";
import type { UseFormReturn } from "react-hook-form";
import type { z } from "zod";

/**
 * 渲染单个表单字段
 * @param config - 字段配置
 * @param form - React Hook Form 实例
 * @param disabled - 是否禁用（覆盖配置中的 disabled）
 */
export function renderFormField<
  T extends z.ZodType,
  Output extends Record<string, any> = z.infer<T> & Record<string, any>,
>(
  config: FieldConfig<T, Output>,
  form: UseFormReturn<Output>,
  disabled?: boolean
) {
  const {
    name,
    type,
    label,
    required,
    placeholder,
    description,
    condition,
    options,
    inputType,
  } = config;

  // 检查显示条件
  if (condition && !condition(form)) {
    return null;
  }

  const isDisabled = disabled ?? config.disabled;

  // 辅助函数：根据类型渲染输入组件
  // 必须在 FormControl 外部提前决定渲染哪个组件
  // 因为 FormControl 使用的 Slot 组件通过 React.Children.only 严格要求只有一个子元素
  const renderInput = (field: any) => {
    switch (type) {
      case "text":
        return (
          <Input
            {...field}
            type={inputType}
            placeholder={placeholder}
            disabled={isDisabled}
            className={config.className}
          />
        );
      case "textarea":
        return (
          <Textarea
            {...field}
            placeholder={placeholder}
            className={config.className}
            rows={config.rows}
            disabled={isDisabled}
          />
        );
      case "select":
        return (
          <Select
            value={field.value}
            onValueChange={field.onChange}
            disabled={isDisabled}
          >
            <SelectTrigger>
              <SelectValue placeholder={placeholder} />
            </SelectTrigger>
            <SelectContent>
              {options?.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        );
      default:
        return null;
    }
  };

  return (
    <FormField
      key={String(name)}
      control={form.control}
      name={String(name) as any}
      render={({ field }) => (
        <FormItem>
          <FormLabel>
            {required && <span className="text-red-500 mr-1">*</span>}
            {label}
          </FormLabel>
          <FormControl>{renderInput(field)}</FormControl>
          {typeof description === "function" ? (
            <FormDescription>{description(form)}</FormDescription>
          ) : description ? (
            <FormDescription>{description}</FormDescription>
          ) : null}
          <FormMessage />
        </FormItem>
      )}
    />
  );
}

/**
 * 渲染带自定义 onChange 处理的 select 字段
 * @param config - 字段配置
 * @param form - React Hook Form 实例
 * @param onValueChange - 自定义值变化处理函数
 * @param disabled - 是否禁用
 */
export function renderSelectFieldWithHandler<
  T extends z.ZodType,
  Output extends Record<string, any> = z.infer<T> & Record<string, any>,
  V extends string = string,
>(
  config: FieldConfig<T, Output>,
  form: UseFormReturn<Output>,
  onValueChange: (value: V) => void,
  disabled?: boolean
) {
  const { name, type, label, required, placeholder, description, options } =
    config;

  if (type !== "select") {
    console.warn("renderSelectFieldWithHandler 只能用于 select 类型字段");
    return renderFormField(config, form, disabled);
  }

  return (
    <FormField
      key={String(name)}
      control={form.control}
      name={String(name) as any}
      render={({ field }) => (
        <FormItem>
          <FormLabel>
            {required && <span className="text-red-500 mr-1">*</span>}
            {label}
          </FormLabel>
          <FormControl>
            <Select
              value={field.value}
              onValueChange={onValueChange}
              disabled={disabled ?? config.disabled}
            >
              <SelectTrigger>
                <SelectValue placeholder={placeholder} />
              </SelectTrigger>
              <SelectContent>
                {options?.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormControl>
          {typeof description === "function" ? (
            <FormDescription>{description(form)}</FormDescription>
          ) : description ? (
            <FormDescription>{description}</FormDescription>
          ) : null}
          <FormMessage />
        </FormItem>
      )}
    />
  );
}

/**
 * 表单配置类型定义
 * 用于配置驱动的表单字段渲染
 */

import type { FieldPath, FieldValues, UseFormReturn } from "react-hook-form";

/**
 * 支持的字段类型
 */
export type FieldType = "text" | "textarea" | "select";

/**
 * 字段配置接口
 * @template TFieldValues - 表单值类型，必须满足 FieldValues 约束
 * @template TName - 字段名称类型，必须是 TFieldValues 的有效字段路径
 */
export interface FieldConfig<
  TFieldValues extends FieldValues,
  TName extends FieldPath<TFieldValues>,
> {
  /** 字段名称 */
  name: TName;
  /** 字段类型 */
  type: FieldType;
  /** 标签 */
  label: string;
  /** 是否必填 */
  required?: boolean;
  /** 占位符 */
  placeholder?: string;
  /** 描述（支持静态字符串或动态函数） */
  description?: string | ((form: UseFormReturn<TFieldValues>) => string);
  /** select 选项（仅 type=select 时有效） */
  options?: Array<{ value: string; label: string }>;
  /** 显示条件函数，返回 true 时显示该字段 */
  condition?: (form: UseFormReturn<TFieldValues>) => boolean;
  /** textarea 行数 */
  rows?: number;
  /** 额外类名 */
  className?: string;
  /** 是否禁用 */
  disabled?: boolean;
  /** 输入框类型（仅 type=text 时有效） */
  inputType?: string;
}

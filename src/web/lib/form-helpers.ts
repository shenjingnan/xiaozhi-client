/**
 * 表单类型辅助工具
 *
 * 提供 React Hook Form 动态表单场景下的类型安全辅助函数
 */

import type { FieldValues, Path } from "react-hook-form";

/**
 * 动态字段路径类型断言
 *
 * 当表单由运行时 JSON Schema 动态生成时，字段名无法在编译时
 * 通过 React Hook Form 的 Path<T> 类型检查。此函数将分散的
 * 类型断言收敛为一处有明确语义的类型逃逸点。
 *
 * @param fieldName - 运行时确定的字段名字符串
 * @returns 标记为 Path<TFieldValues> 类型的字段名
 *
 * @example
 * ```tsx
 * <Controller name={dynamicPath("username")} control={form.control} ... />
 * ```
 */
export function dynamicPath<
  TFieldValues extends FieldValues = Record<string, unknown>,
>(fieldName: string): Path<TFieldValues> {
  return fieldName as Path<TFieldValues>;
}

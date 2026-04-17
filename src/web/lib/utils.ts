/**
 * UI 工具函数模块
 *
 * 提供前端 UI 相关的通用工具函数
 *
 * @module utils
 *
 * @example
 * ```typescript
 * import { cn } from '@/lib/utils';
 *
 * // 合并 Tailwind CSS 类名，自动处理冲突
 * const classes = cn('px-4 py-2', isActive && 'bg-blue-500', 'rounded-lg');
 * ```
 */
import type { ClassValue } from "clsx";
import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

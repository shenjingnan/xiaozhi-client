/**
 * Zod Schema 相关工具函数
 * 提供可复用的 Zod 验证 Schema，避免重复代码
 */

import { z } from "zod";

/**
 * 创建日期字符串验证 Schema
 * @param fieldName - 字段名称（用于错误消息）
 * @returns Zod Schema 用于验证可选的日期字符串
 *
 * @example
 * ```ts
 * const MySchema = z.object({
 *   startDate: createDateSchema("startDate"),
 *   endDate: createDateSchema("endDate"),
 * });
 * ```
 */
export const createDateSchema = (fieldName: string) =>
  z
    .string()
    .optional()
    .refine(
      (val) => {
        if (!val) return true;
        const date = Date.parse(val);
        return !Number.isNaN(date);
      },
      {
        message: `${fieldName} 参数格式无效`,
      }
    );

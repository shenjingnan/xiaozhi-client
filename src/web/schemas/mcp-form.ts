/**
 * MCP 服务表单验证 Schema
 * 使用 Zod 进行表单验证
 */

import { z } from "zod";

/**
 * 字符串或空字符串（用于可选的文本输入）
 */
const optionalStringSchema = z.string().trim();

/**
 * MCP 名称验证规则
 */
const nameSchema = z
  .string()
  .min(1, "MCP 名称不能为空")
  .regex(
    /^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/,
    "MCP 名称只能包含小写字母、数字和连字符，且必须以字母或数字开头和结尾"
  );

/**
 * stdio 类型表单验证 Schema
 */
export const stdioFormSchema = z.object({
  type: z.literal("stdio"),
  name: nameSchema,
  command: z.string().min(1, "启动命令不能为空"),
  env: optionalStringSchema,
});

/**
 * http 类型表单验证 Schema
 */
export const httpFormSchema = z.object({
  type: z.literal("http"),
  name: nameSchema,
  url: z.string().url("请输入有效的 URL 地址"),
  headers: optionalStringSchema,
});

/**
 * sse 类型表单验证 Schema
 */
export const sseFormSchema = z.object({
  type: z.literal("sse"),
  name: nameSchema,
  url: z.string().url("请输入有效的 URL 地址"),
  headers: optionalStringSchema,
});

/**
 * MCP 服务表单联合验证 Schema
 * 使用 discriminated union 确保类型安全
 */
export const mcpFormSchema = z.discriminatedUnion("type", [
  stdioFormSchema,
  httpFormSchema,
  sseFormSchema,
]);

/**
 * 类型推断
 */
export type McpFormSchema = z.infer<typeof mcpFormSchema>;

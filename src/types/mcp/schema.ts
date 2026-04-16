/**
 * JSON Schema 类型定义
 * 用于 MCP 工具的 inputSchema 字段
 */

/**
 * JSON Schema 类型
 * 带类型守卫的严格 JSON Schema 类型定义
 */
export interface JSONSchema {
  type?: string | string[];
  properties?: Record<string, JSONSchema>;
  required?: string[];
  items?: JSONSchema;
  additionalProperties?: boolean | JSONSchema;
  description?: string;
  enum?: unknown[];
  const?: unknown;
  [key: string]: unknown;
}

/**
 * 检查值是否为有效的 JSON Schema
 */
export function isJSONSchema(value: unknown): value is JSONSchema {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  // 基本的结构检查
  return true;
}

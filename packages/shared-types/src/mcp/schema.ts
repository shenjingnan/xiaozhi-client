/**
 * JSON Schema 类型定义
 * 用于 MCP 工具的 inputSchema 字段
 *
 * 使用宽松的类型定义以保持向后兼容性
 * 兼容 MCP SDK 的 JSON Schema 格式
 */

/**
 * JSON Schema 类型
 * 使用宽松的类型定义，兼容 MCP SDK 和现有代码
 * 同时保留常用属性的类型信息
 *
 * 注意：properties 使用 object 类型以兼容 MCP SDK 的 AssertObjectSchema
 */
export type JSONSchema = Record<string, unknown> & {
  type?: string | string[];
  properties?: Record<string, object>;
  required?: string[];
  items?: object;
  additionalProperties?: boolean | object;
  description?: string;
  enum?: unknown[];
  const?: unknown;
  default?: unknown;
};

/**
 * 检查值是否为有效的 Json Schema（类型守卫）
 */
export function isJSONSchema(value: unknown): value is JSONSchema {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  // 基本的结构检查
  return true;
}

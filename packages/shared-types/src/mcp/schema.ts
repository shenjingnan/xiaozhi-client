/**
 * JSON Schema 类型定义
 * 用于 MCP 工具的 inputSchema 字段
 */

/**
 * JSON Schema 类型定义
 * 兼容 MCP SDK 的 JSON Schema 格式
 * 这是一个宽松的类型定义，允许任何 JSON Schema 格式
 */
export type JSONSchema =
  | (Record<string, unknown> & {
      type: "object";
      properties?: Record<string, unknown>;
      required?: string[];
      additionalProperties?: boolean;
    })
  | Record<string, unknown>;

/**
 * 严格的 JSON Schema 接口
 * 带类型守卫的严格 JSON Schema 类型定义
 * @deprecated 使用 JSONSchema 类型代替，此接口保留用于向后兼容
 */
export interface StrictJSONSchema {
  type?: string | string[];
  properties?: Record<string, StrictJSONSchema>;
  required?: string[];
  items?: StrictJSONSchema;
  additionalProperties?: boolean | StrictJSONSchema;
  description?: string;
  enum?: unknown[];
  const?: unknown;
  [key: string]: unknown;
}

/**
 * 检查值是否为有效的 JSON Schema
 * @deprecated 此函数向后兼容，建议使用 isValidToolJSONSchema
 */
export function isJSONSchema(value: unknown): value is StrictJSONSchema {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  // 基本的结构检查
  return true;
}

/**
 * 类型守卫：检查对象是否为有效的 MCP Tool JSON Schema
 */
export function isValidToolJSONSchema(obj: unknown): obj is {
  type: "object";
  properties?: Record<string, unknown>;
  required?: string[];
  additionalProperties?: boolean;
} {
  return (
    typeof obj === "object" &&
    obj !== null &&
    "type" in obj &&
    (obj as { type?: unknown }).type === "object"
  );
}

/**
 * 确保对象符合 MCP Tool JSON Schema 格式
 * 返回类型兼容 MCP SDK 的 Tool 类型
 */
export function ensureToolJSONSchema(schema: JSONSchema): {
  type: "object";
  properties?: Record<string, object>;
  required?: string[];
  additionalProperties?: boolean;
} {
  if (isValidToolJSONSchema(schema)) {
    return schema as {
      type: "object";
      properties?: Record<string, object>;
      required?: string[];
      additionalProperties?: boolean;
    };
  }

  // 如果不符合标准格式，返回默认的空对象 schema
  return {
    type: "object",
    properties: {},
    required: [],
    additionalProperties: true,
  };
}

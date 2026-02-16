/**
 * JSON Schema 类型定义
 *
 * 提供用于工具输入参数的 JSON Schema 类型定义
 * 参考：https://json-schema.org/understanding-json-schema/
 */

/**
 * JSON Schema 基础类型
 */
export type JSONSchemaType =
  | "string"
  | "number"
  | "integer"
  | "boolean"
  | "array"
  | "object";

/**
 * 字符串类型的 JSON Schema
 */
export interface StringJSONSchema {
  type: "string";
  description?: string;
  enum?: string[];
  format?: string;
  minLength?: number;
  maxLength?: number;
  pattern?: string;
}

/**
 * 数字类型的 JSON Schema
 */
export interface NumberJSONSchema {
  type: "number" | "integer";
  description?: string;
  minimum?: number;
  maximum?: number;
  multipleOf?: number;
}

/**
 * 布尔类型的 JSON Schema
 */
export interface BooleanJSONSchema {
  type: "boolean";
  description?: string;
}

/**
 * 数组类型的 JSON Schema
 */
export interface ArrayJSONSchema {
  type: "array";
  description?: string;
  items?: JSONSchema;
  minItems?: number;
  maxItems?: number;
}

/**
 * 对象类型的 JSON Schema
 */
export interface ObjectJSONSchema {
  type: "object";
  description?: string;
  properties?: Record<string, JSONSchema>;
  required?: string[];
}

/**
 * JSON Schema 联合类型
 */
export type JSONSchema =
  | StringJSONSchema
  | NumberJSONSchema
  | BooleanJSONSchema
  | ArrayJSONSchema
  | ObjectJSONSchema;

/**
 * 工具输入 Schema
 * 扩展自 ObjectJSONSchema，确保包含 properties 字段
 */
export interface ToolInputSchema extends ObjectJSONSchema {
  properties: Record<string, JSONSchema>;
  required?: string[];
}

/**
 * 类型守卫：检查是否为字符串 Schema
 */
export function isStringSchema(schema: JSONSchema): schema is StringJSONSchema {
  return schema.type === "string";
}

/**
 * 类型守卫：检查是否为数字 Schema
 */
export function isNumberSchema(schema: JSONSchema): schema is NumberJSONSchema {
  return schema.type === "number" || schema.type === "integer";
}

/**
 * 类型守卫：检查是否为布尔 Schema
 */
export function isBooleanSchema(
  schema: JSONSchema
): schema is BooleanJSONSchema {
  return schema.type === "boolean";
}

/**
 * 类型守卫：检查是否为数组 Schema
 */
export function isArraySchema(schema: JSONSchema): schema is ArrayJSONSchema {
  return schema.type === "array";
}

/**
 * 类型守卫：检查是否为对象 Schema
 */
export function isObjectSchema(schema: JSONSchema): schema is ObjectJSONSchema {
  return schema.type === "object";
}

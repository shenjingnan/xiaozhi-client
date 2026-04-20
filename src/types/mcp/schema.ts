/**
 * JSON Schema 类型定义
 * 用于 MCP 工具的 inputSchema 字段
 */

/**
 * JSON Schema 类型
 * 兼容 MCP SDK 的 JSON Schema 格式，同时支持更宽松的对象格式以保持向后兼容
 *
 * 注意：此定义与 src/server/lib/mcp/types.ts 中的 JSONSchema 保持一致
 * 支持严格的结构化定义和宽松的 Record<string, unknown> 格式
 */
export type JSONSchema =
  | (Record<string, unknown> & {
      type?: string | string[];
      properties?: Record<string, unknown>;
      required?: string[];
      items?: unknown;
      additionalProperties?: boolean | unknown;
      description?: string;
      enum?: unknown[];
      const?: unknown;
    })
  | Record<string, unknown>;

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

import type { JSONSchema } from "@xiaozhi-client/shared-types";
import { z } from "zod";

/**
 * 根据 JSON Schema 动态生成 Zod schema
 */
export function createZodSchemaFromJsonSchema(jsonSchema: JSONSchema): z.ZodTypeAny {
  if (!jsonSchema || typeof jsonSchema !== "object") {
    return z.any();
  }

  switch (jsonSchema.type) {
    case "string": {
      if (jsonSchema.enum) {
        return z.enum(jsonSchema.enum as [string, ...string[]]);
      }
      let stringSchema = z.string();
      if (typeof jsonSchema.minLength === "number") {
        stringSchema = stringSchema.min(jsonSchema.minLength);
      }
      if (typeof jsonSchema.maxLength === "number") {
        stringSchema = stringSchema.max(jsonSchema.maxLength);
      }
      if (typeof jsonSchema.pattern === "string") {
        stringSchema = stringSchema.regex(new RegExp(jsonSchema.pattern));
      }
      return stringSchema;
    }

    case "number":
    case "integer": {
      let numberSchema = z.number();
      if (jsonSchema.type === "integer") {
        numberSchema = numberSchema.int();
      }
      if (typeof jsonSchema.minimum === "number") {
        numberSchema = numberSchema.min(jsonSchema.minimum);
      }
      if (typeof jsonSchema.maximum === "number") {
        numberSchema = numberSchema.max(jsonSchema.maximum);
      }
      if (typeof jsonSchema.multipleOf === "number") {
        numberSchema = numberSchema.multipleOf(jsonSchema.multipleOf);
      }
      return numberSchema;
    }

    case "boolean":
      return z.boolean();

    case "array":
      if (jsonSchema.items) {
        const itemSchema = createZodSchemaFromJsonSchema(jsonSchema.items);
        let arraySchema = z.array(itemSchema);
        if (typeof jsonSchema.minItems === "number") {
          arraySchema = arraySchema.min(jsonSchema.minItems);
        }
        if (typeof jsonSchema.maxItems === "number") {
          arraySchema = arraySchema.max(jsonSchema.maxItems);
        }
        return arraySchema;
      }
      return z.array(z.any());

    case "object":
      if (
        jsonSchema.properties &&
        Object.keys(jsonSchema.properties).length > 0
      ) {
        const shape: Record<string, z.ZodTypeAny> = {};
        const requiredFields = jsonSchema.required || [];

        for (const [key, propSchema] of Object.entries(jsonSchema.properties)) {
          let fieldSchema = createZodSchemaFromJsonSchema(propSchema);

          // 如果字段不是必填的，设为可选
          if (!requiredFields.includes(key)) {
            fieldSchema = fieldSchema.optional();
          }

          shape[key] = fieldSchema;
        }

        return z.object(shape);
      }
      return z.record(z.string(), z.any());

    default:
      return z.any();
  }
}

/**
 * 获取字段的默认值
 */
export function getDefaultValueForSchema(schema: JSONSchema): unknown {
  if (!schema) return undefined;

  switch (schema.type) {
    case "string":
      if (schema.enum) return schema.enum[0];
      return "";

    case "number":
    case "integer":
      return 0;

    case "boolean":
      return false;

    case "array":
      return [];

    case "object":
      if (schema.properties) {
        const defaults: Record<string, any> = {};
        for (const [key, propSchema] of Object.entries(schema.properties)) {
          defaults[key] = getDefaultValueForSchema(propSchema);
        }
        return defaults;
      }
      return {};

    default:
      return undefined;
  }
}

/**
 * 根据 JSON Schema 生成默认值对象
 */
export function createDefaultValues(jsonSchema: JSONSchema): Record<string, unknown> {
  if (!jsonSchema || !jsonSchema.properties) return {};

  const defaults: Record<string, any> = {};
  const requiredFields = jsonSchema.required || [];

  for (const [key, propSchema] of Object.entries(jsonSchema.properties)) {
    if (requiredFields.includes(key)) {
      defaults[key] = getDefaultValueForSchema(propSchema);
    } else {
      // 对于可选字段，只设置明显的默认值
      const defaultValue = getDefaultValueForSchema(propSchema);
      if (defaultValue !== undefined && defaultValue !== "") {
        defaults[key] = defaultValue;
      }
    }
  }

  return defaults;
}

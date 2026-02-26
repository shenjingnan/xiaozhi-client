import type { JSONSchema7, JSONSchema7Definition } from "json-schema";
import { z } from "zod";

/**
 * 根据 JSON Schema 动态生成 Zod schema
 */
export function createZodSchemaFromJsonSchema(jsonSchema: JSONSchema7): z.ZodTypeAny {
  // 处理 boolean 类型的 schema 定义（true = any, false = never）
  const processSchemaDefinition = (
    def: JSONSchema7Definition | true | JSONSchema7Definition[],
  ): z.ZodTypeAny => {
    if (def === true) return z.any();
    if (def === false) return z.never();
    if (Array.isArray(def)) {
      // 数组表示 anyOf 语义
      return z.union(
        def.map((d) => processSchemaDefinition(d)) as [z.ZodTypeAny, z.ZodTypeAny, ...z.ZodTypeAny[]],
      );
    }
    return createZodSchemaFromJsonSchema(def);
  };
  if (!jsonSchema || typeof jsonSchema !== "object") {
    return z.any();
  }

  switch (jsonSchema.type) {
    case "string": {
      if (jsonSchema.enum) {
        return z.enum(jsonSchema.enum as [string, ...string[]]);
      }
      let stringSchema = z.string();
      if (jsonSchema.minLength) {
        stringSchema = stringSchema.min(jsonSchema.minLength);
      }
      if (jsonSchema.maxLength) {
        stringSchema = stringSchema.max(jsonSchema.maxLength);
      }
      if (jsonSchema.pattern) {
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
        const itemSchema = processSchemaDefinition(jsonSchema.items);
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
          let fieldSchema = processSchemaDefinition(propSchema);

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
export function getDefaultValueForSchema(
  schema: JSONSchema7Definition,
): unknown {
  // 处理 boolean 类型的 schema 定义
  if (schema === true || schema === false) {
    return undefined;
  }

  // 现在 schema 确定是 JSONSchema7 类型
  const jsonSchema = schema as JSONSchema7;
  const processSchema = (def: JSONSchema7Definition): unknown => {
    // 处理 boolean 类型的 schema 定义
    if (def === true || def === false) return undefined;
    return getDefaultValueForSchema(def);
  };

  if (!jsonSchema) return undefined;

  switch (jsonSchema.type) {
    case "string":
      if (jsonSchema.enum) return jsonSchema.enum[0];
      return "";

    case "number":
    case "integer":
      return 0;

    case "boolean":
      return false;

    case "array":
      return [];

    case "object":
      if (jsonSchema.properties) {
        const defaults: Record<string, unknown> = {};
        for (const [key, propSchema] of Object.entries(jsonSchema.properties)) {
          defaults[key] = processSchema(propSchema);
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
export function createDefaultValues(
  jsonSchema: JSONSchema7,
): Record<string, unknown> {
  if (!jsonSchema || !jsonSchema.properties) return {};

  const defaults: Record<string, unknown> = {};
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

import type { JSONSchema } from "@xiaozhi-client/shared-types";
import { describe, expect, it } from "vitest";
import {
  createDefaultValues,
  createZodSchemaFromJsonSchema,
  getDefaultValueForSchema,
} from "../schema-utils";

describe("schema-utils", () => {
  describe("createZodSchemaFromJsonSchema", () => {
    describe("基础类型", () => {
      it("应该为 string 类型创建正确的 schema", () => {
        const schema: JSONSchema = { type: "string" };
        const zodSchema = createZodSchemaFromJsonSchema(schema);

        expect(zodSchema.safeParse("test").success).toBe(true);
        expect(zodSchema.safeParse(123).success).toBe(false);
      });

      it("应该为带 enum 的 string 类型创建正确的 schema", () => {
        const schema: JSONSchema = {
          type: "string",
          enum: ["option1", "option2", "option3"],
        };
        const zodSchema = createZodSchemaFromJsonSchema(schema);

        expect(zodSchema.safeParse("option1").success).toBe(true);
        expect(zodSchema.safeParse("option2").success).toBe(true);
        expect(zodSchema.safeParse("invalid").success).toBe(false);
      });

      it("应该为带 minLength 的 string 类型创建正确的 schema", () => {
        const schema: JSONSchema = { type: "string", minLength: 3 };
        const zodSchema = createZodSchemaFromJsonSchema(schema);

        expect(zodSchema.safeParse("abc").success).toBe(true);
        expect(zodSchema.safeParse("ab").success).toBe(false);
      });

      it("应该为带 maxLength 的 string 类型创建正确的 schema", () => {
        const schema: JSONSchema = { type: "string", maxLength: 5 };
        const zodSchema = createZodSchemaFromJsonSchema(schema);

        expect(zodSchema.safeParse("abc").success).toBe(true);
        expect(zodSchema.safeParse("abcdef").success).toBe(false);
      });

      it("应该为带 pattern 的 string 类型创建正确的 schema", () => {
        const schema: JSONSchema = { type: "string", pattern: "^\\d+$" };
        const zodSchema = createZodSchemaFromJsonSchema(schema);

        expect(zodSchema.safeParse("123").success).toBe(true);
        expect(zodSchema.safeParse("abc").success).toBe(false);
      });

      it("应该为 number 类型创建正确的 schema", () => {
        const schema: JSONSchema = { type: "number" };
        const zodSchema = createZodSchemaFromJsonSchema(schema);

        expect(zodSchema.safeParse(123).success).toBe(true);
        expect(zodSchema.safeParse(123.45).success).toBe(true);
        expect(zodSchema.safeParse("123").success).toBe(false);
      });

      it("应该为 integer 类型创建正确的 schema", () => {
        const schema: JSONSchema = { type: "integer" };
        const zodSchema = createZodSchemaFromJsonSchema(schema);

        expect(zodSchema.safeParse(123).success).toBe(true);
        expect(zodSchema.safeParse(123.45).success).toBe(false);
      });

      it("应该为带 minimum 的 number 类型创建正确的 schema", () => {
        const schema: JSONSchema = { type: "number", minimum: 10 };
        const zodSchema = createZodSchemaFromJsonSchema(schema);

        expect(zodSchema.safeParse(10).success).toBe(true);
        expect(zodSchema.safeParse(5).success).toBe(false);
      });

      it("应该为带 maximum 的 number 类型创建正确的 schema", () => {
        const schema: JSONSchema = { type: "number", maximum: 100 };
        const zodSchema = createZodSchemaFromJsonSchema(schema);

        expect(zodSchema.safeParse(50).success).toBe(true);
        expect(zodSchema.safeParse(150).success).toBe(false);
      });

      it("应该为 boolean 类型创建正确的 schema", () => {
        const schema: JSONSchema = { type: "boolean" };
        const zodSchema = createZodSchemaFromJsonSchema(schema);

        expect(zodSchema.safeParse(true).success).toBe(true);
        expect(zodSchema.safeParse(false).success).toBe(true);
        expect(zodSchema.safeParse("true").success).toBe(false);
      });

      it("应该为 array 类型创建正确的 schema", () => {
        const schema: JSONSchema = {
          type: "array",
          items: { type: "string" },
        };
        const zodSchema = createZodSchemaFromJsonSchema(schema);

        expect(zodSchema.safeParse(["a", "b", "c"]).success).toBe(true);
        expect(zodSchema.safeParse([1, 2, 3]).success).toBe(false);
        expect(zodSchema.safeParse("not-array").success).toBe(false);
      });

      it("应该为带 minItems 的 array 类型创建正确的 schema", () => {
        const schema: JSONSchema = {
          type: "array",
          items: { type: "string" },
          minItems: 2,
        };
        const zodSchema = createZodSchemaFromJsonSchema(schema);

        expect(zodSchema.safeParse(["a", "b"]).success).toBe(true);
        expect(zodSchema.safeParse(["a"]).success).toBe(false);
      });

      it("应该为带 maxItems 的 array 类型创建正确的 schema", () => {
        const schema: JSONSchema = {
          type: "array",
          items: { type: "string" },
          maxItems: 3,
        };
        const zodSchema = createZodSchemaFromJsonSchema(schema);

        expect(zodSchema.safeParse(["a", "b"]).success).toBe(true);
        expect(zodSchema.safeParse(["a", "b", "c", "d"]).success).toBe(false);
      });

      it("应该为 object 类型创建正确的 schema", () => {
        const schema: JSONSchema = {
          type: "object",
          properties: {
            name: { type: "string" },
            age: { type: "number" },
          },
        };
        const zodSchema = createZodSchemaFromJsonSchema(schema);

        expect(zodSchema.safeParse({ name: "test", age: 25 }).success).toBe(
          true
        );
        expect(zodSchema.safeParse({ name: 123 }).success).toBe(false);
      });

      it("应该正确处理 required 字段", () => {
        const schema: JSONSchema = {
          type: "object",
          properties: {
            name: { type: "string" },
            optionalField: { type: "string" },
          },
          required: ["name"],
        };
        const zodSchema = createZodSchemaFromJsonSchema(schema);

        // name 是必填的
        const result1 = zodSchema.safeParse({ name: "test" });
        expect(result1.success).toBe(true);

        // optionalField 是可选的
        const result2 = zodSchema.safeParse({ name: "test", optionalField: "value" });
        expect(result2.success).toBe(true);
      });

      it("应该处理嵌套对象", () => {
        const schema: JSONSchema = {
          type: "object",
          properties: {
            user: {
              type: "object",
              properties: {
                name: { type: "string" },
                email: { type: "string" },
              },
            },
          },
        };
        const zodSchema = createZodSchemaFromJsonSchema(schema);

        expect(
          zodSchema.safeParse({ user: { name: "test", email: "test@example.com" } }).success
        ).toBe(true);
      });

      it("应该处理嵌套数组", () => {
        const schema: JSONSchema = {
          type: "array",
          items: {
            type: "object",
            properties: {
              id: { type: "number" },
              name: { type: "string" },
            },
          },
        };
        const zodSchema = createZodSchemaFromJsonSchema(schema);

        expect(
          zodSchema.safeParse([{ id: 1, name: "item1" }, { id: 2, name: "item2" }]).success
        ).toBe(true);
      });
    });

    describe("边界情况", () => {
      it("应该为空或无效的 schema 返回 z.any()", () => {
        const nullSchema = createZodSchemaFromJsonSchema(null as unknown as JSONSchema);
        expect(nullSchema.safeParse("anything").success).toBe(true);
        expect(nullSchema.safeParse(null).success).toBe(true);

        const undefinedSchema = createZodSchemaFromJsonSchema(undefined as unknown as JSONSchema);
        expect(undefinedSchema.safeParse("anything").success).toBe(true);

        const emptySchema = createZodSchemaFromJsonSchema({} as JSONSchema);
        expect(emptySchema.safeParse("anything").success).toBe(true);
      });

      it("应该为未知类型返回 z.any()", () => {
        const schema: JSONSchema = { type: "unknown" };
        const zodSchema = createZodSchemaFromJsonSchema(schema);

        expect(zodSchema.safeParse("anything").success).toBe(true);
      });

      it("应该处理没有 items 的 array 类型", () => {
        const schema: JSONSchema = { type: "array" };
        const zodSchema = createZodSchemaFromJsonSchema(schema);

        expect(zodSchema.safeParse([1, "a", true]).success).toBe(true);
      });

      it("应该处理没有 properties 的 object 类型", () => {
        const schema: JSONSchema = { type: "object" };
        const zodSchema = createZodSchemaFromJsonSchema(schema);

        expect(zodSchema.safeParse({ anyKey: "anyValue" }).success).toBe(true);
      });
    });
  });

  describe("getDefaultValueForSchema", () => {
    it("应该为 string 类型返回空字符串", () => {
      const schema: JSONSchema = { type: "string" };
      expect(getDefaultValueForSchema(schema)).toBe("");
    });

    it("应该为带 enum 的 string 类型返回第一个 enum 值", () => {
      const schema: JSONSchema = {
        type: "string",
        enum: ["option1", "option2"],
      };
      expect(getDefaultValueForSchema(schema)).toBe("option1");
    });

    it("应该为 number 类型返回 0", () => {
      const schema: JSONSchema = { type: "number" };
      expect(getDefaultValueForSchema(schema)).toBe(0);
    });

    it("应该为 integer 类型返回 0", () => {
      const schema: JSONSchema = { type: "integer" };
      expect(getDefaultValueForSchema(schema)).toBe(0);
    });

    it("应该为 boolean 类型返回 false", () => {
      const schema: JSONSchema = { type: "boolean" };
      expect(getDefaultValueForSchema(schema)).toBe(false);
    });

    it("应该为 array 类型返回空数组", () => {
      const schema: JSONSchema = { type: "array" };
      expect(getDefaultValueForSchema(schema)).toEqual([]);
    });

    it("应该为 object 类型返回默认值对象", () => {
      const schema: JSONSchema = {
        type: "object",
        properties: {
          name: { type: "string" },
          age: { type: "number" },
          active: { type: "boolean" },
        },
      };
      expect(getDefaultValueForSchema(schema)).toEqual({
        name: "",
        age: 0,
        active: false,
      });
    });

    it("应该为没有 properties 的 object 类型返回空对象", () => {
      const schema: JSONSchema = { type: "object" };
      expect(getDefaultValueForSchema(schema)).toEqual({});
    });

    it("应该为空或无效的 schema 返回 undefined", () => {
      expect(getDefaultValueForSchema(null as unknown as JSONSchema)).toBeUndefined();
      expect(getDefaultValueForSchema(undefined as unknown as JSONSchema)).toBeUndefined();
    });

    it("应该处理嵌套对象", () => {
      const schema: JSONSchema = {
        type: "object",
        properties: {
          user: {
            type: "object",
            properties: {
              name: { type: "string" },
            },
          },
        },
      };
      expect(getDefaultValueForSchema(schema)).toEqual({
        user: {
          name: "",
        },
      });
    });
  });

  describe("createDefaultValues", () => {
    it("应该为必填字段创建默认值", () => {
      const schema: JSONSchema = {
        type: "object",
        properties: {
          name: { type: "string" },
          age: { type: "number" },
        },
        required: ["name", "age"],
      };
      expect(createDefaultValues(schema)).toEqual({
        name: "",
        age: 0,
      });
    });

    it("应该只对有有意义默认值的可选字段设置默认值", () => {
      const schema: JSONSchema = {
        type: "object",
        properties: {
          name: { type: "string" },
          age: { type: "number" },
          active: { type: "boolean" },
        },
        required: ["name"],
      };
      expect(createDefaultValues(schema)).toEqual({
        name: "",
        age: 0, // number 默认值 0
        active: false, // boolean 默认值 false
      });
    });

    it("应该为空或无效的 schema 返回空对象", () => {
      expect(createDefaultValues(null as unknown as JSONSchema)).toEqual({});
      expect(createDefaultValues(undefined as unknown as JSONSchema)).toEqual({});
      expect(createDefaultValues({} as JSONSchema)).toEqual({});
    });

    it("应该处理没有 required 字段的 schema", () => {
      const schema: JSONSchema = {
        type: "object",
        properties: {
          name: { type: "string" },
          age: { type: "number" },
        },
      };
      // 没有 required 字段时，所有字段都是可选的
      // 可选字段只有非空字符串的默认值才会被设置
      expect(createDefaultValues(schema)).toEqual({
        age: 0, // number 默认值 0 被包含
      });
    });
  });
});
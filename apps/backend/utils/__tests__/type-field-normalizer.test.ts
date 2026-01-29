import { describe, expect, it } from "vitest";
import { TypeFieldNormalizer } from "../type-field-normalizer.js";

describe("TypeFieldNormalizer", () => {
  describe("normalizeTypeField", () => {
    it("应该正确转换 streamable_http 为 streamable-http", () => {
      const config = {
        type: "streamable_http",
        url: "http://example.com",
      };
      const result = TypeFieldNormalizer.normalizeTypeField(config);
      expect(result).toEqual({
        type: "streamable-http",
        url: "http://example.com",
      });
    });

    it("应该正确转换 streamableHttp 为 streamable-http", () => {
      const config = {
        type: "streamableHttp",
        url: "http://example.com",
      };
      const result = TypeFieldNormalizer.normalizeTypeField(config);
      expect(result).toEqual({
        type: "streamable-http",
        url: "http://example.com",
      });
    });

    it("应该正确转换 s_se 为 sse", () => {
      const config = {
        type: "s_se",
        url: "http://example.com",
      };
      const result = TypeFieldNormalizer.normalizeTypeField(config);
      expect(result).toEqual({
        type: "sse",
        url: "http://example.com",
      });
    });

    it("应该正确转换 s-se 为 sse", () => {
      const config = {
        type: "s-se",
        url: "http://example.com",
      };
      const result = TypeFieldNormalizer.normalizeTypeField(config);
      expect(result).toEqual({
        type: "sse",
        url: "http://example.com",
      });
    });

    it("应该保持标准格式 streamable-http 不变", () => {
      const config = {
        type: "streamable-http",
        url: "http://example.com",
      };
      const result = TypeFieldNormalizer.normalizeTypeField(config);
      expect(result).toEqual({
        type: "streamable-http",
        url: "http://example.com",
      });
    });

    it("应该保持标准格式 sse 不变", () => {
      const config = {
        type: "sse",
        url: "http://example.com",
      };
      const result = TypeFieldNormalizer.normalizeTypeField(config);
      expect(result).toEqual({
        type: "sse",
        url: "http://example.com",
      });
    });

    it("应该处理没有 type 字段的配置", () => {
      const config = {
        url: "http://example.com",
        headers: { Authorization: "Bearer token" },
      };
      const result = TypeFieldNormalizer.normalizeTypeField(config);
      expect(result).toEqual({
        url: "http://example.com",
        headers: { Authorization: "Bearer token" },
      });
    });

    it("应该处理 stdio 类型的配置（command 字段）", () => {
      const config = {
        command: "node",
        args: ["server.js"],
      };
      const result = TypeFieldNormalizer.normalizeTypeField(config);
      expect(result).toEqual({
        command: "node",
        args: ["server.js"],
      });
    });

    it("应该处理空对象", () => {
      const config = {};
      const result = TypeFieldNormalizer.normalizeTypeField(config);
      expect(result).toEqual({});
    });

    it("应该处理 null 值", () => {
      const result = TypeFieldNormalizer.normalizeTypeField(null);
      expect(result).toBeNull();
    });

    it("应该处理 undefined 值", () => {
      const result = TypeFieldNormalizer.normalizeTypeField(undefined);
      expect(result).toBeUndefined();
    });

    it("应该处理非对象类型", () => {
      const result = TypeFieldNormalizer.normalizeTypeField("string");
      expect(result).toBe("string");
    });

    it("应该创建深拷贝而不修改原始对象", () => {
      const originalConfig = {
        type: "streamable_http",
        url: "http://example.com",
      };
      const result = TypeFieldNormalizer.normalizeTypeField(originalConfig);

      // 验证返回的对象是新的对象
      expect(result).not.toBe(originalConfig);

      // 验证原始对象未被修改
      expect(originalConfig.type).toBe("streamable_http");

      // 验证结果对象是正确的
      expect(result.type).toBe("streamable-http");
    });

    it("应该保持其他字段不变", () => {
      const config = {
        type: "streamable_http",
        url: "http://example.com",
        headers: { Authorization: "Bearer token" },
        timeout: 5000,
        retries: 3,
      };
      const result = TypeFieldNormalizer.normalizeTypeField(config);
      expect(result).toEqual({
        type: "streamable-http",
        url: "http://example.com",
        headers: { Authorization: "Bearer token" },
        timeout: 5000,
        retries: 3,
      });
    });

    it("应该处理无效的 type 字段（保留原值）", () => {
      const config = {
        type: "invalid-type",
        url: "http://example.com",
      };
      const result = TypeFieldNormalizer.normalizeTypeField(config);
      // 对于无效类型，应该保留原值
      expect(result).toEqual({
        type: "invalid-type",
        url: "http://example.com",
      });
    });

    it("应该处理复杂对象结构", () => {
      const config = {
        type: "streamable_http",
        server: {
          host: "localhost",
          port: 8080,
        },
        auth: {
          type: "bearer",
          token: "secret-token",
        },
      };
      const result = TypeFieldNormalizer.normalizeTypeField(config);
      expect(result).toEqual({
        type: "streamable-http",
        server: {
          host: "localhost",
          port: 8080,
        },
        auth: {
          type: "bearer",
          token: "secret-token",
        },
      });
    });
  });
});

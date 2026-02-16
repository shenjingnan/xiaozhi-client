/**
 * Type Field Normalizer 单元测试
 * 测试 MCP 服务器配置 Type 字段的标准化功能
 */

import { describe, expect, it } from "vitest";
import {
  type MCPBaseConfig,
  normalizeTypeField,
  TypeFieldNormalizer,
} from "../type-normalizer.js";

describe("TypeFieldNormalizer.normalizeTypeValue", () => {
  describe("HTTP 类型转换", () => {
    it("应该保持标准 http 格式不变", () => {
      expect(TypeFieldNormalizer.normalizeTypeValue("http")).toBe("http");
    });

    it("应该将 streamable-http 转换为 http", () => {
      expect(TypeFieldNormalizer.normalizeTypeValue("streamable-http")).toBe(
        "http"
      );
    });

    it("应该将 streamable_http 转换为 http", () => {
      expect(TypeFieldNormalizer.normalizeTypeValue("streamable_http")).toBe(
        "http"
      );
    });

    it("应该将 streamableHttp 转换为 http", () => {
      expect(TypeFieldNormalizer.normalizeTypeValue("streamableHttp")).toBe(
        "http"
      );
    });

    it("应该处理大小写混合的 HTTP 变体", () => {
      expect(TypeFieldNormalizer.normalizeTypeValue("Streamable-HTTP")).toBe(
        "http"
      );
      expect(TypeFieldNormalizer.normalizeTypeValue("STREAMABLE_HTTP")).toBe(
        "http"
      );
      expect(TypeFieldNormalizer.normalizeTypeValue("StreamableHttp")).toBe(
        "http"
      );
    });
  });

  describe("SSE 类型转换", () => {
    it("应该保持标准 sse 格式不变", () => {
      expect(TypeFieldNormalizer.normalizeTypeValue("sse")).toBe("sse");
    });

    it("应该将 s_se 转换为 sse", () => {
      expect(TypeFieldNormalizer.normalizeTypeValue("s_se")).toBe("sse");
    });

    it("应该将 s-se 转换为 sse", () => {
      expect(TypeFieldNormalizer.normalizeTypeValue("s-se")).toBe("sse");
    });

    it("应该处理大小写混合的 SSE 变体", () => {
      // SSE 全大写会被智能转换为 sse（因为包含 sse 关键字）
      expect(TypeFieldNormalizer.normalizeTypeValue("SSE")).toBe("sse");
      // S-Se 转小写后是 s-se，不包含 sse 关键字，所以保留原值
      expect(TypeFieldNormalizer.normalizeTypeValue("S-Se")).toBe("S-Se");
      // S_Se 转小写后是 s_se，不包含 sse 关键字，所以保留原值
      expect(TypeFieldNormalizer.normalizeTypeValue("S_Se")).toBe("S_Se");
    });
  });

  describe("STDIO 类型转换", () => {
    it("应该保持标准 stdio 格式不变", () => {
      expect(TypeFieldNormalizer.normalizeTypeValue("stdio")).toBe("stdio");
    });

    it("应该处理大小写混合的 stdio", () => {
      expect(TypeFieldNormalizer.normalizeTypeValue("STDIO")).toBe("stdio");
      expect(TypeFieldNormalizer.normalizeTypeValue("Stdio")).toBe("stdio");
    });
  });

  describe("智能格式转换", () => {
    it("应该将包含 http 关键字的格式转换为 http", () => {
      expect(TypeFieldNormalizer.normalizeTypeValue("http-server")).toBe(
        "http"
      );
      expect(TypeFieldNormalizer.normalizeTypeValue("my-transport-http")).toBe(
        "http"
      );
    });

    it("应该将包含 streamable 关键字的格式转换为 http", () => {
      expect(
        TypeFieldNormalizer.normalizeTypeValue("streamable-protocol")
      ).toBe("http");
      expect(
        TypeFieldNormalizer.normalizeTypeValue("my-streamable-transport")
      ).toBe("http");
    });

    it("应该将包含 sse 关键字的格式转换为 sse", () => {
      expect(TypeFieldNormalizer.normalizeTypeValue("sse-transport")).toBe(
        "sse"
      );
      expect(TypeFieldNormalizer.normalizeTypeValue("my-sse-server")).toBe(
        "sse"
      );
    });

    it("应该将包含 stdio 关键字的格式转换为 stdio", () => {
      expect(TypeFieldNormalizer.normalizeTypeValue("stdio-server")).toBe(
        "stdio"
      );
      expect(TypeFieldNormalizer.normalizeTypeValue("my-stdio-transport")).toBe(
        "stdio"
      );
    });
  });

  describe("边界情况处理", () => {
    it("应该处理完全无关的格式，返回原值", () => {
      const unknown = "unknown-transport";
      expect(TypeFieldNormalizer.normalizeTypeValue(unknown)).toBe(unknown);
    });

    it("应该处理空字符串", () => {
      expect(TypeFieldNormalizer.normalizeTypeValue("")).toBe("");
    });

    it("应该处理仅包含分隔符的格式", () => {
      expect(TypeFieldNormalizer.normalizeTypeValue("-_-")).toBe("-_-");
    });

    it("应该处理数字字符串", () => {
      expect(TypeFieldNormalizer.normalizeTypeValue("123")).toBe("123");
    });
  });
});

describe("TypeFieldNormalizer.normalizeTypeField", () => {
  describe("标准配置对象处理", () => {
    it("应该处理包含标准 http 类型的配置", () => {
      const config = { type: "http", url: "https://example.com" };
      const result = TypeFieldNormalizer.normalizeTypeField(config);
      expect(result).toEqual(config);
      expect(result).not.toBe(config); // 应该是深拷贝
    });

    it("应该转换 streamable-http 为 http", () => {
      const config = { type: "streamable-http", url: "https://example.com" };
      const result = TypeFieldNormalizer.normalizeTypeField(config);
      expect(result.type).toBe("http");
      expect(result.url).toBe("https://example.com");
    });

    it("应该转换 s_se 为 sse", () => {
      const config = { type: "s_se", url: "https://example.com" };
      const result = TypeFieldNormalizer.normalizeTypeField(config);
      expect(result.type).toBe("sse");
    });
  });

  describe("非对象输入处理", () => {
    it("应该处理 null 输入", () => {
      expect(TypeFieldNormalizer.normalizeTypeField(null)).toBeNull();
    });

    it("应该处理 undefined 输入", () => {
      expect(TypeFieldNormalizer.normalizeTypeField(undefined)).toBeUndefined();
    });

    it("应该处理基本类型输入", () => {
      expect(TypeFieldNormalizer.normalizeTypeField("string")).toBe("string");
      expect(TypeFieldNormalizer.normalizeTypeField(123)).toBe(123);
      expect(TypeFieldNormalizer.normalizeTypeField(true)).toBe(true);
    });

    it("应该处理数组输入", () => {
      const arr = [1, 2, 3];
      expect(TypeFieldNormalizer.normalizeTypeField(arr)).toEqual(arr);
    });
  });

  describe("无 type 字段的配置", () => {
    it("应该保持无 type 字段的配置不变", () => {
      const config = { url: "https://example.com", name: "test" };
      const result = TypeFieldNormalizer.normalizeTypeField(config);
      expect(result).toEqual(config);
      expect(result).not.toBe(config); // 应该是深拷贝
    });
  });

  describe("无效 type 值的处理", () => {
    it("应该保留无法识别的 type 值", () => {
      const config = { type: "unknown-type", url: "https://example.com" };
      const result = TypeFieldNormalizer.normalizeTypeField(config);
      expect(result.type).toBe("unknown-type");
    });

    it("应该保留空字符串 type 值", () => {
      const config = { type: "", url: "https://example.com" };
      const result = TypeFieldNormalizer.normalizeTypeField(config);
      expect(result.type).toBe("");
    });
  });

  describe("深拷贝验证", () => {
    it("应该创建对象的深拷贝，不修改原对象", () => {
      const originalConfig = {
        type: "streamable-http",
        url: "https://example.com",
        nested: { value: 42 },
      };
      const originalCopy = JSON.parse(JSON.stringify(originalConfig));

      const result = TypeFieldNormalizer.normalizeTypeField(originalConfig);

      expect(originalConfig).toEqual(originalCopy); // 原对象未被修改
      expect(result.type).toBe("http");
      expect(result).not.toBe(originalConfig);
    });
  });

  describe("类型安全", () => {
    it("应该保持其他字段不变", () => {
      const config = {
        type: "streamable-http",
        url: "https://example.com",
        timeout: 30000,
        apiKey: "secret",
        headers: { "X-Custom": "value" },
      };
      const result = TypeFieldNormalizer.normalizeTypeField(config);
      expect(result.type).toBe("http");
      expect(result.url).toBe("https://example.com");
      expect(result.timeout).toBe(30000);
      expect(result.apiKey).toBe("secret");
      expect(result.headers).toEqual({ "X-Custom": "value" });
    });
  });
});

describe("便捷函数 normalizeTypeField", () => {
  describe("与命名空间函数的一致性", () => {
    it("应该与 TypeFieldNormalizer.normalizeTypeField 行为一致", () => {
      const config1 = { type: "streamable-http", url: "https://example.com" };
      const config2 = { type: "streamable-http", url: "https://example.com" };

      const result1 = normalizeTypeField(config1);
      const result2 = TypeFieldNormalizer.normalizeTypeField(config2);

      expect(result1).toEqual(result2);
    });
  });

  describe("泛型类型支持", () => {
    it("应该正确处理 MCPBaseConfig 类型", () => {
      const config: MCPBaseConfig = {
        type: "streamable-http",
        url: "https://example.com",
      };
      const result = normalizeTypeField(config);
      expect(result.type).toBe("http");
    });

    it("应该正确处理扩展配置类型", () => {
      interface ExtendedConfig extends MCPBaseConfig {
        url: string;
        timeout?: number;
      }
      const config: ExtendedConfig = {
        type: "streamable-http",
        url: "https://example.com",
        timeout: 30000,
      };
      const result = normalizeTypeField(config);
      expect(result.type).toBe("http");
      expect(result.url).toBe("https://example.com");
      expect(result.timeout).toBe(30000);
    });
  });
});

describe("综合场景测试", () => {
  it("应该正确处理复杂的嵌套配置对象", () => {
    const config = {
      type: "streamable_http",
      url: "https://example.com/mcp",
      metadata: {
        name: "test-service",
        version: "1.0.0",
      },
      options: {
        timeout: 30000,
        retry: 3,
      },
    };

    const result = normalizeTypeField(config);

    expect(result.type).toBe("http");
    expect(result.url).toBe("https://example.com/mcp");
    expect(result.metadata).toEqual(config.metadata);
    expect(result.options).toEqual(config.options);
  });

  it("应该批量处理多个配置对象", () => {
    const configs = [
      { type: "streamable-http", url: "https://api1.com" },
      { type: "s_se", url: "https://api2.com" },
      { type: "stdio", command: "node", args: ["server.js"] },
      { type: "unknown", url: "https://api3.com" },
    ];

    const results = configs.map((c) => normalizeTypeField(c));

    expect(results[0].type).toBe("http");
    expect(results[1].type).toBe("sse");
    expect(results[2].type).toBe("stdio");
    expect(results[3].type).toBe("unknown");
  });
});

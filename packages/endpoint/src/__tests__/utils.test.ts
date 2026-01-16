/**
 * 工具函数单元测试
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  deepMerge,
  decodeJWTToken,
  extractTokenFromUrl,
  formatErrorMessage,
  isValidEndpointUrl,
  parseEndpointUrl,
  sleep,
  sliceEndpoint,
  validateToolCallParams,
} from "../utils.js";

describe("工具函数测试", () => {
  describe("sliceEndpoint", () => {
    it("应该正确截断长 URL", () => {
      const longUrl =
        "ws://very-long-endpoint-url-here.example.com/very/long/path/endpoint";
      const result = sliceEndpoint(longUrl);
      // 前30个字符 + ... + 后10个字符（h/endpoint）
      expect(result).toBe("ws://very-long-endpoint-url-he...h/endpoint");
    });

    it("应该正确截断中等长度 URL", () => {
      const url = "ws://example.com/endpoint";
      const result = sliceEndpoint(url);
      // 前30个字符 + ... + 后10个字符（m/endpoint）
      expect(result).toBe("ws://example.com/endpoint...m/endpoint");
    });

    it("应该处理短 URL", () => {
      const url = "ws://localhost:3000";
      const result = sliceEndpoint(url);
      // 前30个字符 + ... + 后10个字符（lhost:3000）
      expect(result).toBe("ws://localhost:3000...lhost:3000");
    });

    it("应该正确处理 wss 协议", () => {
      const url = "wss://secure.example.com/endpoint";
      const result = sliceEndpoint(url);
      // 前30个字符 + ... + 后10个字符（m/endpoint）
      expect(result).toBe("wss://secure.example.com/endpo...m/endpoint");
    });

    it("应该保持截断格式一致", () => {
      const url1 = `ws://${"a".repeat(50)}.com/endpoint`;
      const url2 = `ws://${"b".repeat(50)}.com/endpoint`;
      const result1 = sliceEndpoint(url1);
      const result2 = sliceEndpoint(url2);

      // 验证格式：开头30个字符 + ... + 结尾10个字符
      expect(result1.length).toBe(30 + 3 + 10);
      expect(result2.length).toBe(30 + 3 + 10);
      expect(result1).toContain("...");
      expect(result2).toContain("...");
    });

    it("应该截断超长 URL", () => {
      const url = `ws://${"a".repeat(50)}.com/endpoint`;
      const result = sliceEndpoint(url);
      // 前30个字符 + ... + 后10个字符
      expect(result.length).toBe(30 + 3 + 10);
      expect(result).toContain("...");
      expect(result.endsWith("m/endpoint")).toBe(true);
    });
  });

  describe("validateToolCallParams", () => {
    it("应该验证有效的工具调用参数", () => {
      const params = {
        name: "test_tool",
        arguments: { foo: "bar" },
      };
      const result = validateToolCallParams(params);
      expect(result.name).toBe("test_tool");
      expect(result.arguments).toEqual({ foo: "bar" });
    });

    it("应该验证不带 arguments 的参数", () => {
      const params = {
        name: "test_tool",
      };
      const result = validateToolCallParams(params);
      expect(result.name).toBe("test_tool");
      expect(result.arguments).toBeUndefined();
    });

    it("应该拒绝 null 参数", () => {
      expect(() => validateToolCallParams(null)).toThrow("工具调用参数必须是对象");
    });

    it("应该拒绝 undefined 参数", () => {
      expect(() => validateToolCallParams(undefined)).toThrow("工具调用参数必须是对象");
    });

    it("应该拒绝非对象参数", () => {
      // 字符串不是对象
      expect(() => validateToolCallParams("string")).toThrow("工具调用参数必须是对象");
      // 数字不是对象
      expect(() => validateToolCallParams(123)).toThrow("工具调用参数必须是对象");
      // 数组虽然 typeof 是 'object'，但没有 name 属性，会抛出"工具名称必须是字符串"
      expect(() => validateToolCallParams([])).toThrow("工具名称必须是字符串");
    });

    it("应该拒绝缺少 name 字段的参数", () => {
      const params = {
        arguments: { foo: "bar" },
      };
      expect(() => validateToolCallParams(params)).toThrow("工具名称必须是字符串");
    });

    it("应该拒绝非字符串的 name", () => {
      expect(() =>
        validateToolCallParams({ name: 123 })
      ).toThrow("工具名称必须是字符串");
      expect(() =>
        validateToolCallParams({ name: null })
      ).toThrow("工具名称必须是字符串");
    });

    it("应该拒绝非对象的 arguments", () => {
      expect(() =>
        validateToolCallParams({ name: "test", arguments: "string" })
      ).toThrow("工具参数必须是对象");
      expect(() =>
        validateToolCallParams({ name: "test", arguments: null })
      ).toThrow("工具参数必须是对象");
    });

    it("应该接受空对象的 arguments", () => {
      const params = {
        name: "test_tool",
        arguments: {},
      };
      const result = validateToolCallParams(params);
      expect(result.arguments).toEqual({});
    });
  });

  describe("isValidEndpointUrl", () => {
    it("应该接受有效的 ws:// URL", () => {
      expect(isValidEndpointUrl("ws://localhost:3000")).toBe(true);
      expect(isValidEndpointUrl("ws://example.com/endpoint")).toBe(true);
      expect(isValidEndpointUrl("ws://192.168.1.1:8080/path")).toBe(true);
    });

    it("应该接受有效的 wss:// URL", () => {
      expect(isValidEndpointUrl("wss://secure.example.com/endpoint")).toBe(true);
      expect(isValidEndpointUrl("wss://api.example.com:443/path")).toBe(true);
    });

    it("应该拒绝非 WebSocket 协议的 URL", () => {
      expect(isValidEndpointUrl("http://example.com")).toBe(false);
      expect(isValidEndpointUrl("https://example.com")).toBe(false);
      expect(isValidEndpointUrl("ftp://example.com")).toBe(false);
      expect(isValidEndpointUrl("tcp://example.com")).toBe(false);
    });

    it("应该拒绝无效的 URL 格式", () => {
      expect(isValidEndpointUrl("not-a-url")).toBe(false);
      expect(isValidEndpointUrl("ws://")).toBe(false);
      expect(isValidEndpointUrl("ws:/example.com")).toBe(false);
      expect(isValidEndpointUrl("//example.com")).toBe(false);
    });

    it("应该拒绝空字符串", () => {
      expect(isValidEndpointUrl("")).toBe(false);
    });

    it("应该拒绝非字符串参数", () => {
      expect(isValidEndpointUrl(null as any)).toBe(false);
      expect(isValidEndpointUrl(undefined as any)).toBe(false);
      expect(isValidEndpointUrl(123 as any)).toBe(false);
    });

    it("应该接受带路径和查询参数的 WebSocket URL", () => {
      expect(isValidEndpointUrl("ws://example.com/path?query=value")).toBe(true);
      expect(isValidEndpointUrl("wss://example.com/path/to/endpoint?id=123&token=abc")).toBe(
        true
      );
    });
  });

  describe("deepMerge", () => {
    it("应该合并简单对象", () => {
      const target = { a: 1, b: 2 };
      const source = { b: 3, c: 4 };
      const result = deepMerge(target, source);
      expect(result).toEqual({ a: 1, b: 3, c: 4 });
    });

    it("应该深度合并嵌套对象", () => {
      const target = {
        a: 1,
        b: { x: 1, y: 2 },
      };
      const source = {
        b: { y: 3, z: 4 },
        c: 5,
      };
      const result = deepMerge(target, source);
      expect(result).toEqual({
        a: 1,
        b: { x: 1, y: 3, z: 4 },
        c: 5,
      });
    });

    it("应该处理多个源对象", () => {
      const target = { a: 1 };
      const source1 = { b: 2 };
      const source2 = { c: 3 };
      const result = deepMerge(target, source1, source2);
      expect(result).toEqual({ a: 1, b: 2, c: 3 });
    });

    it("应该处理数组值（直接覆盖）", () => {
      const target = { arr: [1, 2, 3] };
      const source = { arr: [4, 5] };
      const result = deepMerge(target, source);
      expect(result.arr).toEqual([4, 5]);
    });

    it("应该处理 null 值", () => {
      const target = { a: 1, b: { x: 1 } };
      const source = { b: null as any };
      const result = deepMerge(target, source);
      expect(result.b).toBe(null);
    });

    it("应该返回空对象当没有源对象时", () => {
      const target = { a: 1 };
      const result = deepMerge(target);
      expect(result).toEqual({ a: 1 });
    });

    it("应该正确处理多个深度嵌套", () => {
      const target = {
        level1: {
          level2: {
            level3: { a: 1 },
          },
        },
      };
      const source = {
        level1: {
          level2: {
            level3: { b: 2 },
          },
        },
      };
      const result = deepMerge(target, source);
      expect(result.level1.level2.level3).toEqual({ a: 1, b: 2 });
    });
  });

  describe("deepMerge - 原型污染防护", () => {
    it("应该阻止 __proto__ 污染攻击", () => {
      const target = { user: "guest" };
      const malicious = { __proto__: { isAdmin: true } } as any;

      deepMerge(target, malicious);

      // 验证原型未被污染
      expect(({} as any).isAdmin).toBeUndefined();
      expect(target).toEqual({ user: "guest" });
    });

    it("应该阻止 constructor 污染攻击", () => {
      const target = { config: {} };
      const malicious = {
        constructor: { prototype: { polluted: true } },
      } as any;

      deepMerge(target, malicious);

      // 验证原型未被污染
      expect(({} as any).polluted).toBeUndefined();
    });

    it("应该阻止 prototype 污染攻击", () => {
      const target = { data: {} };
      const malicious = { prototype: { malicious: true } } as any;

      deepMerge(target, malicious);

      // 验证原型未被污染
      expect(({} as any).malicious).toBeUndefined();
    });

    it("应该正常合并合法属性", () => {
      const target = { a: 1, b: { x: 1 } };
      const source = { b: { y: 2 }, c: 3 };

      const result = deepMerge(target, source);
      expect(result).toEqual({ a: 1, b: { x: 1, y: 2 }, c: 3 });
    });

    it("应该忽略包含危险 key 的嵌套对象", () => {
      const target = { config: { setting: "value" } };
      const malicious = {
        config: { __proto__: { hacked: true } } as any,
      };

      deepMerge(target, malicious);

      // 验证原型未被污染
      expect(({} as any).hacked).toBeUndefined();
      // 验证正常属性不受影响
      expect(target.config.setting).toBe("value");
    });

    it("应该处理多个源对象中的危险 key", () => {
      const target = { safe: true };
      const source1 = { __proto__: { bad1: true } } as any;
      const source2 = { constructor: { bad2: true } } as any;
      const source3 = { prototype: { bad3: true } } as any;
      const source4 = { normal: "value" };

      const result = deepMerge(target, source1, source2, source3, source4);

      // 验证原型未被污染
      expect(({} as any).bad1).toBeUndefined();
      expect(({} as any).bad2).toBeUndefined();
      expect(({} as any).bad3).toBeUndefined();
      // 验证正常属性正确合并
      expect(result).toEqual({ safe: true, normal: "value" });
    });
  });

  describe("sleep", () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    it("应该延迟指定的时间", async () => {
      const promise = sleep(1000);
      let resolved = false;

      promise.then(() => {
        resolved = true;
      });

      // 前进时间到 999ms，不应该解决
      vi.advanceTimersByTime(999);
      await Promise.resolve(); // 让微任务执行
      expect(resolved).toBe(false);

      // 前进时间到 1000ms，应该解决
      vi.advanceTimersByTime(1);
      await Promise.resolve(); // 让微任务执行
      expect(resolved).toBe(true);
    });

    it("应该立即处理 0ms 延迟", async () => {
      const promise = sleep(0);
      vi.advanceTimersByTime(0);
      await expect(promise).resolves.toBeUndefined();
    });

    it("应该正确处理长延迟", async () => {
      const promise = sleep(10000);
      vi.advanceTimersByTime(10000);
      await expect(promise).resolves.toBeUndefined();
    });
  });

  describe("formatErrorMessage", () => {
    it("应该正确格式化 Error 对象", () => {
      const error = new Error("Test error message");
      const result = formatErrorMessage(error);
      expect(result).toBe("Test error message");
    });

    it("应该正确格式化字符串", () => {
      const result = formatErrorMessage("String error message");
      expect(result).toBe("String error message");
    });

    it("应该将其他类型转换为字符串", () => {
      expect(formatErrorMessage(123)).toBe("123");
      expect(formatErrorMessage(null)).toBe("null");
      expect(formatErrorMessage(undefined)).toBe("undefined");
      expect(formatErrorMessage({})).toBe("[object Object]");
    });

    it("应该处理带自定义消息的 Error", () => {
      class CustomError extends Error {
        constructor(message: string) {
          super(message);
          this.name = "CustomError";
        }
      }
      const error = new CustomError("Custom error message");
      const result = formatErrorMessage(error);
      expect(result).toBe("Custom error message");
    });

    it("应该处理空对象", () => {
      const result = formatErrorMessage({});
      expect(result).toBe("[object Object]");
    });
  });

  describe("边界情况处理", () => {
    it("sliceEndpoint 应该处理正好 40 个字符的 URL", () => {
      const url = "ws://123456789012345678901234567890123.com/abc";
      expect(url.length).toBe(46); // 46 个字符
      const result = sliceEndpoint(url);
      expect(result).toBeDefined();
      expect(typeof result).toBe("string");
    });

    it("validateToolCallParams 应该处理空对象", () => {
      expect(() => validateToolCallParams({})).toThrow("工具名称必须是字符串");
    });

    it("isValidEndpointUrl 应该处理只有协议的 URL", () => {
      expect(isValidEndpointUrl("ws://")).toBe(false);
      expect(isValidEndpointUrl("wss://")).toBe(false);
    });

    it("deepMerge 应该处理空对象合并", () => {
      const result = deepMerge({}, {});
      expect(result).toEqual({});
    });
  });

  describe("JWT Token 解码", () => {
    describe("decodeJWTToken", () => {
      // 生成一个有效的测试 Token
      const validPayload = {
        userId: 302720,
        agentId: 1324149,
        endpointId: "agent_1324149",
        purpose: "mcp-endpoint",
        iat: 1768480930,
        exp: 1800038530,
      };
      const header = btoa(JSON.stringify({ alg: "ES256", typ: "JWT" }))
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=/g, "");
      const payload = btoa(JSON.stringify(validPayload))
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=/g, "");
      const signature = "test_signature";
      const validToken = `${header}.${payload}.${signature}`;

      it("应该正确解码有效的 JWT Token", () => {
        const result = decodeJWTToken(validToken);
        expect(result).not.toBeNull();
        expect(result?.userId).toBe(302720);
        expect(result?.agentId).toBe(1324149);
        expect(result?.endpointId).toBe("agent_1324149");
        expect(result?.purpose).toBe("mcp-endpoint");
      });

      it("应该拒绝空字符串", () => {
        expect(decodeJWTToken("")).toBeNull();
      });

      it("应该拒绝 null", () => {
        expect(decodeJWTToken(null as any)).toBeNull();
      });

      it("应该拒绝 undefined", () => {
        expect(decodeJWTToken(undefined as any)).toBeNull();
      });

      it("应该拒绝格式错误的 Token（缺少部分）", () => {
        expect(decodeJWTToken("only_one_part")).toBeNull();
        expect(decodeJWTToken("two.parts")).toBeNull();
      });

      it("应该拒绝无效的 Base64 编码", () => {
        expect(decodeJWTToken("header.invalid!base64.signature")).toBeNull();
      });

      it("应该拒绝无效的 JSON", () => {
        const header = btoa(JSON.stringify({ alg: "ES256", typ: "JWT" }))
          .replace(/\+/g, "-")
          .replace(/\//g, "_")
          .replace(/=/g, "");
        const invalidJsonPayload = btoa("not a valid json")
          .replace(/\+/g, "-")
          .replace(/\//g, "_")
          .replace(/=/g, "");
        const invalidToken = `${header}.${invalidJsonPayload}.signature`;
        expect(decodeJWTToken(invalidToken)).toBeNull();
      });

      it("应该拒绝缺少必需字段的 Payload", () => {
        const header = btoa(JSON.stringify({ alg: "ES256", typ: "JWT" }))
          .replace(/\+/g, "-")
          .replace(/\//g, "_")
          .replace(/=/g, "");
        const incompletePayload = btoa(JSON.stringify({ userId: 123 }))
          .replace(/\+/g, "-")
          .replace(/\//g, "_")
          .replace(/=/g, "");
        const incompleteToken = `${header}.${incompletePayload}.signature`;
        expect(decodeJWTToken(incompleteToken)).toBeNull();
      });
    });

    describe("extractTokenFromUrl", () => {
      it("应该从 URL 中提取 token 参数", () => {
        const url = "wss://api.xiaozhi.me/mcp/?token=eyJhbGciOiJFUzI1NiIsInR5cCI6IkpXVCJ9.test";
        const result = extractTokenFromUrl(url);
        expect(result).toBe("eyJhbGciOiJFUzI1NiIsInR5cCI6IkpXVCJ9.test");
      });

      it("应该处理包含多个查询参数的 URL", () => {
        const url = "wss://api.example.com/mcp/?id=123&token=my_token&other=value";
        const result = extractTokenFromUrl(url);
        expect(result).toBe("my_token");
      });

      it("应该处理没有 token 参数的 URL", () => {
        const url = "wss://api.example.com/mcp/?id=123&other=value";
        const result = extractTokenFromUrl(url);
        expect(result).toBeNull();
      });

      it("应该处理没有查询参数的 URL", () => {
        const url = "wss://api.example.com/mcp/";
        const result = extractTokenFromUrl(url);
        expect(result).toBeNull();
      });

      it("应该拒绝空字符串", () => {
        expect(extractTokenFromUrl("")).toBeNull();
      });

      it("应该拒绝无效的 URL", () => {
        expect(extractTokenFromUrl("not-a-url")).toBeNull();
      });

      it("应该处理带端口号的 URL", () => {
        const url = "wss://api.example.com:8080/mcp/?token=test_token";
        const result = extractTokenFromUrl(url);
        expect(result).toBe("test_token");
      });
    });

    describe("parseEndpointUrl", () => {
      // 生成一个有效的测试 Token
      const validPayload = {
        userId: 302720,
        agentId: 1324149,
        endpointId: "agent_1324149",
        purpose: "mcp-endpoint",
        iat: 1768480930,
        exp: 1800038530,
      };
      const header = btoa(JSON.stringify({ alg: "ES256", typ: "JWT" }))
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=/g, "");
      const payload = btoa(JSON.stringify(validPayload))
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=/g, "");
      const signature = "test_signature";
      const validToken = `${header}.${payload}.${signature}`;

      it("应该正确解析完整的 endpoint URL", () => {
        const url = `wss://api.xiaozhi.me/mcp/?token=${validToken}`;
        const result = parseEndpointUrl(url);

        expect(result).not.toBeNull();
        expect(result?.url).toBe(url);
        expect(result?.token).toBe(validToken);
        expect(result?.payload.userId).toBe(302720);
        expect(result?.payload.agentId).toBe(1324149);
        expect(result?.payload.endpointId).toBe("agent_1324149");
        expect(result?.wsUrl).toBe("wss://api.xiaozhi.me/mcp/");
      });

      it("应该从 wsUrl 中移除 token 参数", () => {
        const url = `wss://api.example.com:8080/path?token=${validToken}&id=123`;
        const result = parseEndpointUrl(url);

        expect(result?.wsUrl).toBe("wss://api.example.com:8080/path?id=123");
        expect(result?.wsUrl).not.toContain("token");
      });

      it("应该拒绝没有 token 的 URL", () => {
        const url = "wss://api.example.com/mcp/?id=123";
        const result = parseEndpointUrl(url);
        expect(result).toBeNull();
      });

      it("应该拒绝包含无效 token 的 URL", () => {
        const url = "wss://api.example.com/mcp/?token=invalid_token";
        const result = parseEndpointUrl(url);
        expect(result).toBeNull();
      });

      it("应该拒绝空字符串", () => {
        expect(parseEndpointUrl("")).toBeNull();
      });

      it("应该拒绝无效的 URL 格式", () => {
        expect(parseEndpointUrl("not-a-url")).toBeNull();
      });
    });
  });
});

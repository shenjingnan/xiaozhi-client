import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Mock } from "vitest";
import {
  ConfigValidationError,
  convertLegacyToNew,
  isModelScopeURL,
  MCPTransportType,
} from "../adapter.js";

// Mock console 方法
let mockConsoleLog: Mock;
let mockConsoleError: Mock;

beforeEach(() => {
  vi.clearAllMocks();
  mockConsoleLog = vi.fn();
  mockConsoleError = vi.fn();

  // Mock console 方法
  const originalConsoleLog = console.log;
  const originalConsoleError = console.error;
  console.log = mockConsoleLog;
  console.error = mockConsoleError;

  // 恢复原始方法（在测试结束时）
  return () => {
    console.log = originalConsoleLog;
    console.error = originalConsoleError;
  };
});

describe("ConfigAdapter 配置适配器测试", () => {
  describe("URL 类型推断", () => {
    describe("SSE 类型推断", () => {
      it("应该根据 /sse 路径推断为 SSE 类型", () => {
        const config = { url: "https://example.com/sse" };
        const result = convertLegacyToNew("test-service", config);
        expect(result.type).toBe(MCPTransportType.SSE);
      });

      it("应该正确处理带有查询参数的 SSE URL", () => {
        const config = { url: "https://mcp.amap.com/sse?key=test&token=abc" };
        const result = convertLegacyToNew("amap-service", config);
        expect(result.type).toBe(MCPTransportType.SSE);
      });

      it("应该正确处理嵌套 SSE 路径", () => {
        const testCases = [
          "https://api.example.com/v1/sse",
          "https://api.example.com/v1/v2/sse",
          "https://api.example.com/service/v1/sse",
        ];

        for (const url of testCases) {
          const result = convertLegacyToNew("test-service", { url });
          expect(result.type).toBe(MCPTransportType.SSE);
        }
      });

      it("应该正确处理带端口的 SSE URL", () => {
        const config = { url: "https://localhost:3000/sse" };
        const result = convertLegacyToNew("local-service", config);
        expect(result.type).toBe(MCPTransportType.SSE);
      });
    });

    describe("HTTP 类型推断", () => {
      it("应该根据 /mcp 路径推断为 HTTP 类型", () => {
        const config = {
          url: "https://mcp.api-inference.modelscope.net/8928ccc99fa34b/mcp",
        };
        const result = convertLegacyToNew("modelscope-service", config);
        expect(result.type).toBe(MCPTransportType.HTTP);
      });

      it("应该为其他路径推断为 HTTP 类型", () => {
        const testCases = [
          "https://example.com/api",
          "https://api.example.com/v1/endpoint",
          "https://mcp.example.com/custom",
        ];

        for (const url of testCases) {
          const result = convertLegacyToNew("test-service", { url });
          expect(result.type).toBe(MCPTransportType.HTTP);
        }
      });

      it("应该为普通 ModelScope URL（非 /sse 结尾）推断为 HTTP", () => {
        const config = {
          url: "https://mcp.api-inference.modelscope.net/8928ccc99fa34b/mcp",
        };
        const result = convertLegacyToNew("modelscope-service", config);
        expect(result.type).toBe(MCPTransportType.HTTP);
      });
    });

    describe("无效 URL 处理", () => {
      it("应该为无效 URL 默认推断为 HTTP", () => {
        const config = { url: "not-a-valid-url" };
        const result = convertLegacyToNew("test-service", config);
        expect(result.type).toBe(MCPTransportType.HTTP);
      });
    });
  });

  describe("显式类型指定", () => {
    it("应该优先使用显式指定的 sse 类型", () => {
      const config = { type: "sse" as const, url: "https://example.com/custom" };
      const result = convertLegacyToNew("test-service", config);
      expect(result.type).toBe(MCPTransportType.SSE);
    });

    it("应该优先使用显式指定的 http 类型（兼容 streamable-http）", () => {
      const config = {
        type: "http" as const,
        url: "https://example.com/sse",
      };
      const result = convertLegacyToNew("test-service", config);
      expect(result.type).toBe(MCPTransportType.HTTP);
    });
  });

  describe("ModelScope URL 检测", () => {
    it("应该正确识别 ModelScope .net 域名", () => {
      expect(
        isModelScopeURL("https://mcp.api-inference.modelscope.net/8928ccc99fa34b/mcp")
      ).toBe(true);
    });

    it("应该正确识别 ModelScope .cn 域名", () => {
      expect(isModelScopeURL("https://api.modelscope.cn/mcp/sse")).toBe(true);
    });

    it("应该对非 ModelScope URL 返回 false", () => {
      expect(isModelScopeURL("https://example.com/sse")).toBe(false);
      expect(isModelScopeURL("https://mcp.amap.com/sse")).toBe(false);
    });

    it("应该为 ModelScope SSE 服务添加认证标识", () => {
      const config = {
        url: "https://mcp.api-inference.modelscope.net/f0fed2f733514b/sse",
      };
      const result = convertLegacyToNew("modelscope-service", config);
      expect(result.modelScopeAuth).toBe(true);
    });
  });

  describe("本地 stdio 配置", () => {
    it("应该正确转换本地 stdio 配置", () => {
      const config = {
        command: "node",
        args: ["./server.js"],
      };
      const result = convertLegacyToNew("local-service", config);
      expect(result.type).toBe(MCPTransportType.STDIO);
      expect(result.command).toBe("node");
      // 相对路径会被解析为绝对路径
      expect(result.args).toBeDefined();
      expect(result.args![0]).toMatch(/server\.js$/);
    });

    it("应该解析相对路径为绝对路径", () => {
      const config = {
        command: "python",
        args: ["./script.py", "./config.json"],
      };
      const result = convertLegacyToNew("local-service", config);
      // 验证 args 已被解析为绝对路径
      expect(result.args).toBeDefined();
      expect(result.args![0]).toMatch(/\/script\.py$/);
      expect(result.args![1]).toMatch(/\/config\.json$/);
    });
  });

  describe("错误处理", () => {
    it("应该为缺少服务名称的配置抛出错误", () => {
      expect(() => convertLegacyToNew("", { url: "https://example.com/sse" })).toThrow(
        ConfigValidationError
      );
    });

    it("应该为空配置对象抛出错误", () => {
      expect(() =>
        convertLegacyToNew("test", null as unknown as any)
      ).toThrow(ConfigValidationError);
    });

    it("应该为无效的传输类型抛出错误", () => {
      const config = { type: "invalid-type" as any, url: "https://example.com" };
      expect(() => convertLegacyToNew("test-service", config)).toThrow(
        ConfigValidationError
      );
    });
  });

  describe("与 MCPService 推断一致性测试", () => {
    const testCases = [
      {
        url: "https://example.com/sse",
        expected: MCPTransportType.SSE,
        description: "简单 SSE 路径",
      },
      {
        url: "https://mcp.amap.com/sse?key=test",
        expected: MCPTransportType.SSE,
        description: "高德地图 SSE 路径",
      },
      {
        url: "https://mcp.api-inference.modelscope.net/8928ccc99fa34b/mcp",
        expected: MCPTransportType.HTTP,
        description: "复杂 ModelScope MCP 路径",
      },
      {
        url: "https://mcp.api-inference.modelscope.net/f0fed2f733514b/sse",
        expected: MCPTransportType.SSE,
        description: "ModelScope SSE 路径",
      },
      {
        url: "https://example.com/api/v1/endpoint",
        expected: MCPTransportType.HTTP,
        description: "普通 API 端点",
      },
    ];

    for (const { url, expected, description } of testCases) {
      it(`应该正确推断: ${description}`, () => {
        const result = convertLegacyToNew("test-service", { url });
        expect(result.type).toBe(expected);
      });
    }
  });
});

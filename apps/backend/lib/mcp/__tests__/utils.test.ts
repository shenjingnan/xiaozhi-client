import { logger } from "@/Logger.js";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MCPTransportType } from "../types.js";
import type { MCPServiceConfig } from "../types.js";
import {
  inferTransportTypeFromConfig,
  inferTransportTypeFromUrl,
} from "../utils.js";

// Mock Logger
vi.mock("@/Logger.js", () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    withTag: vi.fn().mockReturnValue({
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
    }),
  },
}));

beforeEach(() => {
  vi.clearAllMocks();
});

describe("MCP 传输类型推断工具", () => {
  describe("inferTransportTypeFromUrl", () => {
    describe("SSE 类型推断", () => {
      it("应该根据 /sse 路径推断为 SSE 类型", () => {
        const url = "https://mcp.amap.com/sse?key=test";
        const result = inferTransportTypeFromUrl(url);
        expect(result).toBe(MCPTransportType.SSE);
      });

      it("应该正确处理带有查询参数的 SSE URL", () => {
        const testCases = [
          "https://example.com/sse?apiKey=123&timeout=5000",
          "https://api.example.com/v1/sse?version=2.0",
          "https://mcp.example.com/sse?token=abc123&debug=true",
        ];

        for (const url of testCases) {
          const result = inferTransportTypeFromUrl(url);
          expect(result).toBe(MCPTransportType.SSE);
        }
      });

      it("应该正确推断复杂的 ModelScope SSE 路径", () => {
        const testCases = [
          "https://mcp.api-inference.modelscope.net/f0fed2f733514b/sse",
          "https://mcp.api-inference.modelscope.net/8928ccc99fa34b/sse",
          "https://api.modelscope.cn/mcp/sse",
        ];

        for (const url of testCases) {
          const result = inferTransportTypeFromUrl(url);
          expect(result).toBe(MCPTransportType.SSE);
        }
      });

      it("应该正确处理嵌套 SSE 路径", () => {
        const testCases = [
          "https://api.example.com/v1/sse",
          "https://api.example.com/v1/v2/sse",
          "https://api.example.com/service/v1/sse",
          "https://api.example.com/api/v2/sse",
        ];

        for (const url of testCases) {
          const result = inferTransportTypeFromUrl(url);
          expect(result).toBe(MCPTransportType.SSE);
        }
      });

      it("应该正确处理带端口的 SSE URL", () => {
        const testCases = [
          "https://api.example.com:8080/sse",
          "https://localhost:3000/sse",
          "http://127.0.0.1:8080/api/v1/sse",
        ];

        for (const url of testCases) {
          const result = inferTransportTypeFromUrl(url);
          expect(result).toBe(MCPTransportType.SSE);
        }
      });

      it("应该正确处理带哈希的 SSE URL", () => {
        const testCases = [
          "https://example.com/sse#section1",
          "https://api.example.com/v1/sse#auth-token",
        ];

        for (const url of testCases) {
          const result = inferTransportTypeFromUrl(url);
          expect(result).toBe(MCPTransportType.SSE);
        }
      });
    });

    describe("MCP 类型推断", () => {
      it("应该根据 /mcp 路径推断为 MCP 类型", () => {
        const url = "https://example.com/mcp";
        const result = inferTransportTypeFromUrl(url);
        expect(result).toBe(MCPTransportType.HTTP);
      });

      it("应该正确推断复杂的 ModelScope MCP 路径", () => {
        const testCases = [
          "https://mcp.api-inference.modelscope.net/8928ccc99fa34b/mcp",
          "https://mcp.api-inference.modelscope.net/f0fed2f733514b/mcp",
          "https://api.modelscope.cn/service/mcp",
        ];

        for (const url of testCases) {
          const result = inferTransportTypeFromUrl(url);
          expect(result).toBe(MCPTransportType.HTTP);
        }
      });

      it("应该正确处理嵌套 MCP 路径", () => {
        const testCases = [
          "https://api.example.com/v1/mcp",
          "https://api.example.com/v1/v2/mcp",
          "https://api.example.com/service/v1/mcp",
          "https://api.example.com/api/v2/mcp",
        ];

        for (const url of testCases) {
          const result = inferTransportTypeFromUrl(url);
          expect(result).toBe(MCPTransportType.HTTP);
        }
      });

      it("应该正确处理带查询参数的 MCP URL", () => {
        const testCases = [
          "https://example.com/mcp?version=1.0&format=json",
          "https://api.example.com/v1/mcp?token=abc123",
        ];

        for (const url of testCases) {
          const result = inferTransportTypeFromUrl(url);
          expect(result).toBe(MCPTransportType.HTTP);
        }
      });
    });

    describe("默认类型推断", () => {
      it("对于其他路径应该默认推断为 http 类型", () => {
        const testCases = [
          "https://example.com/api/v1/tools",
          "https://example.com/endpoint",
          "https://example.com/service",
          "https://example.com/webhook",
          "https://api.example.com/v1/custom",
        ];

        for (const url of testCases) {
          const result = inferTransportTypeFromUrl(url);
          expect(result).toBe(MCPTransportType.HTTP);
        }
      });

      it("对于根路径应该默认推断为 http 类型", () => {
        const testCases = [
          "https://example.com/",
          "https://example.com",
          "https://api.example.com/",
        ];

        for (const url of testCases) {
          const result = inferTransportTypeFromUrl(url);
          expect(result).toBe(MCPTransportType.HTTP);
        }
      });
    });

    describe("边界情况", () => {
      it("应该处理无效的 URL", () => {
        const testCases = [
          "not-a-valid-url",
          "",
          "invalid-url",
          "://missing-protocol.com",
        ];

        for (const url of testCases) {
          const result = inferTransportTypeFromUrl(url);
          expect(result).toBe(MCPTransportType.HTTP);
        }
      });

      it("应该处理大小写敏感的路径", () => {
        const testCases = [
          {
            url: "https://example.com/SSE",
            expected: MCPTransportType.HTTP,
          },
          { url: "https://example.com/sse", expected: MCPTransportType.SSE },
          {
            url: "https://example.com/MCP",
            expected: MCPTransportType.HTTP,
          },
          {
            url: "https://example.com/mcp",
            expected: MCPTransportType.HTTP,
          },
        ];

        for (const { url, expected } of testCases) {
          const result = inferTransportTypeFromUrl(url);
          expect(result).toBe(expected);
        }
      });

      it("应该处理带有尾部斜杠的路径", () => {
        const testCases = [
          {
            url: "https://example.com/sse/",
            expected: MCPTransportType.HTTP,
          },
          { url: "https://example.com/sse", expected: MCPTransportType.SSE },
          {
            url: "https://example.com/mcp/",
            expected: MCPTransportType.HTTP,
          },
          {
            url: "https://example.com/mcp",
            expected: MCPTransportType.HTTP,
          },
        ];

        for (const { url, expected } of testCases) {
          const result = inferTransportTypeFromUrl(url);
          expect(result).toBe(expected);
        }
      });

      it("应该处理包含 sse 或 mcp 子字符串的路径", () => {
        const testCases = [
          {
            url: "https://example.com/assess",
            expected: MCPTransportType.HTTP,
          },
          {
            url: "https://example.com/mcprefix",
            expected: MCPTransportType.HTTP,
          },
          {
            url: "https://example.com/ssendpoint",
            expected: MCPTransportType.HTTP,
          },
          {
            url: "https://example.com/mcprefix/sse",
            expected: MCPTransportType.SSE,
          },
        ];

        for (const { url, expected } of testCases) {
          const result = inferTransportTypeFromUrl(url);
          expect(result).toBe(expected);
        }
      });

      it("应该处理特殊字符 URL", () => {
        const testCases = [
          "https://example.com/sse?q=test%20value&param=1+2",
          "https://api.example.com/v1/sse?encoded=%E4%B8%AD%E6%96%87",
        ];

        for (const url of testCases) {
          const result = inferTransportTypeFromUrl(url);
          expect(result).toBe(MCPTransportType.SSE);
        }
      });
    });

    describe("日志记录", () => {
      it("应该在路径不匹配规则时记录信息日志", () => {
        const url = "https://example.com/api/v1/tools";
        const serviceName = "test-service";

        inferTransportTypeFromUrl(url, {
          serviceName,
        });

        expect(logger.info).toHaveBeenCalledWith(
          `[MCP-${serviceName}] URL 路径 /api/v1/tools 不匹配特定规则，默认推断为 http 类型`
        );
      });

      it("应该在 URL 解析失败时记录警告日志", () => {
        const url = "not-a-valid-url";
        const serviceName = "test-service";

        inferTransportTypeFromUrl(url, {
          serviceName,
        });

        expect(logger.warn).toHaveBeenCalledWith(
          `[MCP-${serviceName}] URL 解析失败，默认推断为 http 类型`,
          expect.any(Error)
        );
      });

      it("应该在路径匹配规则时不记录任何日志", () => {
        const sseUrl = "https://example.com/sse";
        const mcpUrl = "https://example.com/mcp";

        inferTransportTypeFromUrl(sseUrl, {
          serviceName: "test-service",
        });

        inferTransportTypeFromUrl(mcpUrl, {
          serviceName: "test-service",
        });

        expect(logger.info).not.toHaveBeenCalled();
        expect(logger.warn).not.toHaveBeenCalled();
      });
    });
  });

  describe("inferTransportTypeFromConfig", () => {
    describe("显式指定类型的情况", () => {
      it("应该使用显式指定的类型", () => {
        const config = {
          type: MCPTransportType.SSE,
          url: "https://example.com/sse",
        };

        const result = inferTransportTypeFromConfig(config, "test-service");
        expect(result.type).toBe(MCPTransportType.SSE);
      });

      it("应该优先使用显式类型而非URL推断", () => {
        const config = {
          type: MCPTransportType.HTTP,
          url: "https://example.com/sse", // 这个URL会推断为SSE，但显式指定为STREAMABLE_HTTP
        };

        const result = inferTransportTypeFromConfig(config, "test-service");
        expect(result.type).toBe(MCPTransportType.HTTP);
      });

      it("应该正确处理所有显式类型", () => {
        const testCases = [
          {
            type: MCPTransportType.STDIO,
            name: "stdio-test",
            config: { command: "node", args: ["test.js"] },
          },
          {
            type: MCPTransportType.SSE,
            name: "sse-test",
            config: { url: "https://example.com/test" },
          },
          {
            type: MCPTransportType.HTTP,
            name: "http-test",
            config: { url: "https://example.com/test" },
          },
        ];

        for (const { type, name, config } of testCases) {
          const fullConfig = { name, type, ...config };
          const result = inferTransportTypeFromConfig(
            fullConfig,
            "test-service"
          );
          expect(result.type).toBe(type);
        }
      });
    });

    describe("基于 command 字段推断", () => {
      it("应该根据 command 字段推断为 stdio 类型", () => {
        const config = {
          command: "node",
          args: ["server.js"],
        };

        const result = inferTransportTypeFromConfig(config, "test-service");
        expect(result.type).toBe(MCPTransportType.STDIO);
      });

      it("即使有 url 字段，command 字段也应优先", () => {
        const config = {
          command: "python",
          args: ["server.py"],
          url: "https://example.com/sse",
        };

        const result = inferTransportTypeFromConfig(config, "test-service");
        expect(result.type).toBe(MCPTransportType.STDIO);
      });

      it("应该处理只有 command 没有 args 的情况", () => {
        const config = {
          command: "python",
        };

        const result = inferTransportTypeFromConfig(config, "test-service");
        expect(result.type).toBe(MCPTransportType.STDIO);
      });

      it("应该处理空的 args 数组", () => {
        const config = {
          command: "node",
          args: [],
        };

        const result = inferTransportTypeFromConfig(config, "test-service");
        expect(result.type).toBe(MCPTransportType.STDIO);
      });
    });

    describe("基于 URL 字段推断", () => {
      it("应该调用 inferTransportTypeFromUrl 进行类型推断", () => {
        const config = {
          url: "https://example.com/sse",
        };

        const result = inferTransportTypeFromConfig(config, "test-service");
        expect(result.type).toBe(MCPTransportType.SSE);
      });

      it("应该传递正确的参数给 inferTransportTypeFromUrl", () => {
        const config = {
          url: "not-a-valid-url",
        };

        inferTransportTypeFromConfig(config, "test-service");

        // 验证是否用正确的参数调用了日志记录
        expect(logger.warn).toHaveBeenCalledWith(
          "[MCP-test-service] URL 解析失败，默认推断为 http 类型",
          expect.any(Error)
        );
      });

      it("应该处理 null URL 值", () => {
        const config = {
          url: null,
        } as unknown as MCPServiceConfig;

        expect(() => {
          inferTransportTypeFromConfig(config, "null-url-service");
        }).toThrow(/无法为服务 null-url-service 推断传输类型/);
      });

      it("应该处理 undefined URL 值", () => {
        const config = {
          url: undefined,
        };

        expect(() => {
          inferTransportTypeFromConfig(config, "undefined-url-service");
        }).toThrow(/无法为服务 undefined-url-service 推断传输类型/);
      });

      it("应该处理空字符串 URL 值", () => {
        const config = {
          url: "",
        };

        const result = inferTransportTypeFromConfig(config, "test-service");
        expect(result.type).toBe(MCPTransportType.HTTP);
      });
    });

    describe("错误处理", () => {
      it("应该在无法推断类型时抛出错误", () => {
        const config = {
          // 没有 type、command 或 url 字段
        };

        expect(() => {
          inferTransportTypeFromConfig(config, "invalid-service");
        }).toThrow(/无法为服务 invalid-service 推断传输类型/);
      });

      it("应该提供清晰的错误信息", () => {
        const config = {
          timeout: 60000, // 只有无关字段
        } as unknown as MCPServiceConfig;

        expect(() => {
          inferTransportTypeFromConfig(config, "test-service");
        }).toThrow(
          "无法为服务 test-service 推断传输类型。请显式指定 type 字段，或提供 command/url 配置"
        );
      });
    });

    describe("配置保持不变性", () => {
      it("不应该修改原始配置对象", () => {
        const originalConfig = {
          url: "https://example.com/sse",
        };

        const originalConfigCopy = { ...originalConfig };
        const result = inferTransportTypeFromConfig(
          originalConfig,
          "test-service"
        );

        // 原始配置应该保持不变
        expect(originalConfig).toEqual(originalConfigCopy);

        // 返回的配置应该包含推断的类型
        expect(result.type).toBe(MCPTransportType.SSE);

        expect(result.url).toBe("https://example.com/sse");
      });

      it("应该保持配置字段的完整性", () => {
        const originalConfig = {
          url: "https://example.com/mcp",
          apiKey: "test-key",
        };

        const originalConfigCopy = { ...originalConfig };
        const result = inferTransportTypeFromConfig(
          originalConfig,
          "test-service"
        );

        expect(originalConfig).toEqual(originalConfigCopy);

        // 返回的配置应该包含所有原始字段和推断的类型
        expect(result.type).toBe(MCPTransportType.HTTP);
        expect(result.apiKey).toBe("test-key");

        expect(result.url).toBe("https://example.com/mcp");
      });
    });

    describe("类型推断优先级", () => {
      it("应该正确处理类型推断优先级：显式类型 > command > URL", () => {
        // 1. 显式类型优先级最高
        const explicitConfig = {
          type: MCPTransportType.SSE,
          command: "node", // command 存在但显式类型优先
          url: "https://example.com/mcp", // URL 推断为 MCP 但显式类型为 SSE
        };

        const explicitResult = inferTransportTypeFromConfig(
          explicitConfig,
          "test-service"
        );
        expect(explicitResult.type).toBe(MCPTransportType.SSE);

        // 2. command 优先级高于 URL
        const commandConfig = {
          command: "python", // command 存在
          url: "https://example.com/sse", // URL 推断为 SSE 但 command 优先
        };

        const commandResult = inferTransportTypeFromConfig(
          commandConfig,
          "test-service"
        );
        expect(commandResult.type).toBe(MCPTransportType.STDIO);

        // 3. 只有 URL 时进行推断
        const urlConfig = {
          url: "https://example.com/sse", // 推断为 SSE
        };

        const urlResult = inferTransportTypeFromConfig(
          urlConfig,
          "test-service"
        );
        expect(urlResult.type).toBe(MCPTransportType.SSE);
      });
    });
  });
});

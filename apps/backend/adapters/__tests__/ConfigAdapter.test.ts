/**
 * ConfigAdapter 测试
 * 验证配置转换器的功能和兼容性
 */

import { isAbsolute } from "node:path";
import type {
  LocalMCPServerConfig,
  MCPServerConfig,
  SSEMCPServerConfig,
  StreamableHTTPMCPServerConfig,
} from "@/lib/config/manager.js";
import { MCPTransportType } from "@/lib/mcp/types";
import { describe, expect, it } from "vitest";
import {
  ConfigValidationError,
  convertLegacyConfigBatch,
  convertLegacyToNew,
  getConfigTypeDescription,
} from "../ConfigAdapter.js";

describe("ConfigAdapter", () => {
  describe("convertLegacyToNew", () => {
    describe("本地 stdio 配置转换", () => {
      it("应该正确转换基本的本地配置", () => {
        const legacyConfig: LocalMCPServerConfig = {
          command: "node",
          args: ["calculator.js"],
        };

        const result = convertLegacyToNew("calculator", legacyConfig);

        expect(result).toEqual({
          name: "calculator",
          type: MCPTransportType.STDIO,
          command: "node",
          args: [expect.stringContaining("calculator.js")], // 路径解析后会变成绝对路径
          timeout: 30000,
        });

        // 验证路径解析功能
        expect(result.args).toBeDefined();
        expect(result.args![0]).toMatch(/.*calculator\.js$/);
        // 使用 isAbsolute 来检查是否为绝对路径，支持跨平台
        expect(isAbsolute(result.args![0])).toBe(true);
      });

      it("应该处理没有 args 的本地配置", () => {
        const legacyConfig: LocalMCPServerConfig = {
          command: "python",
          args: [],
        };

        const result = convertLegacyToNew("python-service", legacyConfig);

        expect(result.name).toBe("python-service");
        expect(result.type).toBe(MCPTransportType.STDIO);
        expect(result.command).toBe("python");
        expect(result.args).toEqual([]);
      });

      it("应该在缺少 command 时抛出错误", () => {
        const legacyConfig = {
          command: "",
          args: ["test.js"],
        } as any;

        expect(() => convertLegacyToNew("test", legacyConfig)).toThrow(
          ConfigValidationError
        );
      });

      it("应该正确传递环境变量", () => {
        const legacyConfig: LocalMCPServerConfig = {
          command: "npx",
          args: ["-y", "@amap/amap-maps-mcp-server"],
          env: {
            AMAP_MAPS_API_KEY: "1ec31da021b2702787841ea4ee822de3",
            NODE_ENV: "production",
          },
        };

        const result = convertLegacyToNew("amap-maps", legacyConfig);

        expect(result.name).toBe("amap-maps");
        expect(result.type).toBe(MCPTransportType.STDIO);
        expect(result.command).toBe("npx");
        expect(result.args).toEqual(["-y", "@amap/amap-maps-mcp-server"]);
        expect(result.env).toEqual({
          AMAP_MAPS_API_KEY: "1ec31da021b2702787841ea4ee822de3",
          NODE_ENV: "production",
        });
      });

      it("应该处理没有环境变量的配置", () => {
        const legacyConfig: LocalMCPServerConfig = {
          command: "node",
          args: ["test.js"],
          // 没有 env 字段
        };

        const result = convertLegacyToNew("test-service", legacyConfig);

        expect(result.env).toBeUndefined();
      });
    });

    describe("路径解析功能", () => {
      it("应该解析相对路径（以 ./ 开头）", () => {
        const legacyConfig: LocalMCPServerConfig = {
          command: "node",
          args: ["./mcpServers/datetime.js"],
        };

        const result = convertLegacyToNew("datetime", legacyConfig);

        expect(result.args).toBeDefined();
        expect(result.args![0]).toMatch(/.*mcpServers[\/\\]datetime\.js$/);
        // 使用 isAbsolute 来检查是否为绝对路径，支持跨平台
        expect(isAbsolute(result.args![0])).toBe(true);
      });

      it("应该解析相对路径（不以 / 开头的脚本文件）", () => {
        const legacyConfig: LocalMCPServerConfig = {
          command: "python",
          args: ["server.py"],
        };

        const result = convertLegacyToNew("python-server", legacyConfig);

        expect(result.args).toBeDefined();
        expect(result.args![0]).toMatch(/.*server\.py$/);
        // 使用 isAbsolute 来检查是否为绝对路径，支持跨平台
        expect(isAbsolute(result.args![0])).toBe(true);
      });

      it("应该保持绝对路径不变", () => {
        const absolutePath = "/usr/local/bin/mcp-server.js";
        const legacyConfig: LocalMCPServerConfig = {
          command: "node",
          args: [absolutePath],
        };

        const result = convertLegacyToNew("absolute-server", legacyConfig);

        expect(result.args).toBeDefined();
        expect(result.args![0]).toBe(absolutePath);
      });

      it("应该保持非脚本参数不变", () => {
        const legacyConfig: LocalMCPServerConfig = {
          command: "node",
          args: ["--version", "server.js", "--port", "3000"],
        };

        const result = convertLegacyToNew("server", legacyConfig);

        expect(result.args).toBeDefined();
        expect(result.args![0]).toBe("--version"); // 非脚本参数保持不变
        expect(result.args![1]).toMatch(/.*server\.js$/); // 脚本文件被解析
        expect(result.args![2]).toBe("--port"); // 非脚本参数保持不变
        expect(result.args![3]).toBe("3000"); // 非脚本参数保持不变
      });

      it("应该处理不同的脚本文件扩展名", () => {
        const testCases = [
          { file: "server.js", ext: "js" },
          { file: "server.py", ext: "py" },
          { file: "server.ts", ext: "ts" },
          { file: "server.mjs", ext: "mjs" },
          { file: "server.cjs", ext: "cjs" },
        ];

        for (const { file, ext } of testCases) {
          const legacyConfig: LocalMCPServerConfig = {
            command: "node",
            args: [file],
          };

          const result = convertLegacyToNew(`test-${ext}`, legacyConfig);

          expect(result.args).toBeDefined();
          expect(result.args![0]).toMatch(new RegExp(`.*${file}$`));
          // 使用 isAbsolute 来检查是否为绝对路径，支持跨平台
          expect(isAbsolute(result.args![0])).toBe(true);
        }
      });
    });

    describe("SSE 配置转换", () => {
      it("应该正确转换通用 SSE 配置", () => {
        const legacyConfig: SSEMCPServerConfig = {
          type: "sse",
          url: "https://example.com/sse",
        };

        const result = convertLegacyToNew("sse-service", legacyConfig);

        expect(result).toEqual({
          name: "sse-service",
          type: MCPTransportType.SSE,
          url: "https://example.com/sse",
          timeout: 30000,
        });
      });

      it("应该正确识别和转换 ModelScope SSE 配置", () => {
        const legacyConfig: SSEMCPServerConfig = {
          type: "sse",
          url: "https://mcp.api-inference.modelscope.net/search/sse",
        };

        const result = convertLegacyToNew("modelscope", legacyConfig);

        expect(result.type).toBe(MCPTransportType.SSE);
        expect(result.modelScopeAuth).toBe(true);
        expect(result.url).toBe(
          "https://mcp.api-inference.modelscope.net/search/sse"
        );
      });

      it("应该识别 modelscope.cn 域名", () => {
        const legacyConfig: SSEMCPServerConfig = {
          type: "sse",
          url: "https://api.modelscope.cn/mcp/sse",
        };

        const result = convertLegacyToNew("modelscope-cn", legacyConfig);

        expect(result.type).toBe(MCPTransportType.SSE);
        expect(result.modelScopeAuth).toBe(true);
      });

      it("应该在 url 为 undefined 或 null 时抛出错误", () => {
        const legacyConfig = {
          type: "sse",
          url: undefined,
        } as any;

        expect(() => convertLegacyToNew("test", legacyConfig)).toThrow(
          ConfigValidationError
        );
      });

      it("应该正确传递 SSE 配置中的 headers", () => {
        const legacyConfig: SSEMCPServerConfig = {
          type: "sse",
          url: "https://example.com/sse",
          headers: {
            Authorization: "Bearer token123",
            "X-Custom-Header": "test-value",
          },
        };

        const result = convertLegacyToNew("sse-with-headers", legacyConfig);

        expect(result.name).toBe("sse-with-headers");
        expect(result.type).toBe(MCPTransportType.SSE);
        expect(result.url).toBe("https://example.com/sse");
        expect(result.headers).toEqual({
          Authorization: "Bearer token123",
          "X-Custom-Header": "test-value",
        });
      });

      it("应该处理 SSE 配置中没有 headers 的情况", () => {
        const legacyConfig: SSEMCPServerConfig = {
          type: "sse",
          url: "https://example.com/sse",
          // 没有 headers 字段
        };

        const result = convertLegacyToNew("sse-no-headers", legacyConfig);

        expect(result.headers).toBeUndefined();
      });

      it("应该处理 SSE 配置中空的 headers", () => {
        const legacyConfig: SSEMCPServerConfig = {
          type: "sse",
          url: "https://example.com/sse",
          headers: {}, // 空对象
        };

        const result = convertLegacyToNew("sse-empty-headers", legacyConfig);

        expect(result.headers).toEqual({});
      });
    });

    describe("Streamable HTTP 配置转换", () => {
      it("应该正确转换显式 streamable-http 配置", () => {
        const legacyConfig: StreamableHTTPMCPServerConfig = {
          type: "streamable-http",
          url: "https://api.example.com/mcp",
        };

        const result = convertLegacyToNew("http-service", legacyConfig);

        expect(result).toEqual({
          name: "http-service",
          type: MCPTransportType.STREAMABLE_HTTP,
          url: "https://api.example.com/mcp",
          timeout: 30000,
        });
      });

      it("应该正确转换隐式 streamable-http 配置（只有 url）", () => {
        const legacyConfig: MCPServerConfig = {
          url: "https://api.example.com/mcp",
        };

        const result = convertLegacyToNew("http-service", legacyConfig);

        expect(result.type).toBe(MCPTransportType.STREAMABLE_HTTP);
        expect(result.url).toBe("https://api.example.com/mcp");
      });

      it("应该在 url 为 undefined 或 null 时抛出错误", () => {
        const legacyConfig = {
          type: "streamable-http",
          url: undefined,
        } as any;

        expect(() => convertLegacyToNew("test", legacyConfig)).toThrow(
          ConfigValidationError
        );
      });

      it("应该正确传递 Streamable HTTP 配置中的 headers", () => {
        const legacyConfig: StreamableHTTPMCPServerConfig = {
          type: "streamable-http",
          url: "https://api.example.com/mcp",
          headers: {
            "X-API-Key": "test-key-456",
            "Content-Type": "application/json",
            "User-Agent": "xiaozhi-client/1.0.0",
          },
        };

        const result = convertLegacyToNew("http-with-headers", legacyConfig);

        expect(result.name).toBe("http-with-headers");
        expect(result.type).toBe(MCPTransportType.STREAMABLE_HTTP);
        expect(result.url).toBe("https://api.example.com/mcp");
        expect(result.headers).toEqual({
          "X-API-Key": "test-key-456",
          "Content-Type": "application/json",
          "User-Agent": "xiaozhi-client/1.0.0",
        });
      });

      it("应该处理 Streamable HTTP 配置中没有 headers 的情况", () => {
        const legacyConfig: StreamableHTTPMCPServerConfig = {
          type: "streamable-http",
          url: "https://api.example.com/mcp",
          // 没有 headers 字段
        };

        const result = convertLegacyToNew("http-no-headers", legacyConfig);

        expect(result.headers).toBeUndefined();
      });

      it("应该处理 Streamable HTTP 配置中空的 headers", () => {
        const legacyConfig: StreamableHTTPMCPServerConfig = {
          type: "streamable-http",
          url: "https://api.example.com/mcp",
          headers: {}, // 空对象
        };

        const result = convertLegacyToNew("http-empty-headers", legacyConfig);

        expect(result.headers).toEqual({});
      });
    });

    describe("错误处理", () => {
      it("应该在服务名称为空时抛出错误", () => {
        const legacyConfig: LocalMCPServerConfig = {
          command: "node",
          args: ["test.js"],
        };

        expect(() => convertLegacyToNew("", legacyConfig)).toThrow(
          ConfigValidationError
        );
      });

      it("应该在配置对象为空时抛出错误", () => {
        expect(() => convertLegacyToNew("test", null as any)).toThrow(
          ConfigValidationError
        );
      });

      it("应该在无法识别配置类型时抛出错误", () => {
        const invalidConfig = {
          invalidField: "value",
        } as any;

        expect(() => convertLegacyToNew("test", invalidConfig)).toThrow(
          ConfigValidationError
        );
      });

      describe("基于URL路径的类型推断", () => {
        // SSE 类型推断测试
        describe("SSE 类型推断", () => {
          it("应该正确推断 SSE 类型 - 简单路径", () => {
            const legacyConfig: MCPServerConfig = {
              url: "https://example.com/sse",
            };

            const result = convertLegacyToNew("sse-test", legacyConfig);
            expect(result.type).toBe(MCPTransportType.SSE);
          });

          it("应该正确推断 SSE 类型 - 复杂路径", () => {
            const legacyConfig: MCPServerConfig = {
              url: "https://mcp.api-inference.modelscope.net/f0fed2f733514b/sse",
            };

            const result = convertLegacyToNew("modelscope-sse", legacyConfig);
            expect(result.type).toBe(MCPTransportType.SSE);
          });

          it("应该正确推断 SSE 类型 - 带查询参数", () => {
            const legacyConfig: MCPServerConfig = {
              url: "https://example.com/sse?token=abc123&timeout=5000",
            };

            const result = convertLegacyToNew("sse-with-params", legacyConfig);
            expect(result.type).toBe(MCPTransportType.SSE);
          });

          it("应该正确推断 SSE 类型 - modelscope.cn 域名", () => {
            const legacyConfig: MCPServerConfig = {
              url: "https://api.modelscope.cn/mcp/sse",
            };

            const result = convertLegacyToNew(
              "modelscope-cn-sse",
              legacyConfig
            );
            expect(result.type).toBe(MCPTransportType.SSE);
          });

          it("应该正确推断 SSE 类型 - 带哈希的路径", () => {
            const legacyConfig: MCPServerConfig = {
              url: "https://example.com/sse#section",
            };

            const result = convertLegacyToNew("sse-with-hash", legacyConfig);
            expect(result.type).toBe(MCPTransportType.SSE);
          });

          it("应该正确处理高德地图 SSE 服务", () => {
            const legacyConfig: MCPServerConfig = {
              url: "https://mcp.amap.com/sse?key=1ec31da021b2702787841ea4ee822de3",
            };

            const result = convertLegacyToNew("amap-amap-sse", legacyConfig);
            expect(result.type).toBe(MCPTransportType.SSE);
          });

          it("应该正确推断 SSE 类型 - 嵌套路径", () => {
            const testCases = [
              "https://api.example.com/v1/sse",
              "https://api.example.com/v1/v2/sse",
              "https://api.example.com/v1/v2/v3/sse",
              "https://api.example.com/service/v1/sse",
            ];

            for (const url of testCases) {
              const legacyConfig: MCPServerConfig = { url };
              const result = convertLegacyToNew("nested-sse", legacyConfig);
              expect(result.type).toBe(MCPTransportType.SSE);
            }
          });

          it("应该正确推断 SSE 类型 - 端口和子域名", () => {
            const testCases = [
              "https://api.example.com:8080/sse",
              "https://mcp.dev.example.com/sse",
              "https://test.example.com:8443/sse",
            ];

            for (const url of testCases) {
              const legacyConfig: MCPServerConfig = { url };
              const result = convertLegacyToNew(
                "port-subdomain-sse",
                legacyConfig
              );
              expect(result.type).toBe(MCPTransportType.SSE);
            }
          });
        });

        // STREAMABLE_HTTP 类型推断测试
        describe("STREAMABLE_HTTP 类型推断", () => {
          it("应该正确推断 STREAMABLE_HTTP 类型 - 简单路径", () => {
            const legacyConfig: MCPServerConfig = {
              url: "https://example.com/mcp",
            };

            const result = convertLegacyToNew("mcp-test", legacyConfig);
            expect(result.type).toBe(MCPTransportType.STREAMABLE_HTTP);
          });

          it("应该正确推断 STREAMABLE_HTTP 类型 - 复杂路径", () => {
            const legacyConfig: MCPServerConfig = {
              url: "https://mcp.api-inference.modelscope.net/8928ccc99fa34b/mcp",
            };

            const result = convertLegacyToNew("modelscope-mcp", legacyConfig);
            expect(result.type).toBe(MCPTransportType.STREAMABLE_HTTP);
          });

          it("应该正确推断 STREAMABLE_HTTP 类型 - 带查询参数", () => {
            const legacyConfig: MCPServerConfig = {
              url: "https://example.com/mcp?version=1.0&format=json",
            };

            const result = convertLegacyToNew("mcp-with-params", legacyConfig);
            expect(result.type).toBe(MCPTransportType.STREAMABLE_HTTP);
          });

          it("应该正确推断 STREAMABLE_HTTP 类型 - 嵌套路径", () => {
            const testCases = [
              "https://api.example.com/v1/mcp",
              "https://api.example.com/v1/v2/mcp",
              "https://api.example.com/service/v1/mcp",
            ];

            for (const url of testCases) {
              const legacyConfig: MCPServerConfig = { url };
              const result = convertLegacyToNew("nested-mcp", legacyConfig);
              expect(result.type).toBe(MCPTransportType.STREAMABLE_HTTP);
            }
          });
        });

        // 默认类型推断测试
        describe("默认类型推断", () => {
          it("应该默认推断 STREAMABLE_HTTP 类型 - API 路径", () => {
            const legacyConfig: MCPServerConfig = {
              url: "https://example.com/api",
            };

            const result = convertLegacyToNew("api-test", legacyConfig);
            expect(result.type).toBe(MCPTransportType.STREAMABLE_HTTP);
          });

          it("应该默认推断 STREAMABLE_HTTP 类型 - 根路径", () => {
            const legacyConfig: MCPServerConfig = {
              url: "https://example.com/",
            };

            const result = convertLegacyToNew("root-test", legacyConfig);
            expect(result.type).toBe(MCPTransportType.STREAMABLE_HTTP);
          });

          it("应该默认推断 STREAMABLE_HTTP 类型 - 其他路径", () => {
            const testCases = [
              "https://example.com/tools",
              "https://example.com/v1/tools",
              "https://example.com/service",
              "https://example.com/endpoint",
              "https://example.com/webhook",
            ];

            for (const url of testCases) {
              const legacyConfig: MCPServerConfig = { url };
              const result = convertLegacyToNew("default-type", legacyConfig);
              expect(result.type).toBe(MCPTransportType.STREAMABLE_HTTP);
            }
          });
        });

        // 边界情况和异常处理测试
        describe("边界情况和异常处理", () => {
          it("应该处理 URL 解析错误", () => {
            const legacyConfig: MCPServerConfig = {
              url: "invalid-url",
            };

            const result = convertLegacyToNew("invalid-test", legacyConfig);
            expect(result.type).toBe(MCPTransportType.STREAMABLE_HTTP); // 默认值
          });

          it("应该处理空 URL", () => {
            const legacyConfig: MCPServerConfig = {
              url: "",
            };

            const result = convertLegacyToNew("empty-url", legacyConfig);
            expect(result.type).toBe(MCPTransportType.STREAMABLE_HTTP); // 默认值
          });

          it("应该处理只有协议的 URL", () => {
            const legacyConfig: MCPServerConfig = {
              url: "https://",
            };

            const result = convertLegacyToNew("protocol-only", legacyConfig);
            expect(result.type).toBe(MCPTransportType.STREAMABLE_HTTP); // 默认值
          });

          it("应该处理特殊字符 URL", () => {
            const legacyConfig: MCPServerConfig = {
              url: "https://example.com/sse?q=test%20value&param=1+2",
            };

            const result = convertLegacyToNew("special-chars", legacyConfig);
            expect(result.type).toBe(MCPTransportType.SSE);
          });

          it("应该处理大小写敏感的路径", () => {
            const testCases = [
              {
                url: "https://example.com/SSE",
                expected: MCPTransportType.STREAMABLE_HTTP,
              },
              {
                url: "https://example.com/sse",
                expected: MCPTransportType.SSE,
              },
              {
                url: "https://example.com/MCP",
                expected: MCPTransportType.STREAMABLE_HTTP,
              },
              {
                url: "https://example.com/mcp",
                expected: MCPTransportType.STREAMABLE_HTTP,
              },
            ];

            for (const { url, expected } of testCases) {
              const legacyConfig: MCPServerConfig = { url };
              const result = convertLegacyToNew("case-sensitive", legacyConfig);
              expect(result.type).toBe(expected);
            }
          });

          it("应该处理带有尾部斜杠的路径", () => {
            const testCases = [
              {
                url: "https://example.com/sse/",
                expected: MCPTransportType.STREAMABLE_HTTP,
              },
              {
                url: "https://example.com/sse",
                expected: MCPTransportType.SSE,
              },
              {
                url: "https://example.com/mcp/",
                expected: MCPTransportType.STREAMABLE_HTTP,
              },
              {
                url: "https://example.com/mcp",
                expected: MCPTransportType.STREAMABLE_HTTP,
              },
            ];

            for (const { url, expected } of testCases) {
              const legacyConfig: MCPServerConfig = { url };
              const result = convertLegacyToNew("trailing-slash", legacyConfig);
              expect(result.type).toBe(expected);
            }
          });

          it("应该处理包含 sse 或 mcp 子字符串的路径", () => {
            const testCases = [
              {
                url: "https://example.com/assess",
                expected: MCPTransportType.STREAMABLE_HTTP,
              },
              {
                url: "https://example.com/mcprefix",
                expected: MCPTransportType.STREAMABLE_HTTP,
              },
              {
                url: "https://example.com/ssendpoint",
                expected: MCPTransportType.STREAMABLE_HTTP,
              },
              {
                url: "https://example.com/mcprefix/sse",
                expected: MCPTransportType.SSE,
              },
            ];

            for (const { url, expected } of testCases) {
              const legacyConfig: MCPServerConfig = { url };
              const result = convertLegacyToNew(
                "substring-match",
                legacyConfig
              );
              expect(result.type).toBe(expected);
            }
          });
        });

        // 显式类型配置优先级测试
        describe("显式类型配置优先级", () => {
          it("应该优先使用显式指定的 sse 类型", () => {
            const legacyConfig: SSEMCPServerConfig = {
              type: "sse",
              url: "https://example.com/mcp", // 这个 URL 应该推断为 mcp
            };

            const result = convertLegacyToNew("explicit-sse", legacyConfig);
            expect(result.type).toBe(MCPTransportType.SSE);
          });

          it("应该优先使用显式指定的 streamable-http 类型", () => {
            const legacyConfig: StreamableHTTPMCPServerConfig = {
              type: "streamable-http",
              url: "https://example.com/sse", // 这个 URL 应该推断为 sse
            };

            const result = convertLegacyToNew("explicit-http", legacyConfig);
            expect(result.type).toBe(MCPTransportType.STREAMABLE_HTTP);
          });

          it("应该正确处理显式类型与 URL 推断的一致性", () => {
            const legacyConfig: SSEMCPServerConfig = {
              type: "sse",
              url: "https://example.com/sse", // URL 推断与显式类型一致
            };

            const result = convertLegacyToNew("consistent-type", legacyConfig);
            expect(result.type).toBe(MCPTransportType.SSE);
          });
        });
      });
    });
  });

  describe("convertLegacyConfigBatch", () => {
    it("应该正确批量转换配置", () => {
      const legacyConfigs: Record<string, MCPServerConfig> = {
        calculator: {
          command: "node",
          args: ["calculator.js"],
        },
        "sse-service": {
          type: "sse",
          url: "https://example.com/sse",
        },
        "http-service": {
          url: "https://api.example.com/mcp",
        },
      };

      const result = convertLegacyConfigBatch(legacyConfigs);

      expect(Object.keys(result)).toHaveLength(3);
      expect(result.calculator.type).toBe(MCPTransportType.STDIO);
      expect(result["sse-service"].type).toBe(MCPTransportType.SSE);
      expect(result["http-service"].type).toBe(
        MCPTransportType.STREAMABLE_HTTP
      );
    });

    it("应该在部分配置无效时抛出错误", () => {
      const legacyConfigs: Record<string, MCPServerConfig> = {
        valid: {
          command: "node",
          args: ["test.js"],
        },
        invalid: {
          invalidField: "value",
        } as any,
      };

      expect(() => convertLegacyConfigBatch(legacyConfigs)).toThrow(
        ConfigValidationError
      );
    });

    it("应该处理空配置对象", () => {
      const result = convertLegacyConfigBatch({});
      expect(result).toEqual({});
    });
  });

  describe("getConfigTypeDescription", () => {
    it("应该返回本地配置的描述", () => {
      const config: LocalMCPServerConfig = {
        command: "python",
        args: ["-m", "server"],
      };
      const description = getConfigTypeDescription(config);
      expect(description).toBe("本地进程 (python)");
    });

    it("应该返回 SSE 配置的描述", () => {
      const config: SSEMCPServerConfig = {
        type: "sse",
        url: "https://example.com/sse",
      };
      const description = getConfigTypeDescription(config);
      expect(description).toBe("SSE (https://example.com/sse)");
    });

    it("应该返回 ModelScope SSE 配置的描述", () => {
      const config: SSEMCPServerConfig = {
        type: "sse",
        url: "https://modelscope.net/api/sse",
      };
      const description = getConfigTypeDescription(config);
      expect(description).toBe(
        "SSE (ModelScope) (https://modelscope.net/api/sse)"
      );
    });

    it("应该返回 Streamable HTTP 配置的描述", () => {
      const config: StreamableHTTPMCPServerConfig = {
        url: "https://api.example.com/mcp",
      };
      const description = getConfigTypeDescription(config);
      expect(description).toBe("Streamable HTTP (https://api.example.com/mcp)");
    });

    it("应该返回未知类型的描述", () => {
      const config = { unknown: "field" } as any;
      const description = getConfigTypeDescription(config);
      expect(description).toBe("未知类型");
    });
  });
});

/**
 * ConfigAdapter 测试
 * 验证配置转换器的功能和兼容性
 */

import { describe, expect, it } from "vitest";
import type {
  LocalMCPServerConfig,
  MCPServerConfig,
  SSEMCPServerConfig,
  StreamableHTTPMCPServerConfig,
} from "../../configManager.js";
import { MCPTransportType } from "../../services/MCPService.js";
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
          args: ["calculator.js"],
          reconnect: {
            enabled: true,
            maxAttempts: 5,
            initialInterval: 3000,
            maxInterval: 30000,
            backoffStrategy: "exponential",
            backoffMultiplier: 1.5,
            timeout: 10000,
            jitter: true,
          },
          ping: {
            enabled: true,
            interval: 30000,
            timeout: 5000,
            maxFailures: 3,
            startDelay: 5000,
          },
          timeout: 30000,
        });
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
          args: ["test.js"],
        } as any;

        expect(() => convertLegacyToNew("test", legacyConfig)).toThrow(
          ConfigValidationError
        );
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
          reconnect: {
            enabled: true,
            maxAttempts: 10,
            initialInterval: 3000,
            maxInterval: 30000,
            backoffStrategy: "exponential",
            backoffMultiplier: 1.5,
            timeout: 15000,
            jitter: true,
          },
          ping: {
            enabled: true,
            interval: 30000,
            timeout: 5000,
            maxFailures: 3,
            startDelay: 5000,
          },
          timeout: 30000,
        });
      });

      it("应该正确识别和转换 ModelScope SSE 配置", () => {
        const legacyConfig: SSEMCPServerConfig = {
          type: "sse",
          url: "https://mcp.api-inference.modelscope.net/search/sse",
        };

        const result = convertLegacyToNew("modelscope", legacyConfig);

        expect(result.type).toBe(MCPTransportType.MODELSCOPE_SSE);
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

        expect(result.type).toBe(MCPTransportType.MODELSCOPE_SSE);
        expect(result.modelScopeAuth).toBe(true);
      });

      it("应该在缺少 url 时抛出错误", () => {
        const legacyConfig = {
          type: "sse",
        } as any;

        expect(() => convertLegacyToNew("test", legacyConfig)).toThrow(
          ConfigValidationError
        );
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
          reconnect: {
            enabled: true,
            maxAttempts: 5,
            initialInterval: 3000,
            maxInterval: 30000,
            backoffStrategy: "exponential",
            backoffMultiplier: 1.5,
            timeout: 15000,
            jitter: true,
          },
          ping: {
            enabled: false,
            interval: 60000,
            timeout: 10000,
            maxFailures: 3,
            startDelay: 10000,
          },
          timeout: 30000,
        });
      });

      it("应该正确转换隐式 streamable-http 配置（只有 url）", () => {
        const legacyConfig: StreamableHTTPMCPServerConfig = {
          url: "https://api.example.com/mcp",
        };

        const result = convertLegacyToNew("http-service", legacyConfig);

        expect(result.type).toBe(MCPTransportType.STREAMABLE_HTTP);
        expect(result.url).toBe("https://api.example.com/mcp");
        expect(result.ping?.enabled).toBe(false); // HTTP 连接默认不启用 ping
      });

      it("应该在缺少 url 时抛出错误", () => {
        const legacyConfig = {
          type: "streamable-http",
        } as any;

        expect(() => convertLegacyToNew("test", legacyConfig)).toThrow(
          ConfigValidationError
        );
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

import { describe, expect, it } from "vitest";
import { MCPService, MCPTransportType } from "../MCPService.js";

describe("MCPService 自动类型推断测试", () => {
  describe("显式指定类型的情况", () => {
    it("应该使用显式指定的类型", () => {
      const config = {
        name: "test-service",
        type: MCPTransportType.SSE,
        url: "https://example.com/sse",
      };

      // 在构造函数中会调用 inferTransportType
      const service = new MCPService(config);
      const serviceConfig = service.getConfig();

      expect(serviceConfig.type).toBe(MCPTransportType.SSE);
    });

    it("应该优先使用显式类型而非URL推断", () => {
      const config = {
        name: "explicit-priority-service",
        type: MCPTransportType.STREAMABLE_HTTP,
        url: "https://example.com/sse", // 这个URL会推断为SSE，但显式指定为STREAMABLE_HTTP
      };

      const service = new MCPService(config);
      const serviceConfig = service.getConfig();

      expect(serviceConfig.type).toBe(MCPTransportType.STREAMABLE_HTTP);
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
          type: MCPTransportType.STREAMABLE_HTTP,
          name: "http-test",
          config: { url: "https://example.com/test" },
        },
      ];

      for (const { type, name, config } of testCases) {
        const serviceConfig = {
          name,
          type,
          ...config,
        };

        const service = new MCPService(serviceConfig);
        const result = service.getConfig();

        expect(result.type).toBe(type);
      }
    });
  });

  describe("自动推断 stdio 类型", () => {
    it("应该根据 command 字段推断为 stdio 类型", () => {
      const config = {
        name: "stdio-service",
        command: "node",
        args: ["server.js"],
      };

      const service = new MCPService(config);
      const serviceConfig = service.getConfig();

      expect(serviceConfig.type).toBe(MCPTransportType.STDIO);
    });

    it("即使有 url 字段，command 字段也应优先", () => {
      const config = {
        name: "mixed-service",
        command: "python",
        args: ["server.py"],
        url: "https://example.com/sse",
      };

      const service = new MCPService(config);
      const serviceConfig = service.getConfig();

      expect(serviceConfig.type).toBe(MCPTransportType.STDIO);
    });

    it("应该处理只有 command 没有 args 的情况", () => {
      const config = {
        name: "command-only-service",
        command: "python",
      };

      const service = new MCPService(config);
      const serviceConfig = service.getConfig();

      expect(serviceConfig.type).toBe(MCPTransportType.STDIO);
    });

    it("应该处理空的 args 数组", () => {
      const config = {
        name: "empty-args-service",
        command: "node",
        args: [],
      };

      const service = new MCPService(config);
      const serviceConfig = service.getConfig();

      expect(serviceConfig.type).toBe(MCPTransportType.STDIO);
    });
  });

  describe("自动推断 SSE 类型", () => {
    it("应该根据 /sse 路径推断为 SSE 类型", () => {
      const config = {
        name: "sse-service",
        url: "https://mcp.amap.com/sse?key=test",
      };

      const service = new MCPService(config);
      const serviceConfig = service.getConfig();

      expect(serviceConfig.type).toBe(MCPTransportType.SSE);
    });

    it("应该正确处理带有查询参数的 SSE URL", () => {
      const config = {
        name: "sse-service-with-params",
        url: "https://example.com/sse?apiKey=123&timeout=5000",
      };

      const service = new MCPService(config);
      const serviceConfig = service.getConfig();

      expect(serviceConfig.type).toBe(MCPTransportType.SSE);
    });

    it("应该正确推断复杂的 ModelScope SSE 路径", () => {
      const testCases = [
        "https://mcp.api-inference.modelscope.net/f0fed2f733514b/sse",
        "https://mcp.api-inference.modelscope.net/8928ccc99fa34b/sse",
        "https://mcp.api-inference.modelscope.net/abcdef123456/sse",
        "https://api.modelscope.cn/mcp/sse",
      ];

      for (const url of testCases) {
        const config = {
          name: "modelscope-sse-service",
          url,
        };

        const service = new MCPService(config);
        const serviceConfig = service.getConfig();

        expect(serviceConfig.type).toBe(MCPTransportType.SSE);
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
        const config = {
          name: "nested-sse-service",
          url,
        };

        const service = new MCPService(config);
        const serviceConfig = service.getConfig();

        expect(serviceConfig.type).toBe(MCPTransportType.SSE);
      }
    });

    it("应该正确处理带端口的 SSE URL", () => {
      const config = {
        name: "port-sse-service",
        url: "https://api.example.com:8080/sse",
      };

      const service = new MCPService(config);
      const serviceConfig = service.getConfig();

      expect(serviceConfig.type).toBe(MCPTransportType.SSE);
    });

    it("应该正确处理带哈希的 SSE URL", () => {
      const config = {
        name: "hash-sse-service",
        url: "https://example.com/sse#section1",
      };

      const service = new MCPService(config);
      const serviceConfig = service.getConfig();

      expect(serviceConfig.type).toBe(MCPTransportType.SSE);
    });
  });

  describe("自动推断 streamable-http 类型", () => {
    it("应该根据 /mcp 路径推断为 streamable-http 类型", () => {
      const config = {
        name: "mcp-service",
        url: "https://example.com/mcp",
      };

      const service = new MCPService(config);
      const serviceConfig = service.getConfig();

      expect(serviceConfig.type).toBe(MCPTransportType.STREAMABLE_HTTP);
    });

    it("应该正确推断复杂的 ModelScope MCP 路径", () => {
      const testCases = [
        "https://mcp.api-inference.modelscope.net/8928ccc99fa34b/mcp",
        "https://mcp.api-inference.modelscope.net/f0fed2f733514b/mcp",
        "https://api.modelscope.cn/service/mcp",
      ];

      for (const url of testCases) {
        const config = {
          name: "modelscope-mcp-service",
          url,
        };

        const service = new MCPService(config);
        const serviceConfig = service.getConfig();

        expect(serviceConfig.type).toBe(MCPTransportType.STREAMABLE_HTTP);
      }
    });

    it("应该正确处理嵌套 MCP 路径", () => {
      const testCases = [
        "https://api.example.com/v1/mcp",
        "https://api.example.com/v1/v2/mcp",
        "https://api.example.com/service/v1/mcp",
      ];

      for (const url of testCases) {
        const config = {
          name: "nested-mcp-service",
          url,
        };

        const service = new MCPService(config);
        const serviceConfig = service.getConfig();

        expect(serviceConfig.type).toBe(MCPTransportType.STREAMABLE_HTTP);
      }
    });

    it("对于其他路径应该默认推断为 streamable-http 类型", () => {
      const testCases = [
        { url: "https://example.com/api/v1/tools", name: "api-service" },
        { url: "https://example.com/endpoint", name: "endpoint-service" },
        { url: "https://example.com/service", name: "generic-service" },
        { url: "https://example.com/webhook", name: "webhook-service" },
      ];

      for (const { url, name } of testCases) {
        const config = {
          name,
          url,
        };

        const service = new MCPService(config);
        const serviceConfig = service.getConfig();

        expect(serviceConfig.type).toBe(MCPTransportType.STREAMABLE_HTTP);
      }
    });

    it("对于根路径应该默认推断为 streamable-http 类型", () => {
      const testCases = [
        { url: "https://example.com/", name: "root-service-1" },
        { url: "https://example.com", name: "root-service-2" },
        { url: "https://api.example.com/", name: "root-service-3" },
      ];

      for (const { url, name } of testCases) {
        const config = {
          name,
          url,
        };

        const service = new MCPService(config);
        const serviceConfig = service.getConfig();

        expect(serviceConfig.type).toBe(MCPTransportType.STREAMABLE_HTTP);
      }
    });

    it("应该正确处理带查询参数的 MCP URL", () => {
      const config = {
        name: "mcp-with-params",
        url: "https://example.com/mcp?version=1.0&format=json",
      };

      const service = new MCPService(config);
      const serviceConfig = service.getConfig();

      expect(serviceConfig.type).toBe(MCPTransportType.STREAMABLE_HTTP);
    });
  });

  describe("边界情况和异常处理", () => {
    it("应该在无法推断类型时抛出错误", () => {
      const config = {
        name: "invalid-service",
        // 没有 type、command 或 url 字段
      };

      expect(() => {
        new MCPService(config);
      }).toThrow("无法为服务 invalid-service 推断传输类型");
    });

    it("应该处理无效的 URL", () => {
      const config = {
        name: "invalid-url-service",
        url: "not-a-valid-url",
      };

      const service = new MCPService(config);
      const serviceConfig = service.getConfig();

      // 应该默认为 streamable-http 类型
      expect(serviceConfig.type).toBe(MCPTransportType.STREAMABLE_HTTP);
    });

    it("应该处理空 URL", () => {
      const config = {
        name: "empty-url-service",
        url: "",
      };

      const service = new MCPService(config);
      const serviceConfig = service.getConfig();

      expect(serviceConfig.type).toBe(MCPTransportType.STREAMABLE_HTTP);
    });

    it("应该处理只有协议的 URL", () => {
      const config = {
        name: "protocol-only-service",
        url: "https://",
      };

      const service = new MCPService(config);
      const serviceConfig = service.getConfig();

      expect(serviceConfig.type).toBe(MCPTransportType.STREAMABLE_HTTP);
    });

    it("应该处理大小写敏感的路径", () => {
      const testCases = [
        {
          url: "https://example.com/SSE",
          expected: MCPTransportType.STREAMABLE_HTTP,
        },
        { url: "https://example.com/sse", expected: MCPTransportType.SSE },
        {
          url: "https://example.com/MCP",
          expected: MCPTransportType.STREAMABLE_HTTP,
        },
        {
          url: "https://example.com/mcp",
          expected: MCPTransportType.STREAMABLE_HTTP,
        },
      ];

      for (const { url, expected, name } of testCases.map((tc, i) => ({
        ...tc,
        name: `case-service-${i}`,
      }))) {
        const config = { name, url };
        const service = new MCPService(config);
        const serviceConfig = service.getConfig();
        expect(serviceConfig.type).toBe(expected);
      }
    });

    it("应该处理带有尾部斜杠的路径", () => {
      const testCases = [
        {
          url: "https://example.com/sse/",
          expected: MCPTransportType.STREAMABLE_HTTP,
        },
        { url: "https://example.com/sse", expected: MCPTransportType.SSE },
        {
          url: "https://example.com/mcp/",
          expected: MCPTransportType.STREAMABLE_HTTP,
        },
        {
          url: "https://example.com/mcp",
          expected: MCPTransportType.STREAMABLE_HTTP,
        },
      ];

      for (const { url, expected, name } of testCases.map((tc, i) => ({
        ...tc,
        name: `trailing-service-${i}`,
      }))) {
        const config = { name, url };
        const service = new MCPService(config);
        const serviceConfig = service.getConfig();
        expect(serviceConfig.type).toBe(expected);
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

      for (const { url, expected, name } of testCases.map((tc, i) => ({
        ...tc,
        name: `substring-service-${i}`,
      }))) {
        const config = { name, url };
        const service = new MCPService(config);
        const serviceConfig = service.getConfig();
        expect(serviceConfig.type).toBe(expected);
      }
    });

    it("应该处理特殊字符 URL", () => {
      const config = {
        name: "special-chars-service",
        url: "https://example.com/sse?q=test%20value&param=1+2",
      };

      const service = new MCPService(config);
      const serviceConfig = service.getConfig();

      expect(serviceConfig.type).toBe(MCPTransportType.SSE);
    });
  });

  describe("配置保持不变性", () => {
    it("不应该修改原始配置对象", () => {
      const originalConfig = {
        name: "original-service",
        url: "https://example.com/sse",
      };

      const originalConfigCopy = { ...originalConfig };
      const service = new MCPService(originalConfig);

      // 原始配置应该保持不变
      expect(originalConfig).toEqual(originalConfigCopy);

      // 服务配置应该包含推断的类型
      const serviceConfig = service.getConfig();
      expect(serviceConfig.type).toBe(MCPTransportType.SSE);
    });

    it("应该保持配置字段的完整性", () => {
      const originalConfig = {
        name: "complete-service",
        url: "https://example.com/mcp",
        timeout: 60000,
        reconnect: {
          enabled: true,
          maxAttempts: 3,
        },
      };

      const originalConfigCopy = { ...originalConfig };
      const service = new MCPService(originalConfig);

      expect(originalConfig).toEqual(originalConfigCopy);

      const serviceConfig = service.getConfig();
      expect(serviceConfig.type).toBe(MCPTransportType.STREAMABLE_HTTP);
      expect(serviceConfig.timeout).toBe(60000);
      expect(serviceConfig.reconnect).toBeDefined();
    });
  });

  describe("类型推断优先级", () => {
    it("应该正确处理类型推断优先级：显式类型 > command > URL", () => {
      // 1. 显式类型优先级最高
      const explicitConfig = {
        name: "explicit-priority",
        type: MCPTransportType.SSE,
        command: "node", // command 存在但显式类型优先
        url: "https://example.com/mcp", // URL 推断为 MCP 但显式类型为 SSE
      };

      const explicitService = new MCPService(explicitConfig);
      expect(explicitService.getConfig().type).toBe(MCPTransportType.SSE);

      // 2. command 优先级高于 URL
      const commandConfig = {
        name: "command-priority",
        command: "python", // command 存在
        url: "https://example.com/sse", // URL 推断为 SSE 但 command 优先
      };

      const commandService = new MCPService(commandConfig);
      expect(commandService.getConfig().type).toBe(MCPTransportType.STDIO);

      // 3. 只有 URL 时进行推断
      const urlConfig = {
        name: "url-inference",
        url: "https://example.com/sse", // 推断为 SSE
      };

      const urlService = new MCPService(urlConfig);
      expect(urlService.getConfig().type).toBe(MCPTransportType.SSE);
    });
  });
});

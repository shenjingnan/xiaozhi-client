import { describe, expect, it } from "vitest";
import { MCPTransportType } from "../types.js";
import type { MCPServiceConfig } from "../types.js";
import { TransportFactory } from "../transport-factory.js";

describe("TransportFactory", () => {
  describe("validateConfig", () => {
    it("应该验证 stdio 配置", () => {
      const config: MCPServiceConfig = {
        name: "test-stdio",
        type: MCPTransportType.STDIO,
        command: "node",
        args: ["test.js"],
      };

      expect(() => TransportFactory.validateConfig(config)).not.toThrow();
    });

    it("应该验证 SSE 配置", () => {
      const config: MCPServiceConfig = {
        name: "test-sse",
        type: MCPTransportType.SSE,
        url: "https://example.com/sse",
      };

      expect(() => TransportFactory.validateConfig(config)).not.toThrow();
    });

    it("应该验证 streamable-http 配置", () => {
      const config: MCPServiceConfig = {
        name: "test-http",
        type: MCPTransportType.STREAMABLE_HTTP,
        url: "https://example.com/mcp",
      };

      expect(() => TransportFactory.validateConfig(config)).not.toThrow();
    });

    it("无效名称时应该抛出错误", () => {
      const config = {
        name: "",
        type: MCPTransportType.STDIO,
        command: "node",
      } as MCPServiceConfig;

      expect(() => TransportFactory.validateConfig(config)).toThrow(
        "配置必须包含有效的 name 字段"
      );
    });

    it("名称不是字符串时应该抛出错误", () => {
      const config = {
        name: null as unknown as string,
        type: MCPTransportType.STDIO,
        command: "node",
      } as MCPServiceConfig;

      expect(() => TransportFactory.validateConfig(config)).toThrow(
        "配置必须包含有效的 name 字段"
      );
    });

    it("不支持的传输类型时应该抛出错误", () => {
      const config = {
        name: "test",
        type: "unsupported" as MCPTransportType,
      } as MCPServiceConfig;

      expect(() => TransportFactory.validateConfig(config)).toThrow(
        "不支持的传输类型"
      );
    });

    it("缺少类型字段时应该抛出错误", () => {
      const config = {
        name: "test",
      } as MCPServiceConfig;

      expect(() => TransportFactory.validateConfig(config)).toThrow(
        "传输类型未设置"
      );
    });

    it("stdio 类型缺少 command 时应该抛出错误", () => {
      const config: MCPServiceConfig = {
        name: "test",
        type: MCPTransportType.STDIO,
      };

      expect(() => TransportFactory.validateConfig(config)).toThrow(
        "stdio 类型需要 command 字段"
      );
    });

    it("SSE 类型缺少 url 时应该抛出错误", () => {
      const config: MCPServiceConfig = {
        name: "test",
        type: MCPTransportType.SSE,
      };

      expect(() => TransportFactory.validateConfig(config)).toThrow(
        "sse 类型需要 url 字段"
      );
    });

    it("SSE 类型 url 为 null 时应该抛出错误", () => {
      const config: MCPServiceConfig = {
        name: "test",
        type: MCPTransportType.SSE,
        url: null as unknown as string,
      };

      expect(() => TransportFactory.validateConfig(config)).toThrow(
        "sse 类型需要 url 字段"
      );
    });

    it("streamable-http 类型缺少 url 时应该抛出错误", () => {
      const config: MCPServiceConfig = {
        name: "test",
        type: MCPTransportType.STREAMABLE_HTTP,
      };

      expect(() => TransportFactory.validateConfig(config)).toThrow(
        "streamable-http 类型需要 url 字段"
      );
    });

    it("应该接受带 apiKey 的配置", () => {
      const config: MCPServiceConfig = {
        name: "test",
        type: MCPTransportType.SSE,
        url: "https://example.com/sse",
        apiKey: "test-key",
      };

      expect(() => TransportFactory.validateConfig(config)).not.toThrow();
    });

    it("应该接受带 headers 的配置", () => {
      const config: MCPServiceConfig = {
        name: "test",
        type: MCPTransportType.SSE,
        url: "https://example.com/sse",
        headers: { Authorization: "Bearer token" },
      };

      expect(() => TransportFactory.validateConfig(config)).not.toThrow();
    });

    it("应该接受带 env 的 stdio 配置", () => {
      const config: MCPServiceConfig = {
        name: "test",
        type: MCPTransportType.STDIO,
        command: "node",
        env: { NODE_ENV: "test" },
      };

      expect(() => TransportFactory.validateConfig(config)).not.toThrow();
    });

    it("应该接受带 timeout 的配置", () => {
      const config: MCPServiceConfig = {
        name: "test",
        type: MCPTransportType.SSE,
        url: "https://example.com/sse",
        timeout: 5000,
      };

      expect(() => TransportFactory.validateConfig(config)).not.toThrow();
    });
  });

  describe("createTransport", () => {
    it("应该创建 stdio transport", () => {
      const config: MCPServiceConfig = {
        name: "test-stdio",
        type: MCPTransportType.STDIO,
        command: "node",
        args: ["server.js"],
      };

      const transport = TransportFactory.create(config);

      expect(transport).toBeDefined();
      expect(typeof transport.start).toBe("function");
    });

    it("应该创建 SSE transport", () => {
      const config: MCPServiceConfig = {
        name: "test-sse",
        type: MCPTransportType.SSE,
        url: "https://example.com/sse",
      };

      const transport = TransportFactory.create(config);

      expect(transport).toBeDefined();
    });

    it("应该创建 streamable-http transport", () => {
      const config: MCPServiceConfig = {
        name: "test-http",
        type: MCPTransportType.STREAMABLE_HTTP,
        url: "https://example.com/mcp",
      };

      const transport = TransportFactory.create(config);

      expect(transport).toBeDefined();
    });

    it("stdio 缺少 command 时应该抛出错误", () => {
      const config: MCPServiceConfig = {
        name: "test",
        type: MCPTransportType.STDIO,
      };

      expect(() => TransportFactory.create(config)).toThrow(
        "stdio transport 需要 command 配置"
      );
    });

    it("SSE 缺少 url 时应该抛出错误", () => {
      const config: MCPServiceConfig = {
        name: "test",
        type: MCPTransportType.SSE,
      };

      expect(() => TransportFactory.create(config)).toThrow(
        "SSE transport 需要 URL 配置"
      );
    });

    it("streamable-http 缺少 url 时应该抛出错误", () => {
      const config: MCPServiceConfig = {
        name: "test",
        type: MCPTransportType.STREAMABLE_HTTP,
      };

      expect(() => TransportFactory.create(config)).toThrow(
        "StreamableHTTP transport 需要 URL 配置"
      );
    });

    it("不支持的传输类型时应该抛出错误", () => {
      const config = {
        name: "test",
        type: "unsupported" as MCPTransportType,
      } as MCPServiceConfig;

      expect(() => TransportFactory.create(config)).toThrow(
        "不支持的传输类型"
      );
    });
  });

  describe("getSupportedTypes", () => {
    it("应该返回支持的传输类型列表", () => {
      const types = TransportFactory.getSupportedTypes();

      expect(types).toContain(MCPTransportType.STDIO);
      expect(types).toContain(MCPTransportType.SSE);
      expect(types).toContain(MCPTransportType.STREAMABLE_HTTP);
      expect(types).toHaveLength(3);
    });
  });

  describe("TransportFactory 对象", () => {
    it("应该导出正确的对象结构", () => {
      expect(TransportFactory).toBeDefined();
      expect(typeof TransportFactory.validateConfig).toBe("function");
      expect(typeof TransportFactory.create).toBe("function");
      expect(typeof TransportFactory.getSupportedTypes).toBe("function");
    });
  });

  describe("配置选项验证", () => {
    it("应该接受空的 args 数组", () => {
      const config: MCPServiceConfig = {
        name: "test",
        type: MCPTransportType.STDIO,
        command: "node",
        args: [],
      };

      expect(() => TransportFactory.validateConfig(config)).not.toThrow();
    });

    it("应该接受可选的 retryAttempts 配置", () => {
      const config: MCPServiceConfig = {
        name: "test",
        type: MCPTransportType.SSE,
        url: "https://example.com/sse",
        retryAttempts: 3,
      };

      expect(() => TransportFactory.validateConfig(config)).not.toThrow();
    });

    it("应该接受 modelScopeAuth 配置", () => {
      const config: MCPServiceConfig = {
        name: "test",
        type: MCPTransportType.SSE,
        url: "https://mcp.api-inference.modelscope.net/test/sse",
        modelScopeAuth: true,
      };

      expect(() => TransportFactory.validateConfig(config)).not.toThrow();
    });

    it("应该接受 customSSEOptions 配置", () => {
      const config: MCPServiceConfig = {
        name: "test",
        type: MCPTransportType.SSE,
        url: "https://example.com/sse",
        customSSEOptions: {
          eventSourceInit: {
            fetch: async () =>
              new Response("test", { status: 200, statusText: "OK" }),
          },
        },
      };

      expect(() => TransportFactory.validateConfig(config)).not.toThrow();
    });
  });
});

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

    it("对于其他路径应该默认推断为 streamable-http 类型", () => {
      const config = {
        name: "other-service",
        url: "https://example.com/api/v1/tools",
      };

      const service = new MCPService(config);
      const serviceConfig = service.getConfig();

      expect(serviceConfig.type).toBe(MCPTransportType.STREAMABLE_HTTP);
    });

    it("对于根路径应该默认推断为 streamable-http 类型", () => {
      const config = {
        name: "root-service",
        url: "https://example.com/",
      };

      const service = new MCPService(config);
      const serviceConfig = service.getConfig();

      expect(serviceConfig.type).toBe(MCPTransportType.STREAMABLE_HTTP);
    });
  });

  describe("错误处理", () => {
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
  });
});

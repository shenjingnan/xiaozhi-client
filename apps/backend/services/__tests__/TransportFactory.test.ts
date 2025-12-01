import { TransportFactory } from "@/lib/mcp/transport-factory.js";
import { describe, expect, it } from "vitest";
import { MCPTransportType } from "../MCPService.js";

describe("TransportFactory", () => {
  describe("validateConfig", () => {
    it("should validate stdio config", () => {
      const config = {
        name: "test-stdio",
        type: MCPTransportType.STDIO,
        command: "node",
        args: ["test.js"],
      };

      expect(() => TransportFactory.validateConfig(config)).not.toThrow();
    });

    it("should validate SSE config", () => {
      const config = {
        name: "test-sse",
        type: MCPTransportType.SSE,
        url: "https://example.com/sse",
      };

      expect(() => TransportFactory.validateConfig(config)).not.toThrow();
    });

    it("should validate streamable-http config", () => {
      const config = {
        name: "test-http",
        type: MCPTransportType.STREAMABLE_HTTP,
        url: "https://example.com/mcp",
      };

      expect(() => TransportFactory.validateConfig(config)).not.toThrow();
    });

    it("should throw error for missing name", () => {
      const config = {
        type: MCPTransportType.STDIO,
        command: "node",
      } as any;

      expect(() => TransportFactory.validateConfig(config)).toThrow(
        "配置必须包含有效的 name 字段"
      );
    });

    it("should throw error for missing type", () => {
      const config = {
        name: "test",
        command: "node",
      } as any;

      expect(() => TransportFactory.validateConfig(config)).toThrow(
        "传输类型未设置，这应该在 inferTransportType 中处理"
      );
    });

    it("should throw error for stdio without command", () => {
      const config = {
        name: "test-stdio",
        type: MCPTransportType.STDIO,
      } as any;

      expect(() => TransportFactory.validateConfig(config)).toThrow(
        "stdio 类型需要 command 字段"
      );
    });

    it("should throw error for SSE without URL", () => {
      const config = {
        name: "test-sse",
        type: MCPTransportType.SSE,
        url: undefined,
      } as any;

      expect(() => TransportFactory.validateConfig(config)).toThrow(
        "sse 类型需要 url 字段"
      );
    });

    it("should throw error for streamable-http without URL", () => {
      const config = {
        name: "test-http",
        type: MCPTransportType.STREAMABLE_HTTP,
        url: undefined,
      } as any;

      expect(() => TransportFactory.validateConfig(config)).toThrow(
        "streamable-http 类型需要 url 字段"
      );
    });
  });

  describe("getSupportedTypes", () => {
    it("should return all supported transport types", () => {
      const types = TransportFactory.getSupportedTypes();

      expect(types).toEqual(["stdio", "sse", "streamable-http"]);
    });
  });
});

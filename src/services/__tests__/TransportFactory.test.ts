import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Logger } from "../../logger.js";
import type { MCPServiceConfig } from "../MCPService.js";
import { TransportFactory } from "../TransportFactory.js";

// Mock dependencies
vi.mock("@modelcontextprotocol/sdk/client/stdio.js");
vi.mock("@modelcontextprotocol/sdk/client/sse.js");
vi.mock("@modelcontextprotocol/sdk/client/streamableHttp.js");
vi.mock("../../logger.js");
vi.mock("eventsource");

describe("TransportFactory", () => {
  let mockLogger: any;

  beforeEach(() => {
    vi.clearAllMocks();

    // Mock Logger
    mockLogger = {
      info: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
      withTag: vi.fn().mockReturnThis(),
    };
    vi.mocked(Logger).mockImplementation(() => mockLogger);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("create", () => {
    it("should create stdio transport", () => {
      const config: MCPServiceConfig = {
        name: "test-stdio",
        type: "stdio",
        command: "node",
        args: ["test.js"],
      };

      const transport = TransportFactory.create(config);

      expect(StdioClientTransport).toHaveBeenCalledWith({
        command: "node",
        args: ["test.js"],
      });
      expect(transport).toBeInstanceOf(StdioClientTransport);
    });

    it("should create SSE transport", () => {
      const config: MCPServiceConfig = {
        name: "test-sse",
        type: "sse",
        url: "https://example.com/sse",
      };

      const transport = TransportFactory.create(config);

      expect(SSEClientTransport).toHaveBeenCalledWith(
        new URL("https://example.com/sse"),
        {}
      );
      expect(transport).toBeInstanceOf(SSEClientTransport);
    });

    it("should create SSE transport with API key", () => {
      const config: MCPServiceConfig = {
        name: "test-sse-auth",
        type: "sse",
        url: "https://example.com/sse",
        apiKey: "test-api-key",
      };

      const transport = TransportFactory.create(config);

      expect(SSEClientTransport).toHaveBeenCalledWith(
        new URL("https://example.com/sse"),
        {
          headers: {
            Authorization: "Bearer test-api-key",
          },
        }
      );
    });

    it("should create SSE transport with custom headers", () => {
      const config: MCPServiceConfig = {
        name: "test-sse-headers",
        type: "sse",
        url: "https://example.com/sse",
        headers: {
          "Custom-Header": "custom-value",
        },
      };

      const transport = TransportFactory.create(config);

      expect(SSEClientTransport).toHaveBeenCalledWith(
        new URL("https://example.com/sse"),
        {
          headers: {
            "Custom-Header": "custom-value",
          },
        }
      );
    });

    it("should create streamable-http transport", () => {
      const config: MCPServiceConfig = {
        name: "test-http",
        type: "streamable-http",
        url: "https://example.com/api",
      };

      const transport = TransportFactory.create(config);

      expect(transport).toBeInstanceOf(StreamableHTTPClientTransport);
    });

    it("should throw error for unsupported transport type", () => {
      const config = {
        name: "test-unsupported",
        type: "unsupported",
        url: "https://example.com",
      } as any;

      expect(() => TransportFactory.create(config)).toThrow(
        "不支持的传输类型: unsupported"
      );
    });

    it("should throw error for stdio without command", () => {
      const config: MCPServiceConfig = {
        name: "test-stdio-invalid",
        type: "stdio",
      };

      expect(() => TransportFactory.create(config)).toThrow(
        "stdio transport 需要 command 配置"
      );
    });

    it("should throw error for SSE without URL", () => {
      const config: MCPServiceConfig = {
        name: "test-sse-invalid",
        type: "sse",
      };

      expect(() => TransportFactory.create(config)).toThrow(
        "SSE transport 需要 URL 配置"
      );
    });

    it("should throw error for streamable-http without URL", () => {
      const config: MCPServiceConfig = {
        name: "test-http-invalid",
        type: "streamable-http",
      };

      expect(() => TransportFactory.create(config)).toThrow(
        "StreamableHTTP transport 需要 URL 配置"
      );
    });
  });

  describe("validateConfig", () => {
    it("should validate stdio config", () => {
      const config: MCPServiceConfig = {
        name: "test-stdio",
        type: "stdio",
        command: "node",
        args: ["test.js"],
      };

      expect(() => TransportFactory.validateConfig(config)).not.toThrow();
    });

    it("should validate SSE config", () => {
      const config: MCPServiceConfig = {
        name: "test-sse",
        type: "sse",
        url: "https://example.com/sse",
      };

      expect(() => TransportFactory.validateConfig(config)).not.toThrow();
    });

    it("should validate streamable-http config", () => {
      const config: MCPServiceConfig = {
        name: "test-http",
        type: "streamable-http",
        url: "https://example.com/api",
      };

      expect(() => TransportFactory.validateConfig(config)).not.toThrow();
    });

    it("should throw error for missing name", () => {
      const config = {
        type: "stdio",
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
        "配置必须包含 type 字段"
      );
    });

    it("should throw error for stdio without command", () => {
      const config: MCPServiceConfig = {
        name: "test-stdio",
        type: "stdio",
      };

      expect(() => TransportFactory.validateConfig(config)).toThrow(
        "stdio 类型需要 command 字段"
      );
    });

    it("should throw error for SSE without URL", () => {
      const config: MCPServiceConfig = {
        name: "test-sse",
        type: "sse",
      };

      expect(() => TransportFactory.validateConfig(config)).toThrow(
        "sse 类型需要 url 字段"
      );
    });

    it("should throw error for streamable-http without URL", () => {
      const config: MCPServiceConfig = {
        name: "test-http",
        type: "streamable-http",
      };

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

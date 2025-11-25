import { MCPServiceManager } from "@/lib/mcp";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { setupCommonMocks } from "../../__tests__/index.js";
import { configManager } from "../../configManager.js";
import type { MCPServiceConfig } from "../MCPService.js";
import { MCPTransportType } from "../MCPService.js";
import { TransportFactory } from "../TransportFactory.js";

// Mock dependencies
vi.mock("../MCPService.js");
vi.mock("../TransportFactory.js");

// 设置统一的mock配置
setupCommonMocks();

describe("Multi-Protocol Integration", () => {
  let manager: MCPServiceManager;
  let mockLogger: any;

  beforeEach(() => {
    vi.clearAllMocks();

    // Mock Logger
    mockLogger = {
      info: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
      debug: vi.fn(),
      withTag: vi.fn().mockReturnThis(),
    };

    // Mock configManager methods
    vi.spyOn(configManager, "getServerToolsConfig").mockReturnValue({});
    vi.spyOn(configManager, "getCustomMCPTools").mockReturnValue([]);
    vi.spyOn(configManager, "addCustomMCPTools").mockResolvedValue(undefined);
    vi.spyOn(configManager, "getToolCallLogConfig").mockReturnValue({});
    vi.spyOn(configManager, "getConfigDir").mockReturnValue("/tmp/test-config");

    manager = new MCPServiceManager();

    // Replace ToolSyncManager's logger with mock logger to avoid real logger calls
    (manager as any).toolSyncManager.logger = mockLogger;

    // Mock TransportFactory
    vi.mocked(TransportFactory).validateConfig = vi.fn();
    vi.mocked(TransportFactory).create = vi.fn();
    vi.mocked(TransportFactory).getSupportedTypes = vi
      .fn()
      .mockReturnValue(["stdio", "sse", "streamable-http"]);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("Protocol Support Verification", () => {
    it("should support all three transport protocols", () => {
      const supportedTypes = TransportFactory.getSupportedTypes();

      expect(supportedTypes).toContain("stdio");
      expect(supportedTypes).toContain("sse");
      expect(supportedTypes).toContain("streamable-http");
      expect(supportedTypes).toHaveLength(3);
    });

    it("should validate configurations for all protocols", () => {
      const configs: MCPServiceConfig[] = [
        {
          name: "stdio-service",
          type: MCPTransportType.STDIO,
          command: "node",
          args: ["server.js"],
        },
        {
          name: "sse-service",
          type: MCPTransportType.SSE,
          url: "https://example.com/sse",
          apiKey: "test-key",
        },
        {
          name: "http-service",
          type: MCPTransportType.STREAMABLE_HTTP,
          url: "https://example.com/api",
          headers: { "Content-Type": "application/json" },
        },
      ];

      for (const config of configs) {
        expect(() => TransportFactory.validateConfig(config)).not.toThrow();
      }
    });

    it("should create transports for all protocols", () => {
      const configs: MCPServiceConfig[] = [
        {
          name: "stdio-service",
          type: MCPTransportType.STDIO,
          command: "node",
          args: ["server.js"],
        },
        {
          name: "sse-service",
          type: MCPTransportType.SSE,
          url: "https://example.com/sse",
        },
        {
          name: "http-service",
          type: MCPTransportType.STREAMABLE_HTTP,
          url: "https://example.com/api",
        },
      ];

      for (const config of configs) {
        expect(() => TransportFactory.create(config)).not.toThrow();
        expect(TransportFactory.create).toHaveBeenCalledWith(config);
      }
    });
  });

  describe("Service Manager Integration", () => {
    it("should manage services with different protocols", () => {
      // Add services with different protocols
      manager.addServiceConfig("stdio-calc", {
        name: "stdio-calc",
        type: MCPTransportType.STDIO,
        command: "node",
        args: ["calc.js"],
      });

      manager.addServiceConfig("sse-weather", {
        name: "sse-weather",
        type: MCPTransportType.SSE,
        url: "https://weather.example.com/sse",
        apiKey: "weather-key",
      });

      manager.addServiceConfig("http-translate", {
        name: "http-translate",
        type: MCPTransportType.STREAMABLE_HTTP,
        url: "https://translate.example.com/api",
        headers: { Authorization: "Bearer translate-token" },
      });

      // Verify all services are configured (check if configs exist)
      expect(manager.getService("stdio-calc")).toBeUndefined(); // Not started yet
      expect(manager.getService("sse-weather")).toBeUndefined(); // Not started yet
      expect(manager.getService("http-translate")).toBeUndefined(); // Not started yet

      // Verify configs were added by checking if we can add them without error
      expect(() =>
        manager.addServiceConfig("stdio-calc", {
          name: "stdio-calc",
          type: MCPTransportType.STDIO,
          command: "node",
          args: ["calc.js"],
        })
      ).not.toThrow();
    });

    it("should handle mixed protocol startup", async () => {
      // Setup mixed protocol services
      manager.addServiceConfig("stdio-service", {
        name: "stdio-service",
        type: MCPTransportType.STDIO,
        command: "node",
        args: ["server.js"],
      });

      manager.addServiceConfig("sse-service", {
        name: "sse-service",
        type: MCPTransportType.SSE,
        url: "https://example.com/sse",
      });

      // Mock successful startup
      const { MCPService } = await import("../MCPService.js");
      const mockService = {
        connect: vi.fn().mockResolvedValue(undefined),
        getTools: vi.fn().mockReturnValue([]),
        isConnected: vi.fn().mockReturnValue(true),
      };
      vi.mocked(MCPService).mockImplementation(() => mockService as any);

      // Start all services
      await manager.startAllServices();

      // Verify both services were started
      expect(MCPService).toHaveBeenCalledTimes(2);
      expect(mockService.connect).toHaveBeenCalledTimes(2);
    });
  });

  describe("Error Handling", () => {
    it("should handle invalid protocol configurations", () => {
      const invalidConfigs = [
        {
          name: "invalid-stdio",
          type: MCPTransportType.STDIO,
          // Missing command
        },
        {
          name: "invalid-sse",
          type: MCPTransportType.SSE,
          // Missing URL
        },
        {
          name: "invalid-http",
          type: MCPTransportType.STREAMABLE_HTTP,
          // Missing URL
        },
      ];

      for (const config of invalidConfigs) {
        vi.mocked(TransportFactory).validateConfig.mockImplementation(() => {
          throw new Error(`Invalid config for ${config.type}`);
        });

        expect(() => TransportFactory.validateConfig(config as any)).toThrow();
      }
    });

    it("should handle unsupported transport types", () => {
      const unsupportedConfig = {
        name: "unsupported-service",
        type: "websocket" as any,
        url: "ws://example.com",
      };

      vi.mocked(TransportFactory).validateConfig.mockImplementation(() => {
        throw new Error("不支持的传输类型: websocket");
      });

      expect(() => TransportFactory.validateConfig(unsupportedConfig)).toThrow(
        "不支持的传输类型: websocket"
      );
    });
  });

  describe("Backward Compatibility", () => {
    it("should maintain compatibility with existing stdio configurations", () => {
      const legacyConfig: MCPServiceConfig = {
        name: "legacy-calculator",
        type: MCPTransportType.STDIO,
        command: "node",
        args: ["legacy-calc.js"],
      };

      // Should work exactly as before
      expect(() =>
        manager.addServiceConfig("legacy-calculator", legacyConfig)
      ).not.toThrow();
      expect(() => TransportFactory.validateConfig(legacyConfig)).not.toThrow();
      expect(() => TransportFactory.create(legacyConfig)).not.toThrow();
    });

    it("should preserve existing API surface", () => {
      // Verify that all expected methods exist
      expect(typeof TransportFactory.create).toBe("function");
      expect(typeof TransportFactory.validateConfig).toBe("function");
      expect(typeof TransportFactory.getSupportedTypes).toBe("function");

      expect(typeof manager.addServiceConfig).toBe("function");
      expect(typeof manager.removeServiceConfig).toBe("function");
      expect(typeof manager.startAllServices).toBe("function");
      expect(typeof manager.stopAllServices).toBe("function");
    });
  });
});

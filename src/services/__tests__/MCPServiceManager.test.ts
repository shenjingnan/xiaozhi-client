import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Logger } from "../../Logger.js";
import {
  MCPService,
  type MCPServiceConfig,
  MCPTransportType,
} from "../MCPService.js";
import { MCPServiceManager } from "../MCPServiceManager.js";

// Mock dependencies
vi.mock("../MCPService.js");
vi.mock("../../Logger.js");

describe("MCPServiceManager", () => {
  let manager: MCPServiceManager;
  let mockLogger: any;
  let mockMCPService: any;

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

    // Mock MCPService
    mockMCPService = {
      connect: vi.fn(),
      disconnect: vi.fn(),
      isConnected: vi.fn(),
      getTools: vi.fn(),
      callTool: vi.fn(),
      getStatus: vi.fn(),
    };
    vi.mocked(MCPService).mockImplementation(() => mockMCPService);

    manager = new MCPServiceManager();

    // 添加测试用的服务配置
    manager.addServiceConfig("calculator", {
      name: "calculator",
      type: MCPTransportType.STDIO,
      command: "node",
      args: ["calculator.js"],
    });

    manager.addServiceConfig("datetime", {
      name: "datetime",
      type: MCPTransportType.STDIO,
      command: "node",
      args: ["datetime.js"],
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("constructor", () => {
    it("should create MCPServiceManager with empty configs by default", () => {
      const emptyManager = new MCPServiceManager();
      expect(emptyManager).toBeInstanceOf(MCPServiceManager);
      expect(mockLogger.withTag).toHaveBeenCalledWith("MCPManager");
    });

    it("should create MCPServiceManager with custom configs", () => {
      const customConfigs = {
        "test-service": {
          name: "test-service",
          type: MCPTransportType.STDIO,
          command: "node",
          args: ["test.js"],
        },
      };

      const customManager = new MCPServiceManager(customConfigs);
      expect(customManager).toBeInstanceOf(MCPServiceManager);
    });
  });

  describe("startAllServices", () => {
    it("should warn when no services are configured", async () => {
      const emptyManager = new MCPServiceManager();

      await emptyManager.startAllServices();

      expect(mockLogger.info).toHaveBeenCalledWith("正在启动所有 MCP 服务...");
      expect(mockLogger.warn).toHaveBeenCalledWith(
        "没有配置任何 MCP 服务，请使用 addServiceConfig() 添加服务配置"
      );
      expect(MCPService).not.toHaveBeenCalled();
    });

    it("should start all configured services", async () => {
      mockMCPService.connect.mockResolvedValue(undefined);
      mockMCPService.getTools.mockReturnValue([]);

      await manager.startAllServices();

      expect(mockLogger.info).toHaveBeenCalledWith("正在启动所有 MCP 服务...");
      expect(mockLogger.info).toHaveBeenCalledWith("所有 MCP 服务启动完成");
      expect(MCPService).toHaveBeenCalledTimes(2); // calculator and datetime
    });

    it("should handle service start failure", async () => {
      const error = new Error("Service start failed");
      mockMCPService.connect.mockRejectedValue(error);

      await expect(manager.startAllServices()).rejects.toThrow(
        "Service start failed"
      );
    });
  });

  describe("startService", () => {
    it("should start a single service successfully", async () => {
      mockMCPService.connect.mockResolvedValue(undefined);
      mockMCPService.getTools.mockReturnValue([
        { name: "test-tool", description: "Test tool", inputSchema: {} },
      ]);

      await manager.startService("calculator");

      expect(MCPService).toHaveBeenCalledWith(
        expect.objectContaining({
          name: "calculator",
          type: MCPTransportType.STDIO,
        })
      );
      expect(mockMCPService.connect).toHaveBeenCalled();
      expect(mockLogger.info).toHaveBeenCalledWith("启动 MCP 服务: calculator");
    });

    it("should throw error for non-existent service", async () => {
      await expect(manager.startService("non-existent")).rejects.toThrow(
        "未找到服务配置: non-existent"
      );
    });

    it("should stop existing service before starting new one", async () => {
      mockMCPService.connect.mockResolvedValue(undefined);
      mockMCPService.disconnect.mockResolvedValue(undefined);
      mockMCPService.getTools.mockReturnValue([]);

      // Start service first time
      await manager.startService("calculator");

      // Start service second time (should stop first)
      await manager.startService("calculator");

      expect(mockMCPService.disconnect).toHaveBeenCalled();
      expect(MCPService).toHaveBeenCalledTimes(2);
    });
  });

  describe("stopService", () => {
    it("should stop a running service", async () => {
      mockMCPService.connect.mockResolvedValue(undefined);
      mockMCPService.disconnect.mockResolvedValue(undefined);
      mockMCPService.getTools.mockReturnValue([]);

      // Start service first
      await manager.startService("calculator");

      // Then stop it
      await manager.stopService("calculator");

      expect(mockMCPService.disconnect).toHaveBeenCalled();
      expect(mockLogger.info).toHaveBeenCalledWith("calculator 服务已停止");
    });

    it("should handle stopping non-existent service", async () => {
      await manager.stopService("non-existent");

      expect(mockLogger.warn).toHaveBeenCalledWith(
        "服务 non-existent 不存在或未启动"
      );
    });
  });

  describe("stopAllServices", () => {
    it("should stop all running services", async () => {
      mockMCPService.connect.mockResolvedValue(undefined);
      mockMCPService.disconnect.mockResolvedValue(undefined);
      mockMCPService.getTools.mockReturnValue([]);

      // Start services first
      await manager.startService("calculator");
      await manager.startService("datetime");

      // Then stop all
      await manager.stopAllServices();

      expect(mockMCPService.disconnect).toHaveBeenCalledTimes(2);
      expect(mockLogger.info).toHaveBeenCalledWith("所有 MCP 服务已停止");
    });
  });

  describe("getAllTools", () => {
    it("should return empty array when no services running", () => {
      const tools = manager.getAllTools();
      expect(tools).toEqual([]);
    });

    it("should return tools from all running services", async () => {
      const mockTools = [
        { name: "add", description: "Add numbers", inputSchema: {} },
        { name: "multiply", description: "Multiply numbers", inputSchema: {} },
      ];

      mockMCPService.connect.mockResolvedValue(undefined);
      mockMCPService.getTools.mockReturnValue(mockTools);
      mockMCPService.isConnected.mockReturnValue(true);

      await manager.startService("calculator");

      const tools = manager.getAllTools();
      expect(tools).toHaveLength(2);
      expect(tools[0].name).toBe("calculator__add");
      expect(tools[0].serviceName).toBe("calculator");
      expect(tools[0].originalName).toBe("add");
    });
  });

  describe("callTool", () => {
    beforeEach(async () => {
      const mockTools = [
        { name: "add", description: "Add numbers", inputSchema: {} },
      ];

      mockMCPService.connect.mockResolvedValue(undefined);
      mockMCPService.getTools.mockReturnValue(mockTools);
      mockMCPService.isConnected.mockReturnValue(true);
      mockMCPService.callTool.mockResolvedValue({
        content: [{ type: "text", text: "8" }],
      });

      await manager.startService("calculator");
    });

    it("should call tool successfully", async () => {
      const result = await manager.callTool("calculator__add", { a: 3, b: 5 });

      expect(mockMCPService.callTool).toHaveBeenCalledWith("add", {
        a: 3,
        b: 5,
      });
      expect(result).toEqual({ content: [{ type: "text", text: "8" }] });
    });

    it("should throw error for non-existent tool", async () => {
      await expect(manager.callTool("non-existent-tool", {})).rejects.toThrow(
        "未找到工具: non-existent-tool"
      );
    });

    it("should throw error for unavailable service", async () => {
      // Stop the service
      mockMCPService.disconnect.mockResolvedValue(undefined);
      await manager.stopService("calculator");

      await expect(manager.callTool("calculator__add", {})).rejects.toThrow(
        "未找到工具: calculator__add"
      );
    });

    it("should throw error for disconnected service", async () => {
      mockMCPService.isConnected.mockReturnValue(false);

      await expect(manager.callTool("calculator__add", {})).rejects.toThrow(
        "服务 calculator 未连接"
      );
    });
  });

  describe("getStatus", () => {
    it("should return status with no services", () => {
      const status = manager.getStatus();

      expect(status).toEqual({
        services: {},
        totalTools: 0,
        availableTools: [],
      });
    });

    it("should return status with running services", async () => {
      mockMCPService.connect.mockResolvedValue(undefined);
      mockMCPService.getTools.mockReturnValue([{ name: "add" }]);
      mockMCPService.isConnected.mockReturnValue(true);
      mockMCPService.getStatus.mockReturnValue({
        connected: true,
        initialized: true,
      });

      await manager.startService("calculator");

      const status = manager.getStatus();

      expect(status.services.calculator).toEqual({
        connected: true,
        clientName: "xiaozhi-calculator-client",
      });
      expect(status.totalTools).toBe(1);
      expect(status.availableTools).toContain("calculator__add");
    });
  });

  describe("getService", () => {
    it("should return undefined for non-existent service", () => {
      const service = manager.getService("non-existent");
      expect(service).toBeUndefined();
    });

    it("should return service instance for existing service", async () => {
      mockMCPService.connect.mockResolvedValue(undefined);
      mockMCPService.getTools.mockReturnValue([]);

      await manager.startService("calculator");

      const service = manager.getService("calculator");
      expect(service).toBe(mockMCPService);
    });
  });

  describe("configuration management", () => {
    it("should add service configuration", () => {
      const config: MCPServiceConfig = {
        name: "new-service",
        type: MCPTransportType.STDIO,
        command: "node",
        args: ["new-service.js"],
      };

      manager.addServiceConfig("new-service", config);

      expect(mockLogger.info).toHaveBeenCalledWith(
        "已添加服务配置: new-service"
      );
    });

    it("should remove service configuration", () => {
      manager.removeServiceConfig("calculator");

      expect(mockLogger.info).toHaveBeenCalledWith(
        "已移除服务配置: calculator"
      );
    });
  });

  describe("multi-protocol support", () => {
    it("should support SSE services", async () => {
      const sseConfig: MCPServiceConfig = {
        name: "sse-service",
        type: MCPTransportType.SSE,
        url: "https://example.com/sse",
        apiKey: "test-key",
      };

      manager.addServiceConfig("sse-service", sseConfig);

      mockMCPService.connect.mockResolvedValue(undefined);
      mockMCPService.getTools.mockReturnValue([
        { name: "sse-tool", description: "SSE tool", inputSchema: {} },
      ]);

      await manager.startService("sse-service");

      expect(MCPService).toHaveBeenCalledWith(sseConfig);
      expect(mockMCPService.connect).toHaveBeenCalled();
    });

    it("should support streamable-http services", async () => {
      const httpConfig: MCPServiceConfig = {
        name: "http-service",
        type: MCPTransportType.STREAMABLE_HTTP,
        url: "https://example.com/api",
        headers: { Authorization: "Bearer token" },
      };

      manager.addServiceConfig("http-service", httpConfig);

      mockMCPService.connect.mockResolvedValue(undefined);
      mockMCPService.getTools.mockReturnValue([
        { name: "http-tool", description: "HTTP tool", inputSchema: {} },
      ]);

      await manager.startService("http-service");

      expect(MCPService).toHaveBeenCalledWith(httpConfig);
      expect(mockMCPService.connect).toHaveBeenCalled();
    });

    it("should handle mixed protocol services", async () => {
      // Add different protocol services
      manager.addServiceConfig("sse-service", {
        name: "sse-service",
        type: MCPTransportType.SSE,
        url: "https://example.com/sse",
      });

      manager.addServiceConfig("http-service", {
        name: "http-service",
        type: MCPTransportType.STREAMABLE_HTTP,
        url: "https://example.com/api",
      });

      mockMCPService.connect.mockResolvedValue(undefined);
      mockMCPService.getTools.mockReturnValue([
        { name: "mixed-tool", description: "Mixed tool", inputSchema: {} },
      ]);
      mockMCPService.isConnected.mockReturnValue(true);

      // Start all services
      await manager.startAllServices();

      // Should have started 4 services (calculator, datetime, sse-service, http-service)
      expect(MCPService).toHaveBeenCalledTimes(4);
    });

    it("should aggregate tools from different protocols", async () => {
      // Setup services with different protocols
      manager.addServiceConfig("sse-service", {
        name: "sse-service",
        type: MCPTransportType.SSE,
        url: "https://example.com/sse",
      });

      // Create separate mock instances for each service
      const mockServices = new Map();

      vi.mocked(MCPService).mockImplementation((config: MCPServiceConfig) => {
        if (!mockServices.has(config.name)) {
          const serviceMock = {
            connect: vi.fn().mockResolvedValue(undefined),
            disconnect: vi.fn().mockResolvedValue(undefined),
            isConnected: vi.fn().mockReturnValue(true),
            getTools: vi.fn(),
            callTool: vi.fn(),
            getStatus: vi.fn(),
          };

          // Set different tools for each service
          if (config.name === "calculator") {
            serviceMock.getTools.mockReturnValue([
              {
                name: "calc-add",
                description: "Calculator add",
                inputSchema: {},
              },
            ]);
          } else if (config.name === "datetime") {
            serviceMock.getTools.mockReturnValue([
              {
                name: "time-now",
                description: "Current time",
                inputSchema: {},
              },
            ]);
          } else if (config.name === "sse-service") {
            serviceMock.getTools.mockReturnValue([
              {
                name: "sse-notify",
                description: "SSE notification",
                inputSchema: {},
              },
            ]);
          }

          mockServices.set(config.name, serviceMock);
        }
        return mockServices.get(config.name);
      });

      await manager.startAllServices();

      const tools = manager.getAllTools();

      expect(tools).toHaveLength(3);
      expect(tools.map((t) => t.name)).toEqual([
        "calculator__calc-add",
        "datetime__time-now",
        "sse-service__sse-notify",
      ]);
    });
  });
});

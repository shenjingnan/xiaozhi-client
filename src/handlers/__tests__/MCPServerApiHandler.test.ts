#!/usr/bin/env node

/**
 * MCP Server API Handler 测试
 * 测试动态 MCP 服务管理的 API 接口
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MCPServerApiHandler } from "../MCPServerApiHandler.js";

// Mock dependencies
vi.mock("../../Logger.js", () => ({
  logger: {
    withTag: vi.fn().mockReturnValue({
      debug: vi.fn(),
      info: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
    }),
  },
}));

vi.mock("../../configManager.js", () => ({
  configManager: {
    removeServerToolsConfig: vi.fn(),
    removeCustomMCPTools: vi.fn(),
    getMcpServerConfig: vi.fn(),
    addMcpServer: vi.fn(),
    removeMcpServer: vi.fn(),
    getCustomMCPTools: vi.fn(),
    addCustomMCPTools: vi.fn(),
    updateCustomMCPTools: vi.fn(),
  },
}));

vi.mock("../../services/MCPServiceManagerSingleton.js", () => ({
  MCPServiceManagerSingleton: {
    getInstance: vi.fn().mockResolvedValue({}),
  },
}));

vi.mock("../../services/ToolSyncManager.js", () => ({
  ToolSyncManager: vi.fn().mockImplementation(() => ({
    syncToolsAfterServiceAdded: vi.fn(),
    syncToolsAfterServiceRemoved: vi.fn(),
  })),
}));

vi.mock("../../services/EventBus.js", () => ({
  getEventBus: vi.fn().mockReturnValue({
    onEvent: vi.fn(),
    onceEvent: vi.fn(),
    emitEvent: vi.fn(),
    offEvent: vi.fn(),
  }),
}));

describe("MCPServerApiHandler", () => {
  let apiHandler: MCPServerApiHandler;
  let mockServiceManager: any;

  beforeEach(async () => {
    // 重置 mocks
    vi.clearAllMocks();

    // 创建 mock 服务管理器实例
    mockServiceManager = {
      addServiceConfig: vi.fn(),
      removeServiceConfig: vi.fn(),
      addAndStartService: vi.fn(),
      removeService: vi.fn(),
      testServiceConnection: vi.fn(),
      getServiceStatus: vi.fn(),
      getServiceTools: vi.fn(),
      updateServiceConfig: vi.fn(),
      getServiceConfig: vi.fn(),
    };

    // 设置 mock 返回值
    const { MCPServiceManagerSingleton } = await import(
      "../../services/MCPServiceManagerSingleton.js"
    );
    const mockedGetInstance = vi.mocked(MCPServiceManagerSingleton.getInstance);
    mockedGetInstance.mockResolvedValue(mockServiceManager);

    apiHandler = new MCPServerApiHandler();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("POST /api/mcp-servers/add", () => {
    it("应该验证请求体格式", async () => {
      const c = {
        req: {
          json: vi.fn().mockResolvedValue(null),
        },
        json: vi.fn(),
      } as any;

      await apiHandler.addMCPServer(c);

      expect(c.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({
            code: "INVALID_REQUEST_BODY",
          }),
        }),
        400
      );
    });

    it("应该验证服务名称", async () => {
      const request = {
        serviceName: "",
        config: { command: "node", args: ["./test.js"] },
      };

      const c = {
        req: {
          json: vi.fn().mockResolvedValue(request),
        },
        json: vi.fn(),
      } as any;

      await apiHandler.addMCPServer(c);

      expect(c.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({
            code: "INVALID_SERVICE_NAME",
          }),
        }),
        400
      );
    });

    it("应该验证服务配置", async () => {
      const request = {
        serviceName: "test-service",
        config: null,
      };

      const c = {
        req: {
          json: vi.fn().mockResolvedValue(request),
        },
        json: vi.fn(),
      } as any;

      await apiHandler.addMCPServer(c);

      expect(c.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({
            code: "INVALID_SERVICE_CONFIG",
          }),
        }),
        400
      );
    });

    it("成功添加服务", async () => {
      const request = {
        serviceName: "test-service",
        config: { command: "node", args: ["./test.js"] },
      };

      const c = {
        req: {
          json: vi.fn().mockResolvedValue(request),
        },
        json: vi.fn(),
      } as any;

      mockServiceManager.addAndStartService.mockResolvedValue(undefined);

      await apiHandler.addMCPServer(c);

      expect(mockServiceManager.addAndStartService).toHaveBeenCalledWith(
        "test-service",
        request.config
      );
      expect(c.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          message: expect.stringContaining("成功添加服务"),
        })
      );
    });
  });

  describe("POST /api/mcp-servers/remove", () => {
    it("应该验证请求体格式", async () => {
      const c = {
        req: {
          json: vi.fn().mockResolvedValue(null),
        },
        json: vi.fn(),
      } as any;

      await apiHandler.removeMCPServer(c);

      expect(c.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({
            code: "INVALID_REQUEST_BODY",
          }),
        })
      );
    });

    it("应该验证服务名称", async () => {
      const request = {
        serviceName: "",
      };

      const c = {
        req: {
          json: vi.fn().mockResolvedValue(request),
        },
        json: vi.fn(),
      } as any;

      await apiHandler.removeMCPServer(c);

      expect(c.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({
            code: "INVALID_SERVICE_NAME",
          }),
        })
      );
    });

    it("成功移除服务", async () => {
      const request = {
        serviceName: "test-service",
      };

      const c = {
        req: {
          json: vi.fn().mockResolvedValue(request),
        },
        json: vi.fn(),
      } as any;

      mockServiceManager.removeService.mockResolvedValue(undefined);

      await apiHandler.removeMCPServer(c);

      expect(mockServiceManager.removeService).toHaveBeenCalledWith(
        "test-service",
        true,
        true
      );
      expect(c.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          message: expect.stringContaining("成功移除服务"),
        })
      );
    });
  });

  describe("GET /api/mcp-servers/:serviceName/status", () => {
    it("应该处理缺少服务名称参数", async () => {
      const c = {
        req: {
          param: vi.fn().mockReturnValue(undefined),
        },
        json: vi.fn(),
      } as any;

      await apiHandler.getServiceStatus(c);

      expect(c.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({
            code: "MISSING_SERVICE_NAME",
          }),
        })
      );
    });

    it("成功获取服务状态", async () => {
      const c = {
        req: {
          param: vi.fn().mockReturnValue("test-service"),
        },
        json: vi.fn(),
      } as any;

      mockServiceManager.getServiceStatus.mockResolvedValue("running");

      await apiHandler.getServiceStatus(c);

      expect(mockServiceManager.getServiceStatus).toHaveBeenCalledWith(
        "test-service"
      );
      expect(c.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: "running",
        })
      );
    });
  });

  describe("GET /api/mcp-servers/:serviceName/tools", () => {
    it("应该处理缺少服务名称参数", async () => {
      const c = {
        req: {
          param: vi.fn().mockReturnValue(undefined),
        },
        json: vi.fn(),
      } as any;

      await apiHandler.getServiceTools(c);

      expect(c.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({
            code: "MISSING_SERVICE_NAME",
          }),
        })
      );
    });

    it("成功获取服务工具", async () => {
      const c = {
        req: {
          param: vi.fn().mockReturnValue("test-service"),
        },
        json: vi.fn(),
      } as any;

      const mockTools = [
        { name: "tool1", description: "Test tool 1" },
        { name: "tool2", description: "Test tool 2" },
      ];

      mockServiceManager.getServiceTools.mockResolvedValue(mockTools);

      await apiHandler.getServiceTools(c);

      expect(mockServiceManager.getServiceTools).toHaveBeenCalledWith(
        "test-service"
      );
      expect(c.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            serviceName: "test-service",
            tools: mockTools,
            count: 2,
          }),
        })
      );
    });
  });

  describe("PUT /api/mcp-servers/:serviceName/config", () => {
    it("应该处理缺少服务名称参数", async () => {
      const c = {
        req: {
          param: vi.fn().mockReturnValue(undefined),
        },
        json: vi.fn().mockResolvedValue({ command: "node" }),
      } as any;

      await apiHandler.updateServiceConfig(c);

      expect(c.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({
            code: "MISSING_SERVICE_NAME",
          }),
        })
      );
    });

    it("应该验证请求体格式", async () => {
      const c = {
        req: {
          param: vi.fn().mockReturnValue("test-service"),
        },
        json: vi.fn().mockResolvedValue(null),
      } as any;

      await apiHandler.updateServiceConfig(c);

      expect(c.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({
            code: "INVALID_REQUEST_BODY",
          }),
        })
      );
    });

    it("成功更新服务配置", async () => {
      const newConfig = { command: "node", args: ["./new.js"] };

      const c = {
        req: {
          param: vi.fn().mockReturnValue("test-service"),
          json: vi.fn().mockResolvedValue(newConfig),
        },
        json: vi.fn(),
      } as any;

      mockServiceManager.updateServiceConfig.mockResolvedValue(undefined);

      await apiHandler.updateServiceConfig(c);

      expect(mockServiceManager.updateServiceConfig).toHaveBeenCalledWith(
        "test-service",
        newConfig
      );
      expect(c.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          message: expect.stringContaining("成功更新服务配置"),
        })
      );
    });
  });

  describe("POST /api/mcp-servers/test-connection", () => {
    it("应该验证请求体格式", async () => {
      const c = {
        req: {
          json: vi.fn().mockResolvedValue(null),
        },
        json: vi.fn(),
      } as any;

      await apiHandler.testConnection(c);

      expect(c.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({
            code: "INVALID_REQUEST_BODY",
          }),
        })
      );
    });

    it("成功测试连接", async () => {
      const request = {
        serviceName: "test-service",
        config: { command: "node", args: ["./test.js"] },
      };

      const c = {
        req: {
          json: vi.fn().mockResolvedValue(request),
        },
        json: vi.fn(),
      } as any;

      mockServiceManager.testServiceConnection.mockResolvedValue(true);

      await apiHandler.testConnection(c);

      expect(mockServiceManager.testServiceConnection).toHaveBeenCalledWith(
        request.config
      );
      expect(c.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          message: expect.stringContaining("连接测试成功"),
        })
      );
    });
  });
});

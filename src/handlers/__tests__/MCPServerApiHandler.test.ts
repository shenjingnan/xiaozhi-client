import type { Context } from "hono";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ConfigManager } from "../../configManager.js";
import type { MCPServerConfig } from "../../configManager.js";
import { MCPErrorCode } from "../../errors/MCPErrors.js";
import type { EventBus } from "../../services/EventBus.js";
import { getEventBus } from "../../services/EventBus.js";
import type { MCPServiceManager } from "../../services/MCPServiceManager.js";
import {
  MCPServerApiHandler,
  MCPServerConfigValidator,
} from "../MCPServerApiHandler.js";

// 创建模拟对象
const createMockConfigManager = (): Partial<ConfigManager> => ({
  getConfig: vi.fn().mockReturnValue({
    mcpServers: {
      existingService: {
        command: "node",
        args: ["server.js"],
      },
    },
  }),
  updateMcpServer: vi.fn(),
  removeMcpServer: vi.fn(),
});

const createMockMCPServiceManager = (): Partial<MCPServiceManager> => ({
  addServiceConfig: vi.fn(),
  startService: vi.fn(),
  stopService: vi.fn(),
  removeServiceConfig: vi.fn(),
  // MCPServiceManager 的其他模拟方法将在后续里程碑中添加
});

const createMockEventBus = (): Partial<EventBus> => ({
  emitEvent: vi.fn(),
});

describe("MCPServerApiHandler", () => {
  let handler: MCPServerApiHandler;
  let mockConfigManager: Partial<ConfigManager>;
  let mockMCPServiceManager: Partial<MCPServiceManager>;
  let mockEventBus: Partial<EventBus>;

  beforeEach(() => {
    // 重置所有模拟对象
    vi.clearAllMocks();

    mockConfigManager = createMockConfigManager();
    mockMCPServiceManager = createMockMCPServiceManager();
    mockEventBus = createMockEventBus();

    // 创建处理器实例
    handler = new MCPServerApiHandler(
      mockMCPServiceManager as MCPServiceManager,
      mockConfigManager as ConfigManager
    );
  });

  describe("构造函数和依赖注入", () => {
    it("应该正确创建处理器实例", () => {
      expect(handler).toBeInstanceOf(MCPServerApiHandler);
      expect(handler).toBeDefined();
    });

    it("应该正确注入依赖", () => {
      // 通过测试处理器创建成功间接验证依赖注入成功
      expect(handler).toBeDefined();
      expect(handler).toBeInstanceOf(MCPServerApiHandler);
    });
  });

  describe("响应格式化方法", () => {
    // 注意：由于响应格式化方法是 protected 的，我们不直接测试它们
    // 它们会在实际的 API 方法中被间接测试
    it("应该定义所有必需的 API 方法", () => {
      expect(handler.addMCPServer).toBeDefined();
      expect(handler.removeMCPServer).toBeDefined();
      expect(handler.getMCPServerStatus).toBeDefined();
      expect(handler.listMCPServers).toBeDefined();

      // 验证这些方法都是函数
      expect(typeof handler.addMCPServer).toBe("function");
      expect(typeof handler.removeMCPServer).toBe("function");
      expect(typeof handler.getMCPServerStatus).toBe("function");
      expect(typeof handler.listMCPServers).toBe("function");
    });
  });

  describe("错误处理机制", () => {
    it("应该返回正确的错误代码格式", () => {
      expect(MCPErrorCode.SERVER_ALREADY_EXISTS).toBe("SERVER_ALREADY_EXISTS");
      expect(MCPErrorCode.SERVER_NOT_FOUND).toBe("SERVER_NOT_FOUND");
      expect(MCPErrorCode.INVALID_CONFIG).toBe("INVALID_CONFIG");
      expect(MCPErrorCode.CONNECTION_FAILED).toBe("CONNECTION_FAILED");
      expect(MCPErrorCode.INTERNAL_ERROR).toBe("INTERNAL_ERROR");
    });

    it("应该包含所有必要的错误代码", () => {
      const expectedCodes = [
        "SERVER_ALREADY_EXISTS",
        "SERVER_NOT_FOUND",
        "INVALID_CONFIG",
        "INVALID_SERVICE_NAME",
        "CONNECTION_FAILED",
        "CONNECTION_TIMEOUT",
        "SERVICE_UNAVAILABLE",
        "OPERATION_FAILED",
        "REMOVE_FAILED",
        "SYNC_FAILED",
        "INTERNAL_ERROR",
        "CONFIG_UPDATE_FAILED",
      ];

      for (const code of expectedCodes) {
        expect(Object.values(MCPErrorCode)).toContain(code);
      }
    });
  });
});

describe("addMCPServer", () => {
  let handler: MCPServerApiHandler;
  let mockConfigManager: Partial<ConfigManager>;
  let mockMCPServiceManager: Partial<MCPServiceManager>;
  let mockEventBus: Partial<EventBus>;
  let mockContext: Partial<Context>;

  beforeEach(() => {
    vi.clearAllMocks();

    mockConfigManager = createMockConfigManager();
    mockMCPServiceManager = createMockMCPServiceManager();
    mockEventBus = createMockEventBus();

    // mockConfigManager 和 mockMCPServiceManager 已经在 createMock 函数中配置了

    handler = new MCPServerApiHandler(
      mockMCPServiceManager as MCPServiceManager,
      mockConfigManager as ConfigManager
    );

    // 创建模拟 Context - 修复 mock 配置，返回真实的 Response 对象
    mockContext = {
      json: vi.fn().mockImplementation((data: any, status?: number) => {
        return new Response(JSON.stringify(data), {
          status: status || 200,
          headers: { "Content-Type": "application/json" },
        });
      }),
      req: {
        json: vi.fn(),
      },
      // 添加 HonoRequest 的必需属性
      raw: new Request("http://localhost"),
      routeIndex: 0,
      path: "",
      bodyCache: new Map(),
      // 确保所有必需属性都有值
      param: vi.fn(),
      query: vi.fn(),
      header: vi.fn(),
      headerValues: vi.fn(),
    } as any;
  });

  it("应该成功添加新的 MCP 服务", async () => {
    const requestData = {
      name: "new-service",
      config: {
        command: "node",
        args: ["server.js"],
      },
    };

    (mockContext.req as any).json = vi.fn().mockResolvedValue(requestData);

    // 模拟成功的服务启动
    const mockService = {
      isConnected: vi.fn().mockReturnValue(true),
      getTools: vi.fn().mockReturnValue([{ name: "tool1" }, { name: "tool2" }]),
    };
    (mockMCPServiceManager as any).services = new Map([
      ["new-service", mockService],
    ]);

    // 修复 mock 配置 - 确保初始配置不包含新服务，但 updateMcpServer 后包含
    const currentConfig = {
      mcpServers: {
        existingService: {
          command: "node",
          args: ["server.js"],
        },
      },
    };

    mockConfigManager.getConfig = vi.fn().mockReturnValue(currentConfig);
    mockConfigManager.updateMcpServer = vi
      .fn()
      .mockImplementation((name: string, config: MCPServerConfig) => {
        (currentConfig.mcpServers as Record<string, MCPServerConfig>)[name] =
          config;
      });

    const response = await handler.addMCPServer(mockContext as Context);

    // 验证调用
    expect(mockConfigManager.updateMcpServer).toHaveBeenCalledWith(
      "new-service",
      requestData.config
    );
    expect(mockMCPServiceManager.addServiceConfig).toHaveBeenCalledWith({
      name: "new-service",
      type: "stdio",
      command: "node",
      args: ["server.js"],
      env: {},
    });
    expect(mockMCPServiceManager.startService).toHaveBeenCalledWith(
      "new-service"
    );

    // 验证响应
    expect(response.status).toBe(201);
    const responseData = await response.json();
    expect(responseData.success).toBe(true);
    expect(responseData.data.name).toBe("new-service");
    expect(responseData.data.status).toBe("connected");
    expect(responseData.data.tools).toEqual(["tool1", "tool2"]);
  });

  it("应该拒绝无效的服务名称", async () => {
    const requestData = {
      name: "invalid@name",
      config: {
        command: "node",
        args: ["server.js"],
      },
    };

    (mockContext.req as any).json = vi.fn().mockResolvedValue(requestData);

    const response = await handler.addMCPServer(mockContext as Context);

    expect(response.status).toBe(400);
    const responseData = await response.json();
    expect(responseData.error.code).toBe("INVALID_SERVICE_NAME");
    expect(responseData.error.message).toContain(
      "服务名称只能包含字母、数字、下划线和连字符"
    );
  });

  it("应该拒绝重复的服务名称", async () => {
    const requestData = {
      name: "existingService",
      config: {
        command: "node",
        args: ["server.js"],
      },
    };

    (mockContext.req as any).json = vi.fn().mockResolvedValue(requestData);

    const response = await handler.addMCPServer(mockContext as Context);

    expect(response.status).toBe(409);
    const responseData = await response.json();
    expect(responseData.error.code).toBe("SERVER_ALREADY_EXISTS");
    expect(responseData.error.message).toBe("MCP 服务已存在");
  });

  it("应该拒绝无效的服务配置", async () => {
    const requestData = {
      name: "new-service",
      config: {
        command: "",
        args: ["server.js"],
      },
    };

    (mockContext.req as any).json = vi.fn().mockResolvedValue(requestData);

    const response = await handler.addMCPServer(mockContext as Context);

    expect(response.status).toBe(400);
    const responseData = await response.json();
    expect(responseData.error.code).toBe("INVALID_CONFIG");
    expect(responseData.error.message).toBe("本地服务必须提供有效的命令");
  });

  it("应该处理服务启动失败的情况", async () => {
    const requestData = {
      name: "failing-service",
      config: {
        command: "node",
        args: ["server.js"],
      },
    };

    (mockContext.req as any).json = vi.fn().mockResolvedValue(requestData);
    mockMCPServiceManager.startService = vi
      .fn()
      .mockRejectedValue(new Error("服务连接失败"));

    const response = await handler.addMCPServer(mockContext as Context);

    expect(response.status).toBe(500);
    const responseData = await response.json();
    expect(responseData.error.code).toBe("CONNECTION_FAILED");
    expect(responseData.error.message).toContain("服务连接失败");
  });

  it("应该处理配置更新失败的情况", async () => {
    const requestData = {
      name: "config-fail-service",
      config: {
        command: "node",
        args: ["server.js"],
      },
    };

    (mockContext.req as any).json = vi.fn().mockResolvedValue(requestData);
    mockConfigManager.updateMcpServer = vi.fn().mockImplementation(() => {
      throw new Error("服务配置验证失败");
    });

    const response = await handler.addMCPServer(mockContext as Context);

    expect(response.status).toBe(400);
    const responseData = await response.json();
    expect(responseData.error.code).toBe("INVALID_CONFIG");
    expect(responseData.error.message).toBe("服务配置验证失败");
  });

  it("应该处理未连接的服务状态", async () => {
    const requestData = {
      name: "disconnected-service",
      config: {
        command: "node",
        args: ["server.js"],
      },
    };

    (mockContext.req as any).json = vi.fn().mockResolvedValue(requestData);

    // 模拟服务但未连接
    const mockService = {
      isConnected: vi.fn().mockReturnValue(false),
      getTools: vi.fn().mockReturnValue([]),
    };
    (mockMCPServiceManager as any).services = new Map([
      ["disconnected-service", mockService],
    ]);

    const response = await handler.addMCPServer(mockContext as Context);

    expect(response.status).toBe(201);
    const responseData = await response.json();
    expect(responseData.data.status).toBe("disconnected");
    expect(responseData.data.connected).toBe(false);
    expect(responseData.data.tools).toEqual([]);
  });
});

describe("removeMCPServer", () => {
  let handler: MCPServerApiHandler;
  let mockConfigManager: Partial<ConfigManager>;
  let mockMCPServiceManager: Partial<MCPServiceManager>;
  let mockEventBus: Partial<EventBus>;
  let mockContext: Partial<Context>;

  beforeEach(() => {
    vi.clearAllMocks();

    mockConfigManager = createMockConfigManager();
    mockMCPServiceManager = createMockMCPServiceManager();
    mockEventBus = createMockEventBus();

    handler = new MCPServerApiHandler(
      mockMCPServiceManager as MCPServiceManager,
      mockConfigManager as ConfigManager
    );

    // 创建模拟 Context
    mockContext = {
      json: vi.fn().mockImplementation((data: any, status?: number) => {
        return new Response(JSON.stringify(data), {
          status: status || 200,
          headers: { "Content-Type": "application/json" },
        });
      }),
      param: vi.fn(),
      req: {
        param: vi.fn(),
      },
      raw: new Request("http://localhost"),
      routeIndex: 0,
      path: "",
      bodyCache: new Map(),
      query: vi.fn(),
      header: vi.fn(),
      headerValues: vi.fn(),
    } as any;
  });

  it("应该成功移除存在的 MCP 服务", async () => {
    const serverName = "existingService";
    (mockContext as any).req = { param: vi.fn().mockReturnValue(serverName) };

    // 模拟服务存在且有工具
    const mockService = {
      isConnected: vi.fn().mockReturnValue(true),
      getTools: vi.fn().mockReturnValue([{ name: "tool1" }, { name: "tool2" }]),
    };
    (mockMCPServiceManager as any).services = new Map([
      [serverName, mockService],
    ]);

    const response = await handler.removeMCPServer(mockContext as Context);

    // 验证调用
    expect(mockMCPServiceManager.stopService).toHaveBeenCalledWith(serverName);
    expect(mockMCPServiceManager.removeServiceConfig).toHaveBeenCalledWith(
      serverName
    );
    expect(mockConfigManager.removeMcpServer).toHaveBeenCalledWith(serverName);

    // 验证响应
    expect(response.status).toBe(200);
    const responseData = await response.json();
    expect(responseData.success).toBe(true);
    expect(responseData.data.name).toBe(serverName);
    expect(responseData.data.operation).toBe("removed");
    expect(responseData.data.affectedTools).toEqual(["tool1", "tool2"]);
  });

  it("应该拒绝无效的服务名称", async () => {
    const invalidServerName = "invalid@name";
    (mockContext as any).req = {
      param: vi.fn().mockReturnValue(invalidServerName),
    };

    const response = await handler.removeMCPServer(mockContext as Context);

    expect(response.status).toBe(400);
    const responseData = await response.json();
    expect(responseData.error.code).toBe("INVALID_SERVICE_NAME");
    expect(responseData.error.message).toContain(
      "服务名称只能包含字母、数字、下划线和连字符"
    );
  });

  it("应该拒绝移除不存在的服务", async () => {
    const nonExistentServer = "nonExistentService";
    (mockContext as any).req = {
      param: vi.fn().mockReturnValue(nonExistentServer),
    };

    const response = await handler.removeMCPServer(mockContext as Context);

    expect(response.status).toBe(404);
    const responseData = await response.json();
    expect(responseData.error.code).toBe("SERVER_NOT_FOUND");
    expect(responseData.error.message).toBe("MCP 服务不存在");
  });

  it("应该处理服务停止失败的情况", async () => {
    const serverName = "failingService";
    (mockContext as any).req = { param: vi.fn().mockReturnValue(serverName) };

    // 修改 mockConfigManager 让它认为这个服务存在
    const originalGetConfig = mockConfigManager.getConfig;
    mockConfigManager.getConfig = vi.fn().mockReturnValue({
      mcpServers: {
        [serverName]: {
          command: "node",
          args: ["server.js"],
        },
      },
    });

    // 模拟服务存在且有工具
    const mockService = {
      isConnected: vi.fn().mockReturnValue(true),
      getTools: vi.fn().mockReturnValue([{ name: "tool1" }]),
    };
    (mockMCPServiceManager as any).services = new Map([
      [serverName, mockService],
    ]);

    // 模拟服务停止失败
    mockMCPServiceManager.stopService = vi
      .fn()
      .mockRejectedValue(new Error("停止服务失败"));

    const response = await handler.removeMCPServer(mockContext as Context);

    // 即使停止失败，也应该继续执行配置移除
    expect(mockMCPServiceManager.removeServiceConfig).toHaveBeenCalledWith(
      serverName
    );
    expect(mockConfigManager.removeMcpServer).toHaveBeenCalledWith(serverName);

    expect(response.status).toBe(200);
    const responseData = await response.json();
    expect(responseData.success).toBe(true);
    expect(responseData.data.name).toBe(serverName);

    // 恢复原始 mock
    mockConfigManager.getConfig = originalGetConfig;
  });

  it("应该处理配置移除失败的情况", async () => {
    const serverName = "configFailService";
    (mockContext as any).req = { param: vi.fn().mockReturnValue(serverName) };

    // 模拟服务存在
    const mockService = {
      isConnected: vi.fn().mockReturnValue(true),
      getTools: vi.fn().mockReturnValue([{ name: "tool1" }]),
    };
    (mockMCPServiceManager as any).services = new Map([
      [serverName, mockService],
    ]);

    // 修改配置管理器让它认为这个服务存在
    const originalGetConfig = mockConfigManager.getConfig;
    mockConfigManager.getConfig = vi.fn().mockReturnValue({
      mcpServers: {
        [serverName]: {
          command: "node",
          args: ["server.js"],
        },
      },
    });

    // 模拟配置移除失败
    mockConfigManager.removeMcpServer = vi.fn().mockImplementation(() => {
      throw new Error("配置更新失败");
    });

    const response = await handler.removeMCPServer(mockContext as Context);

    expect(response.status).toBe(500);
    const responseData = await response.json();
    expect(responseData.error.code).toBe("CONFIG_UPDATE_FAILED");
    expect(responseData.error.message).toBe("配置更新失败");

    // 恢复原始 getConfig
    mockConfigManager.getConfig = originalGetConfig;
  });

  it("应该正确处理断开连接的服务", async () => {
    const serverName = "disconnectedService";
    (mockContext as any).req = { param: vi.fn().mockReturnValue(serverName) };

    // 修改 mockConfigManager 让它认为这个服务存在
    const originalGetConfig = mockConfigManager.getConfig;
    mockConfigManager.getConfig = vi.fn().mockReturnValue({
      mcpServers: {
        [serverName]: {
          command: "node",
          args: ["server.js"],
        },
      },
    });

    // 模拟断开连接的服务
    const mockService = {
      isConnected: vi.fn().mockReturnValue(false),
      getTools: vi.fn().mockReturnValue([]),
    };
    (mockMCPServiceManager as any).services = new Map([
      [serverName, mockService],
    ]);

    const response = await handler.removeMCPServer(mockContext as Context);

    expect(response.status).toBe(200);
    const responseData = await response.json();
    expect(responseData.success).toBe(true);
    expect(responseData.data.name).toBe(serverName);
    expect(responseData.data.affectedTools).toEqual([]);

    // 恢复原始 mock
    mockConfigManager.getConfig = originalGetConfig;
  });

  it("应该验证路径参数获取的正确性", async () => {
    const serverName = "testService";
    (mockContext as any).req = { param: vi.fn().mockReturnValue(serverName) };

    await handler.removeMCPServer(mockContext as Context);

    // 验证正确获取了路径参数
    expect((mockContext as any).req.param).toHaveBeenCalledWith("serverName");
  });
});

describe("MCPServerConfigValidator", () => {
  describe("服务配置验证", () => {
    it("应该验证有效的本地服务配置", () => {
      const config: MCPServerConfig = {
        command: "node",
        args: ["server.js"],
        env: { NODE_ENV: "production" },
      };

      const result = MCPServerConfigValidator.validateConfig(config);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("应该拒绝无效的配置对象", () => {
      const result = MCPServerConfigValidator.validateConfig(null as any);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain("配置必须是一个对象");
    });

    it("应该验证本地服务配置的必填字段", () => {
      const config: MCPServerConfig = {
        command: "",
        args: ["server.js"],
      };

      const result = MCPServerConfigValidator.validateConfig(config);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain("本地服务必须提供有效的命令");
    });

    it("应该验证远程服务配置的 URL", () => {
      const config: MCPServerConfig = {
        url: "invalid-url",
      };

      const result = MCPServerConfigValidator.validateConfig(config);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain("URL 格式无效");
    });

    it("应该验证有效的远程服务配置", () => {
      const config: MCPServerConfig = {
        url: "https://example.com/mcp",
      };

      const result = MCPServerConfigValidator.validateConfig(config);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("应该拒绝缺少必要字段的配置", () => {
      const config = {} as MCPServerConfig;

      const result = MCPServerConfigValidator.validateConfig(config);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain("配置必须包含 command 或 url 字段");
    });
  });

  describe("服务名称验证", () => {
    it("应该验证有效的服务名称", () => {
      const result =
        MCPServerConfigValidator.validateServiceName("test-service");
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("应该拒绝空的服务名称", () => {
      const result = MCPServerConfigValidator.validateServiceName("");
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain("服务名称必须是非空字符串");
    });

    it("应该拒绝过长的服务名称", () => {
      const longName = "a".repeat(51);
      const result = MCPServerConfigValidator.validateServiceName(longName);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain("服务名称长度必须在 1-50 个字符之间");
    });

    it("应该拒绝包含非法字符的服务名称", () => {
      const result =
        MCPServerConfigValidator.validateServiceName("test@service");
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(
        "服务名称只能包含字母、数字、下划线和连字符"
      );
    });

    it("应该接受包含合法字符的服务名称", () => {
      const validNames = [
        "test_service",
        "test-service",
        "test123",
        "Test_Service",
      ];
      for (const name of validNames) {
        const result = MCPServerConfigValidator.validateServiceName(name);
        expect(result.isValid).toBe(true);
        expect(result.errors).toHaveLength(0);
      }
    });
  });

  describe("服务存在性检查", () => {
    let mockConfigManager: Partial<ConfigManager>;

    beforeEach(() => {
      mockConfigManager = createMockConfigManager();
    });

    it("应该正确检测存在的服务", () => {
      const exists = MCPServerConfigValidator.checkServiceExists(
        "existingService",
        mockConfigManager as ConfigManager
      );
      expect(exists).toBe(true);
    });

    it("应该正确检测不存在的服务", () => {
      const exists = MCPServerConfigValidator.checkServiceExists(
        "nonExistentService",
        mockConfigManager as ConfigManager
      );
      expect(exists).toBe(false);
    });
  });
});

// 测试 getMCPServerStatus 方法
describe("getMCPServerStatus", () => {
  let handler: MCPServerApiHandler;
  let mockMCPServiceManager: Partial<MCPServiceManager>;
  let mockConfigManager: Partial<ConfigManager>;
  let mockContext: Partial<Context>;

  beforeEach(() => {
    mockMCPServiceManager = createMockMCPServiceManager();
    mockConfigManager = createMockConfigManager();
    handler = new MCPServerApiHandler(
      mockMCPServiceManager as MCPServiceManager,
      mockConfigManager as ConfigManager
    );

    // 设置模拟的 Context
    mockContext = {
      req: {
        param: vi.fn(),
        // 添加 HonoRequest 所需的其他属性
        raw: undefined,
        routeIndex: 0,
        path: "",
        bodyCache: undefined,
        header: vi.fn(),
        query: vi.fn(),
        queryParam: vi.fn(),
        paramData: {},
      } as any,
      json: vi.fn().mockImplementation((data, status) => ({
        status: status || 200,
        json: async () => data,
      })),
    };
  });

  it("应该成功获取已连接服务的状态", async () => {
    const serverName = "existingService";
    (mockContext as any).req = { param: vi.fn().mockReturnValue(serverName) };

    // 模拟已连接的服务
    const mockService = {
      isConnected: vi.fn().mockReturnValue(true),
      getTools: vi.fn().mockReturnValue([{ name: "tool1" }, { name: "tool2" }]),
    };
    (mockMCPServiceManager as any).services = new Map([
      [serverName, mockService],
    ]);

    const response = await handler.getMCPServerStatus(mockContext as Context);

    expect(response.status).toBe(200);
    const responseData = await response.json();
    expect(responseData.success).toBe(true);
    expect(responseData.data.name).toBe(serverName);
    expect(responseData.data.status).toBe("connected");
    expect(responseData.data.connected).toBe(true);
    expect(responseData.data.tools).toEqual(["tool1", "tool2"]);
  });

  it("应该获取未连接服务的状态", async () => {
    const serverName = "existingService";
    (mockContext as any).req = { param: vi.fn().mockReturnValue(serverName) };

    // 模拟未连接的服务
    const mockService = {
      isConnected: vi.fn().mockReturnValue(false),
      getTools: vi.fn().mockReturnValue([]),
    };
    (mockMCPServiceManager as any).services = new Map([
      [serverName, mockService],
    ]);

    const response = await handler.getMCPServerStatus(mockContext as Context);

    expect(response.status).toBe(200);
    const responseData = await response.json();
    expect(responseData.success).toBe(true);
    expect(responseData.data.name).toBe(serverName);
    expect(responseData.data.status).toBe("disconnected");
    expect(responseData.data.connected).toBe(false);
    expect(responseData.data.tools).toEqual([]);
  });

  it("应该处理无效的服务名称", async () => {
    const invalidServerName = "invalid@name";
    (mockContext as any).req = {
      param: vi.fn().mockReturnValue(invalidServerName),
    };

    const response = await handler.getMCPServerStatus(mockContext as Context);

    expect(response.status).toBe(400);
    const responseData = await response.json();
    expect(responseData.error).toBeDefined();
    expect(responseData.error.code).toBe(MCPErrorCode.INVALID_SERVICE_NAME);
  });

  it("应该处理不存在的服务", async () => {
    const nonExistentServer = "nonExistentService";
    (mockContext as any).req = {
      param: vi.fn().mockReturnValue(nonExistentServer),
    };

    const response = await handler.getMCPServerStatus(mockContext as Context);

    expect(response.status).toBe(404);
    const responseData = await response.json();
    expect(responseData.error).toBeDefined();
    expect(responseData.error.code).toBe(MCPErrorCode.SERVER_NOT_FOUND);
  });
});

// 测试 listMCPServers 方法
describe("listMCPServers", () => {
  let handler: MCPServerApiHandler;
  let mockMCPServiceManager: Partial<MCPServiceManager>;
  let mockConfigManager: Partial<ConfigManager>;
  let mockContext: Partial<Context>;

  beforeEach(() => {
    mockMCPServiceManager = createMockMCPServiceManager();
    mockConfigManager = createMockConfigManager();
    handler = new MCPServerApiHandler(
      mockMCPServiceManager as MCPServiceManager,
      mockConfigManager as ConfigManager
    );

    // 设置模拟的 Context
    mockContext = {
      json: vi.fn().mockImplementation((data, status) => ({
        status: status || 200,
        json: async () => data,
      })),
    };
  });

  it("应该成功列出所有服务", async () => {
    // 模拟多个服务配置
    (mockConfigManager as any).getConfig = vi.fn().mockReturnValue({
      mcpServers: {
        service1: { command: "node", args: ["server1.js"] },
        service2: { url: "http://localhost:3001" },
        service3: { command: "python", args: ["server3.py"] },
      },
    });

    // 模拟服务状态
    const mockService1 = {
      isConnected: vi.fn().mockReturnValue(true),
      getTools: vi.fn().mockReturnValue([{ name: "tool1" }]),
    };
    const mockService2 = {
      isConnected: vi.fn().mockReturnValue(false),
      getTools: vi.fn().mockReturnValue([]),
    };
    // service3 不在 services Map 中（未启动）
    (mockMCPServiceManager as any).services = new Map([
      ["service1", mockService1],
      ["service2", mockService2],
    ]);

    const response = await handler.listMCPServers(mockContext as Context);

    expect(response.status).toBe(200);
    const responseData = await response.json();
    expect(responseData.success).toBe(true);
    expect(responseData.data.total).toBe(3);
    expect(responseData.data.servers).toHaveLength(3);

    // 验证服务1状态
    const service1Status = responseData.data.servers.find(
      (s: any) => s.name === "service1"
    );
    expect(service1Status.status).toBe("connected");
    expect(service1Status.connected).toBe(true);
    expect(service1Status.tools).toEqual(["tool1"]);

    // 验证服务2状态
    const service2Status = responseData.data.servers.find(
      (s: any) => s.name === "service2"
    );
    expect(service2Status.status).toBe("disconnected");
    expect(service2Status.connected).toBe(false);
    expect(service2Status.tools).toEqual([]);

    // 验证服务3状态（未启动）
    const service3Status = responseData.data.servers.find(
      (s: any) => s.name === "service3"
    );
    expect(service3Status.status).toBe("disconnected");
    expect(service3Status.connected).toBe(false);
    expect(service3Status.tools).toEqual([]);
  });

  it("应该处理空的mcpServers配置", async () => {
    // 模拟空的 mcpServers 配置
    (mockConfigManager as any).getConfig = vi.fn().mockReturnValue({
      mcpServers: {},
    });

    const response = await handler.listMCPServers(mockContext as Context);

    expect(response.status).toBe(200);
    const responseData = await response.json();
    expect(responseData.success).toBe(true);
    expect(responseData.data.total).toBe(0);
    expect(responseData.data.servers).toHaveLength(0);
  });

  it("应该处理mcpServers配置不存在的情况", async () => {
    // 模拟 mcpServers 配置不存在
    (mockConfigManager as any).getConfig = vi.fn().mockReturnValue({});

    const response = await handler.listMCPServers(mockContext as Context);

    expect(response.status).toBe(200);
    const responseData = await response.json();
    expect(responseData.success).toBe(true);
    expect(responseData.data.total).toBe(0);
    expect(responseData.data.servers).toHaveLength(0);
  });

  it("应该处理配置读取错误", async () => {
    // 模拟配置读取错误
    (mockConfigManager as any).getConfig = vi.fn().mockImplementation(() => {
      throw new Error("配置读取失败");
    });

    const response = await handler.listMCPServers(mockContext as Context);

    expect(response.status).toBe(500);
    const responseData = await response.json();
    expect(responseData.error).toBeDefined();
    expect(responseData.error.code).toBe(MCPErrorCode.INTERNAL_ERROR);
  });
});

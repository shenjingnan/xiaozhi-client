import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  MCPService,
  type MCPServiceConfig,
  MCPTransportType,
} from "../MCPService.js";
import { MCPServiceManager } from "../MCPServiceManager.js";

// 模拟依赖项
vi.mock("../MCPService.js");
vi.mock("../../Logger.js", () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
    withTag: vi.fn().mockReturnThis(),
  },
}));
vi.mock("../../configManager.js", () => ({
  configManager: {
    getMcpServerConfig: vi.fn(),
    updateServerToolsConfig: vi.fn(),
    isToolEnabled: vi.fn(),
    getCustomMCPConfig: vi.fn(),
    getCustomMCPTools: vi.fn(),
    addCustomMCPTools: vi.fn(),
    updateCustomMCPTools: vi.fn(),
    getToolCallLogConfig: vi.fn(),
    getConfigDir: vi.fn(),
    updateToolUsageStatsWithLock: vi.fn(),
    updateMCPServerToolStatsWithLock: vi.fn(),
    clearAllStatsUpdateLocks: vi.fn(),
    getStatsUpdateLocks: vi.fn(),
    getModelScopeApiKey: vi.fn(),
  },
}));

describe("MCPServiceManager", () => {
  let manager: MCPServiceManager;
  let mockLogger: any;
  let mockMCPService: any;
  let mockConfigManager: any;
  let originalEnv: string | undefined;

  beforeEach(async () => {
    // 设置测试环境变量，防止在项目根目录创建缓存文件
    originalEnv = process.env.XIAOZHI_CONFIG_DIR;
    process.env.XIAOZHI_CONFIG_DIR = "/tmp/xiaozhi-test-mcp-service-manager";

    vi.clearAllMocks();

    // 获取模拟的 logger 实例
    const { logger } = await import("../../Logger.js");
    mockLogger = logger;

    // 获取模拟的 configManager 实例
    const { configManager } = await import("../../configManager.js");
    mockConfigManager = configManager;

    // 设置 configManager 的默认行为
    mockConfigManager.getMcpServerConfig.mockReturnValue({});
    mockConfigManager.updateServerToolsConfig.mockImplementation(() => {});
    mockConfigManager.isToolEnabled.mockReturnValue(true); // 默认所有工具都启用
    mockConfigManager.getCustomMCPConfig.mockReturnValue(null); // 默认没有 customMCP 配置
    mockConfigManager.getCustomMCPTools.mockReturnValue([]); // 默认没有 customMCP 工具
    mockConfigManager.addCustomMCPTools.mockResolvedValue(undefined); // 添加工具成功
    mockConfigManager.updateCustomMCPTools.mockResolvedValue(undefined); // 更新工具成功
    mockConfigManager.getToolCallLogConfig.mockReturnValue({}); // 默认工具调用日志配置
    mockConfigManager.getConfigDir.mockReturnValue("/tmp/test"); // 默认配置目录
    mockConfigManager.updateToolUsageStatsWithLock.mockResolvedValue(undefined); // 统计更新成功
    mockConfigManager.updateMCPServerToolStatsWithLock.mockResolvedValue(
      undefined
    ); // MCP服务统计更新成功
    mockConfigManager.clearAllStatsUpdateLocks.mockImplementation(() => {}); // 清理锁
    mockConfigManager.getStatsUpdateLocks.mockReturnValue([]); // 无活跃锁
    mockConfigManager.getModelScopeApiKey.mockReturnValue(null); // 无 ModelScope API Key

    // 模拟 MCPService
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
    // 恢复环境变量
    if (originalEnv !== undefined) {
      process.env.XIAOZHI_CONFIG_DIR = originalEnv;
    } else {
      process.env.XIAOZHI_CONFIG_DIR = undefined;
    }

    vi.clearAllMocks();
  });

  describe("构造函数", () => {
    it("应该创建默认空配置的 MCPServiceManager", () => {
      const emptyManager = new MCPServiceManager();
      expect(emptyManager).toBeInstanceOf(MCPServiceManager);
      // 不再使用 withTag，直接使用 logger
    });

    it("应该创建带自定义配置的 MCPServiceManager", () => {
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

  describe("启动所有服务", () => {
    it("当没有配置服务时应该发出警告", async () => {
      const emptyManager = new MCPServiceManager();

      await emptyManager.startAllServices();

      expect(mockLogger.debug).toHaveBeenCalledWith(
        "[MCPManager] 正在启动所有 MCP 服务..."
      );
      expect(mockLogger.warn).toHaveBeenCalledWith(
        "[MCPManager] 没有配置任何 MCP 服务，请使用 addServiceConfig() 添加服务配置"
      );
      expect(MCPService).not.toHaveBeenCalled();
    });

    it("应该启动所有已配置的服务", async () => {
      mockMCPService.connect.mockResolvedValue(undefined);
      mockMCPService.getTools.mockReturnValue([]);

      await manager.startAllServices();

      expect(MCPService).toHaveBeenCalledTimes(2); // calculator 和 datetime
    });

    it("应该处理服务启动失败的情况", async () => {
      const error = new Error("Service start failed");
      mockMCPService.connect.mockRejectedValue(error);

      await expect(manager.startAllServices()).rejects.toThrow(
        "Service start failed"
      );
    });
  });

  describe("启动单个服务", () => {
    it("应该成功启动单个服务", async () => {
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
      expect(mockLogger.debug).toHaveBeenCalledWith(
        "[MCPManager] 启动 MCP 服务: calculator"
      );
    });

    it("对于不存在的服务应该抛出错误", async () => {
      await expect(manager.startService("non-existent")).rejects.toThrow(
        "未找到服务配置: non-existent"
      );
    });

    it("启动新服务前应该先停止已存在的服务", async () => {
      mockMCPService.connect.mockResolvedValue(undefined);
      mockMCPService.disconnect.mockResolvedValue(undefined);
      mockMCPService.getTools.mockReturnValue([]);

      // 第一次启动服务
      await manager.startService("calculator");

      // 第二次启动服务（应该先停止第一个）
      await manager.startService("calculator");

      expect(mockMCPService.disconnect).toHaveBeenCalled();
      expect(MCPService).toHaveBeenCalledTimes(2);
    });
  });

  describe("停止服务", () => {
    it("应该停止正在运行的服务", async () => {
      mockMCPService.connect.mockResolvedValue(undefined);
      mockMCPService.disconnect.mockResolvedValue(undefined);
      mockMCPService.getTools.mockReturnValue([]);

      // 先启动服务
      await manager.startService("calculator");

      // 然后停止它
      await manager.stopService("calculator");

      expect(mockMCPService.disconnect).toHaveBeenCalled();
      expect(mockLogger.info).toHaveBeenCalledWith(
        "[MCPManager] calculator 服务已停止"
      );
    });

    it("应该处理停止不存在服务的情况", async () => {
      await manager.stopService("non-existent");

      expect(mockLogger.warn).toHaveBeenCalledWith(
        "[MCPManager] 服务 non-existent 不存在或未启动"
      );
    });
  });

  describe("停止所有服务", () => {
    it("应该停止所有正在运行的服务", async () => {
      mockMCPService.connect.mockResolvedValue(undefined);
      mockMCPService.disconnect.mockResolvedValue(undefined);
      mockMCPService.getTools.mockReturnValue([]);

      // 先启动服务
      await manager.startService("calculator");
      await manager.startService("datetime");

      // 然后停止所有服务
      await manager.stopAllServices();

      expect(mockMCPService.disconnect).toHaveBeenCalledTimes(2);
      expect(mockLogger.info).toHaveBeenCalledWith(
        "[MCPManager] 所有 MCP 服务已停止"
      );
    });
  });

  describe("获取所有工具", () => {
    it("当没有服务运行时应该返回空数组", () => {
      const tools = manager.getAllTools();
      expect(tools).toEqual([]);
    });

    it("应该返回所有运行服务的工具", async () => {
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

  describe("调用工具", () => {
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

    it("应该成功调用工具", async () => {
      const result = await manager.callTool("calculator__add", { a: 3, b: 5 });

      expect(mockMCPService.callTool).toHaveBeenCalledWith("add", {
        a: 3,
        b: 5,
      });
      expect(result).toEqual({ content: [{ type: "text", text: "8" }] });
    });

    it("对于不存在的工具应该抛出错误", async () => {
      await expect(manager.callTool("non-existent-tool", {})).rejects.toThrow(
        "未找到工具: non-existent-tool"
      );
    });

    it("对于不可用的服务应该抛出错误", async () => {
      // 停止服务
      mockMCPService.disconnect.mockResolvedValue(undefined);
      await manager.stopService("calculator");

      await expect(manager.callTool("calculator__add", {})).rejects.toThrow(
        "未找到工具: calculator__add"
      );
    });

    it("对于未连接的服务应该抛出错误", async () => {
      mockMCPService.isConnected.mockReturnValue(false);

      await expect(manager.callTool("calculator__add", {})).rejects.toThrow(
        "服务 calculator 未连接"
      );
    });
  });

  describe("获取状态", () => {
    it("当没有服务时应该返回状态", () => {
      const status = manager.getStatus();

      expect(status).toEqual({
        services: {},
        totalTools: 0,
        availableTools: [],
      });
    });

    it("应该返回运行中服务的状态", async () => {
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

  describe("获取服务", () => {
    it("对于不存在的服务应该返回 undefined", () => {
      const service = manager.getService("non-existent");
      expect(service).toBeUndefined();
    });

    it("对于已存在的服务应该返回服务实例", async () => {
      mockMCPService.connect.mockResolvedValue(undefined);
      mockMCPService.getTools.mockReturnValue([]);

      await manager.startService("calculator");

      const service = manager.getService("calculator");
      expect(service).toBe(mockMCPService);
    });
  });

  describe("配置管理", () => {
    it("应该添加服务配置", () => {
      const config: MCPServiceConfig = {
        name: "new-service",
        type: MCPTransportType.STDIO,
        command: "node",
        args: ["new-service.js"],
      };

      manager.addServiceConfig("new-service", config);

      expect(mockLogger.debug).toHaveBeenCalledWith(
        "[MCPManager] 已添加服务配置: new-service"
      );
    });

    it("应该移除服务配置", () => {
      manager.removeServiceConfig("calculator");

      expect(mockLogger.debug).toHaveBeenCalledWith(
        "[MCPManager] 已移除服务配置: calculator"
      );
    });
  });

  describe("多协议支持", () => {
    it("应该支持 SSE 服务", async () => {
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

    it("应该支持 streamable-http 服务", async () => {
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

    it("应该处理混合协议服务", async () => {
      // 添加不同协议的服务
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

      // 启动所有服务
      await manager.startAllServices();

      // 应该启动了 4 个服务（calculator, datetime, sse-service, http-service）
      expect(MCPService).toHaveBeenCalledTimes(4);
    });

    it("应该聚合不同协议的工具", async () => {
      // 设置不同协议的服务
      manager.addServiceConfig("sse-service", {
        name: "sse-service",
        type: MCPTransportType.SSE,
        url: "https://example.com/sse",
      });

      // 为每个服务创建单独的模拟实例
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

          // 为每个服务设置不同的工具
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

  describe("工具配置同步", () => {
    it("应该将新服务工具同步到配置文件", async () => {
      // 模拟 configManager 返回空配置
      mockConfigManager.getMcpServerConfig.mockReturnValue({});

      // 模拟带有工具的服务
      mockMCPService.isConnected.mockReturnValue(true);
      mockMCPService.getTools.mockReturnValue([
        {
          name: "add",
          description: "Add two numbers",
          inputSchema: { type: "object", properties: {} },
        },
        {
          name: "subtract",
          description: "Subtract two numbers",
          inputSchema: { type: "object", properties: {} },
        },
      ]);

      await manager.startService("calculator");

      // 验证 updateServerToolsConfig 被正确参数调用
      expect(mockConfigManager.updateServerToolsConfig).toHaveBeenCalledWith(
        "calculator",
        {
          add: {
            description: "Add two numbers",
            enable: true,
          },
          subtract: {
            description: "Subtract two numbers",
            enable: true,
          },
        }
      );
    });

    it("同步时应该保留现有工具的启用状态", async () => {
      // 模拟 configManager 返回现有配置
      mockConfigManager.getMcpServerConfig.mockReturnValue({
        calculator: {
          tools: {
            add: {
              description: "Old description",
              enable: false, // 用户禁用了此工具
            },
          },
        },
      });

      // 模拟带有更新工具的服务
      mockMCPService.isConnected.mockReturnValue(true);
      mockMCPService.getTools.mockReturnValue([
        {
          name: "add",
          description: "Add two numbers (updated)",
          inputSchema: { type: "object", properties: {} },
        },
        {
          name: "multiply",
          description: "Multiply two numbers",
          inputSchema: { type: "object", properties: {} },
        },
      ]);

      await manager.startService("calculator");

      // 验证现有工具的启用状态被保留但描述被更新
      expect(mockConfigManager.updateServerToolsConfig).toHaveBeenCalledWith(
        "calculator",
        {
          add: {
            description: "Add two numbers (updated)",
            enable: false, // 应该保留用户的设置
          },
          multiply: {
            description: "Multiply two numbers",
            enable: true, // 新工具应该默认启用
          },
        }
      );
    });

    it("应该正确处理已移除的工具", async () => {
      // 模拟 configManager 返回比当前可用工具更多的配置
      mockConfigManager.getMcpServerConfig.mockReturnValue({
        calculator: {
          tools: {
            add: {
              description: "Add two numbers",
              enable: true,
            },
            subtract: {
              description: "Subtract two numbers",
              enable: false,
            },
            divide: {
              description: "Divide two numbers",
              enable: true,
            },
          },
        },
      });

      // 模拟工具较少的服务（divide 工具被移除）
      mockMCPService.isConnected.mockReturnValue(true);
      mockMCPService.getTools.mockReturnValue([
        {
          name: "add",
          description: "Add two numbers",
          inputSchema: { type: "object", properties: {} },
        },
        {
          name: "subtract",
          description: "Subtract two numbers",
          inputSchema: { type: "object", properties: {} },
        },
      ]);

      await manager.startService("calculator");

      // 验证配置中只包含现有工具
      expect(mockConfigManager.updateServerToolsConfig).toHaveBeenCalledWith(
        "calculator",
        {
          add: {
            description: "Add two numbers",
            enable: true,
          },
          subtract: {
            description: "Subtract two numbers",
            enable: false,
          },
          // divide 工具应该被移除
        }
      );
    });

    it("当没有检测到变化时不应该同步配置", async () => {
      // 模拟 configManager 返回与当前工具匹配的现有配置
      mockConfigManager.getMcpServerConfig.mockReturnValue({
        calculator: {
          tools: {
            add: {
              description: "Add two numbers",
              enable: true,
            },
          },
        },
      });

      // 模拟具有相同工具的服务
      mockMCPService.isConnected.mockReturnValue(true);
      mockMCPService.getTools.mockReturnValue([
        {
          name: "add",
          description: "Add two numbers",
          inputSchema: { type: "object", properties: {} },
        },
      ]);

      await manager.startService("calculator");

      // 验证由于没有变化，updateServerToolsConfig 没有被调用
      expect(mockConfigManager.updateServerToolsConfig).not.toHaveBeenCalled();
    });

    it("应该优雅地处理同步错误", async () => {
      // 模拟 configManager 抛出错误
      mockConfigManager.getMcpServerConfig.mockImplementation(() => {
        throw new Error("Config read error");
      });

      mockMCPService.isConnected.mockReturnValue(true);
      mockMCPService.getTools.mockReturnValue([
        {
          name: "add",
          description: "Add two numbers",
          inputSchema: { type: "object", properties: {} },
        },
      ]);

      // 不应该抛出错误，只是记录日志
      await expect(manager.startService("calculator")).resolves.not.toThrow();

      // 验证错误已被记录
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining("同步工具配置到配置文件失败"),
        expect.any(Error)
      );
    });

    it("应该检测到工具替换的变化（相同数量但不同工具）", async () => {
      // 模拟 configManager 返回现有配置
      mockConfigManager.getMcpServerConfig.mockReturnValue({
        calculator: {
          tools: {
            add: {
              description: "Add two numbers",
              enable: true,
            },
            subtract: {
              description: "Subtract two numbers",
              enable: false,
            },
          },
        },
      });

      // 模拟服务返回相同数量但不同的工具（subtract 被 multiply 替换）
      mockMCPService.isConnected.mockReturnValue(true);
      mockMCPService.getTools.mockReturnValue([
        {
          name: "add",
          description: "Add two numbers",
          inputSchema: { type: "object", properties: {} },
        },
        {
          name: "multiply",
          description: "Multiply two numbers",
          inputSchema: { type: "object", properties: {} },
        },
      ]);

      await manager.startService("calculator");

      // 验证配置被更新，因为检测到工具替换
      expect(mockConfigManager.updateServerToolsConfig).toHaveBeenCalledWith(
        "calculator",
        {
          add: {
            description: "Add two numbers",
            enable: true,
          },
          multiply: {
            description: "Multiply two numbers",
            enable: true, // 新工具应该默认启用
          },
          // subtract 工具被移除，multiply 工具被添加
        }
      );
    });

    it("应该检测到仅工具描述的变化", async () => {
      // 模拟 configManager 返回现有配置
      mockConfigManager.getMcpServerConfig.mockReturnValue({
        calculator: {
          tools: {
            add: {
              description: "Add two numbers",
              enable: true,
            },
            subtract: {
              description: "Subtract two numbers",
              enable: false,
            },
          },
        },
      });

      // 模拟服务返回相同工具但描述发生变化
      mockMCPService.isConnected.mockReturnValue(true);
      mockMCPService.getTools.mockReturnValue([
        {
          name: "add",
          description: "Add two numbers (improved)",
          inputSchema: { type: "object", properties: {} },
        },
        {
          name: "subtract",
          description: "Subtract two numbers",
          inputSchema: { type: "object", properties: {} },
        },
      ]);

      await manager.startService("calculator");

      // 验证配置被更新，因为检测到描述变化
      expect(mockConfigManager.updateServerToolsConfig).toHaveBeenCalledWith(
        "calculator",
        {
          add: {
            description: "Add two numbers (improved)",
            enable: true, // 保留原有的启用状态
          },
          subtract: {
            description: "Subtract two numbers",
            enable: false, // 保留原有的启用状态
          },
        }
      );
    });
  });

  describe("工具启用状态过滤", () => {
    beforeEach(async () => {
      // 添加测试服务配置
      manager.addServiceConfig("test-service", {
        name: "test-service",
        type: MCPTransportType.STDIO,
        command: "node",
        args: ["test-service.js"],
      });

      const mockTools = [
        {
          name: "enabled-tool",
          description: "This tool is enabled",
          inputSchema: {},
        },
        {
          name: "disabled-tool",
          description: "This tool is disabled",
          inputSchema: {},
        },
        {
          name: "default-tool",
          description: "This tool uses default state",
          inputSchema: {},
        },
      ];

      mockMCPService.connect.mockResolvedValue(undefined);
      mockMCPService.getTools.mockReturnValue(mockTools);
      mockMCPService.isConnected.mockReturnValue(true);

      await manager.startService("test-service");
    });

    it("应该只返回启用的工具", () => {
      // 设置工具启用状态：enabled-tool=true, disabled-tool=false, default-tool=true(默认)
      mockConfigManager.isToolEnabled.mockImplementation(
        (serviceName: string, toolName: string) => {
          if (toolName === "disabled-tool") return false;
          return true; // enabled-tool 和 default-tool 都返回 true
        }
      );

      const tools = manager.getAllTools();

      // 应该只返回启用的工具
      expect(tools).toHaveLength(2);
      expect(tools.map((t) => t.originalName)).toEqual(
        expect.arrayContaining(["enabled-tool", "default-tool"])
      );
      expect(tools.map((t) => t.originalName)).not.toContain("disabled-tool");
    });

    it("应该正确调用 configManager.isToolEnabled 检查每个工具", () => {
      mockConfigManager.isToolEnabled.mockReturnValue(true);

      manager.getAllTools();

      // 验证为每个工具都调用了 isToolEnabled
      expect(mockConfigManager.isToolEnabled).toHaveBeenCalledTimes(3);
      expect(mockConfigManager.isToolEnabled).toHaveBeenCalledWith(
        "test-service",
        "enabled-tool"
      );
      expect(mockConfigManager.isToolEnabled).toHaveBeenCalledWith(
        "test-service",
        "disabled-tool"
      );
      expect(mockConfigManager.isToolEnabled).toHaveBeenCalledWith(
        "test-service",
        "default-tool"
      );
    });

    it("当所有工具都被禁用时应该返回空数组", () => {
      // 所有工具都被禁用
      mockConfigManager.isToolEnabled.mockReturnValue(false);

      const tools = manager.getAllTools();

      expect(tools).toHaveLength(0);
      expect(tools).toEqual([]);
    });

    it("应该处理 configManager.isToolEnabled 抛出异常的情况", () => {
      // 模拟 isToolEnabled 抛出异常
      mockConfigManager.isToolEnabled.mockImplementation(() => {
        throw new Error("配置读取失败");
      });

      // getAllTools 应该能够处理异常，不应该崩溃
      expect(() => manager.getAllTools()).toThrow("配置读取失败");
    });

    it("应该保持工具的原始信息不变", () => {
      mockConfigManager.isToolEnabled.mockReturnValue(true);

      const tools = manager.getAllTools();

      // 验证工具信息完整性
      const enabledTool = tools.find((t) => t.originalName === "enabled-tool");
      expect(enabledTool).toBeDefined();
      expect(enabledTool?.name).toBe("test-service__enabled-tool");
      expect(enabledTool?.description).toBe("This tool is enabled");
      expect(enabledTool?.serviceName).toBe("test-service");
      expect(enabledTool?.originalName).toBe("enabled-tool");
      expect(enabledTool?.inputSchema).toEqual({});
    });
  });

  describe("多服务工具过滤", () => {
    beforeEach(async () => {
      // 添加第二个服务配置
      manager.addServiceConfig("service-a", {
        name: "service-a",
        type: MCPTransportType.STDIO,
        command: "node",
        args: ["service-a.js"],
      });

      manager.addServiceConfig("service-b", {
        name: "service-b",
        type: MCPTransportType.STDIO,
        command: "node",
        args: ["service-b.js"],
      });

      // 模拟两个服务的工具
      const mockToolsA = [
        { name: "tool-a1", description: "Tool A1", inputSchema: {} },
        { name: "tool-a2", description: "Tool A2", inputSchema: {} },
      ];

      const mockToolsB = [
        { name: "tool-b1", description: "Tool B1", inputSchema: {} },
        { name: "tool-b2", description: "Tool B2", inputSchema: {} },
      ];

      // 创建两个不同的 mock 服务实例
      const mockServiceA = {
        connect: vi.fn().mockResolvedValue(undefined),
        disconnect: vi.fn(),
        isConnected: vi.fn().mockReturnValue(true),
        getTools: vi.fn().mockReturnValue(mockToolsA),
        callTool: vi.fn(),
        getStatus: vi.fn(),
      };

      const mockServiceB = {
        connect: vi.fn().mockResolvedValue(undefined),
        disconnect: vi.fn(),
        isConnected: vi.fn().mockReturnValue(true),
        getTools: vi.fn().mockReturnValue(mockToolsB),
        callTool: vi.fn(),
        getStatus: vi.fn(),
      };

      // 根据服务名返回不同的 mock 实例
      vi.mocked(MCPService).mockImplementation((config: MCPServiceConfig) => {
        if (config.name === "service-a") return mockServiceA as any;
        if (config.name === "service-b") return mockServiceB as any;
        return mockMCPService;
      });

      await manager.startService("service-a");
      await manager.startService("service-b");
    });

    it("应该正确过滤多个服务的工具", () => {
      // 设置过滤规则：service-a 的 tool-a1 禁用，service-b 的 tool-b2 禁用
      mockConfigManager.isToolEnabled.mockImplementation(
        (serviceName: string, toolName: string) => {
          if (serviceName === "service-a" && toolName === "tool-a1")
            return false;
          if (serviceName === "service-b" && toolName === "tool-b2")
            return false;
          return true;
        }
      );

      const tools = manager.getAllTools();

      // 应该返回 3 个工具：tool-a2, tool-b1（tool-a1 和 tool-b2 被过滤）
      expect(tools).toHaveLength(2);

      const toolNames = tools.map((t) => t.originalName);
      expect(toolNames).toContain("tool-a2");
      expect(toolNames).toContain("tool-b1");
      expect(toolNames).not.toContain("tool-a1");
      expect(toolNames).not.toContain("tool-b2");
    });
  });
});

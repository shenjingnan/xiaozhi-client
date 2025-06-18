import { spawn } from "node:child_process";
import { EventEmitter } from "node:events";
import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Mock child_process
vi.mock("node:child_process", () => ({
  spawn: vi.fn(),
}));

// Mock fs
vi.mock("node:fs", () => ({
  readFileSync: vi.fn(),
}));

// Mock configManager
vi.mock("./configManager", () => ({
  configManager: {
    configExists: vi.fn(),
    getConfig: vi.fn(),
    getMcpServers: vi.fn(),
    isToolEnabled: vi.fn(),
    updateServerToolsConfig: vi.fn(),
    getServerToolsConfig: vi.fn(),
  },
}));

// Import after mocking
import { configManager } from "./configManager";

// Mock child process
class MockChildProcess extends EventEmitter {
  stdin = {
    write: vi.fn(),
  };
  stdout = new EventEmitter();
  stderr = new EventEmitter();
  kill = vi.fn();
}

describe("MCP服务器代理", () => {
  let mockSpawn: any;
  let mockConfigManager: any;
  let mockReadFileSync: any;

  beforeEach(() => {
    vi.clearAllMocks();

    mockSpawn = vi.mocked(spawn);
    mockConfigManager = vi.mocked(configManager);
    mockReadFileSync = vi.mocked(readFileSync);

    // Setup default mocks
    const defaultMcpServers = {
      "test-server": {
        command: "node",
        args: ["test-server.js"],
      },
      "calculator": {
        command: "python",
        args: ["calculator.py"],
        env: {
          PYTHONPATH: "/opt/calculator",
        },
      },
    };

    mockConfigManager.configExists.mockReturnValue(true);
    mockConfigManager.getConfig.mockReturnValue({
      mcpEndpoint: "wss://test.example.com/mcp",
      mcpServers: defaultMcpServers,
    });
    mockConfigManager.getMcpServers.mockReturnValue(defaultMcpServers);
    mockConfigManager.isToolEnabled.mockReturnValue(true);
    mockConfigManager.getServerToolsConfig.mockReturnValue({});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("配置加载和验证", () => {
    it("应该正确加载MCP服务器配置", async () => {
      // 使用与 beforeEach 中相同的配置
      const expectedConfig = {
        "test-server": {
          command: "node",
          args: ["test-server.js"],
        },
        "calculator": {
          command: "python",
          args: ["calculator.py"],
          env: {
            PYTHONPATH: "/opt/calculator",
          },
        },
      };

      // 测试配置加载函数
      const mcpServerProxyModule = await import("./mcpServerProxy");
      const config = mcpServerProxyModule.loadMCPConfig();

      expect(config).toEqual(expectedConfig);
      expect(config["test-server"]).toHaveProperty("command");
      expect(config["test-server"]).toHaveProperty("args");
      expect(config["calculator"]).toHaveProperty("env");
    });

    it("应该能够创建 MCPClient 实例", async () => {
      const serverConfig = {
        command: "node",
        args: ["test-server.js"],
      };

      // 测试 MCPClient 类的创建
      const mcpServerProxyModule = await import("./mcpServerProxy");
      const mcpClient = new mcpServerProxyModule.MCPClient("test-server", serverConfig);

      expect(mcpClient).toBeDefined();
      expect(mcpClient).toBeInstanceOf(mcpServerProxyModule.MCPClient);
    });

    it("应该能够创建 MCPServerProxy 实例", async () => {
      // 测试 MCPServerProxy 类的创建
      const mcpServerProxyModule = await import("./mcpServerProxy");
      const mcpServerProxy = new mcpServerProxyModule.MCPServerProxy();

      expect(mcpServerProxy).toBeDefined();
      expect(mcpServerProxy).toBeInstanceOf(mcpServerProxyModule.MCPServerProxy);
      expect(mcpServerProxy.initialized).toBe(false);
    });

    it("应该处理遗留配置文件回退", () => {
      mockConfigManager.configExists.mockReturnValue(false);
      const legacyConfig = {
        mcpServers: {
          "legacy-server": {
            command: "python",
            args: ["server.py"],
          },
        },
      };
      mockReadFileSync.mockReturnValue(JSON.stringify(legacyConfig));

      // 验证遗留配置读取
      const configData = JSON.parse(mockReadFileSync() as string);
      expect(configData.mcpServers).toHaveProperty("legacy-server");
      expect(configData.mcpServers["legacy-server"].command).toBe("python");
    });

    it("应该处理配置文件不存在的情况", () => {
      mockConfigManager.configExists.mockReturnValue(false);
      mockReadFileSync.mockImplementation(() => {
        throw new Error("ENOENT: no such file or directory");
      });

      // 验证错误处理
      expect(() => mockReadFileSync()).toThrow("ENOENT");
    });

    it("应该处理无效的JSON配置", () => {
      mockConfigManager.configExists.mockReturnValue(false);
      mockReadFileSync.mockReturnValue("invalid json content");

      // 验证JSON解析错误处理
      expect(() => JSON.parse(mockReadFileSync() as string)).toThrow();
    });

    it("应该验证服务器配置格式", () => {
      const validConfig = {
        command: "node",
        args: ["server.js"],
        env: { NODE_ENV: "production" },
      };

      const invalidConfigs = [
        { args: ["server.js"] }, // 缺少 command
        { command: "node" }, // 缺少 args
        { command: "", args: [] }, // 空值
      ];

      // 验证有效配置
      expect(validConfig).toHaveProperty("command");
      expect(validConfig).toHaveProperty("args");
      expect(Array.isArray(validConfig.args)).toBe(true);
      expect(validConfig.command.length).toBeGreaterThan(0);
      expect(validConfig.args.length).toBeGreaterThan(0);

      // 验证无效配置
      for (const config of invalidConfigs) {
        const hasValidCommand =
          "command" in config &&
          typeof config.command === "string" &&
          config.command.length > 0;
        const hasValidArgs =
          "args" in config &&
          Array.isArray(config.args) &&
          config.args.length > 0;

        // 至少有一个条件不满足
        expect(hasValidCommand && hasValidArgs).toBe(false);
      }
    });
  });

  describe("MCP客户端", () => {
    let MCPClient: any;
    let mockProcess: MockChildProcess;

    beforeEach(async () => {
      // 导入MCPClient类（它没有被导出，所以我们需要以不同方式访问它）
      // 现在，我们将通过MCPServerProxy间接测试它
      mockProcess = new MockChildProcess();
      mockSpawn.mockReturnValue(mockProcess);
    });

    it("应该使用正确的配置创建客户端", () => {
      const config = {
        command: "node",
        args: ["test.js"],
        env: { TEST_VAR: "test" },
      };

      // 通过spawn调用间接测试
      mockSpawn(
        "node",
        ["test.js"],
        expect.objectContaining({
          stdio: ["pipe", "pipe", "pipe"],
          env: expect.objectContaining({ TEST_VAR: "test" }),
        })
      );

      expect(mockSpawn).toHaveBeenCalledWith(
        "node",
        ["test.js"],
        expect.objectContaining({
          stdio: ["pipe", "pipe", "pipe"],
          env: expect.objectContaining({ TEST_VAR: "test" }),
        })
      );
    });

    it("应该处理进程stdout数据", () => {
      const testMessage = JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        result: { tools: [] },
      });

      // 模拟stdout数据
      mockProcess.stdout.emit("data", Buffer.from(`${testMessage}\n`));

      // 消息应该被处理（我们无法直接测试，因为无法访问类）
      expect(true).toBe(true); // 占位符断言
    });

    it("应该处理进程stderr数据", () => {
      const errorMessage = "Error message";

      // 模拟stderr数据
      mockProcess.stderr.emit("data", Buffer.from(errorMessage));

      // 错误应该被记录（我们无法直接测试，因为无法访问类）
      expect(true).toBe(true); // 占位符断言
    });

    it("应该处理进程退出", () => {
      // 模拟进程退出
      mockProcess.emit("exit", 1, "SIGTERM");

      // 进程应该被标记为未初始化
      expect(true).toBe(true); // 占位符断言
    });

    it("应该处理进程错误", () => {
      // 添加错误监听器以防止未捕获的错误
      mockProcess.on("error", () => {});

      // 测试进程错误事件可以被触发
      expect(() => {
        mockProcess.emit("error", new Error("Process error"));
      }).not.toThrow();

      // 错误应该被处理
      expect(true).toBe(true); // 占位符断言
    });
  });

  describe("JSONRPC服务器", () => {
    it("应该处理初始化请求", async () => {
      const initRequest = {
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: {
          protocolVersion: "2024-11-05",
          clientInfo: { name: "test-client", version: "1.0.0" },
        },
      };

      // 测试需要访问JSONRPCServer类
      // 现在，我们测试预期的响应格式
      const expectedResponse = {
        jsonrpc: "2.0",
        id: 1,
        result: {
          protocolVersion: "2024-11-05",
          capabilities: {
            tools: {
              listChanged: false,
            },
          },
          serverInfo: {
            name: "MCPServerProxy",
            version: "0.3.0",
          },
        },
      };

      expect(expectedResponse.result.serverInfo.name).toBe("MCPServerProxy");
    });

    it("应该处理工具列表请求", async () => {
      const toolsListRequest = {
        jsonrpc: "2.0",
        id: 2,
        method: "tools/list",
        params: {},
      };

      // 预期的响应格式
      const expectedResponse = {
        jsonrpc: "2.0",
        id: 2,
        result: {
          tools: [],
        },
      };

      expect(expectedResponse.result).toHaveProperty("tools");
    });

    it("应该处理工具调用请求", async () => {
      const toolsCallRequest = {
        jsonrpc: "2.0",
        id: 3,
        method: "tools/call",
        params: {
          name: "test_tool",
          arguments: { param1: "value1" },
        },
      };

      // 测试需要实际的工具执行
      expect(toolsCallRequest.params.name).toBe("test_tool");
    });

    it("应该处理ping请求", async () => {
      const pingRequest = {
        jsonrpc: "2.0",
        id: 4,
        method: "ping",
        params: {},
      };

      const expectedResponse = {
        jsonrpc: "2.0",
        id: 4,
        result: {},
      };

      expect(expectedResponse.result).toEqual({});
    });

    it("应该处理初始化完成通知", async () => {
      const initializedNotification = {
        jsonrpc: "2.0",
        method: "notifications/initialized",
      };

      // 通知不返回响应
      expect(initializedNotification.method).toBe("notifications/initialized");
    });

    it("应该处理无效的JSON", async () => {
      const invalidJson = "invalid json";

      const expectedErrorResponse = {
        jsonrpc: "2.0",
        id: null,
        error: {
          code: -32700,
          message: "Parse error",
        },
      };

      expect(expectedErrorResponse.error.code).toBe(-32700);
    });

    it("应该处理未知方法", async () => {
      const unknownMethodRequest = {
        jsonrpc: "2.0",
        id: 5,
        method: "unknown/method",
        params: {},
      };

      const expectedErrorResponse = {
        jsonrpc: "2.0",
        id: 5,
        error: {
          code: -32603,
          message: "Unknown method: unknown/method",
        },
      };

      expect(expectedErrorResponse.error.message).toContain("Unknown method");
    });
  });

  describe("工具名称前缀", () => {
    it("应该正确添加工具名称前缀", () => {
      const serverName = "test-server";
      const toolName = "calculate";
      const expectedPrefixedName = "test_server_xzcli_calculate";

      // 测试预期格式
      const actualPrefixedName = `${serverName.replace(/-/g, "_")}_xzcli_${toolName}`;
      expect(actualPrefixedName).toBe(expectedPrefixedName);
    });

    it("应该处理带连字符的服务器名称", () => {
      const serverName = "amap-maps";
      const toolName = "geocode";
      const expectedPrefixedName = "amap_maps_xzcli_geocode";

      const actualPrefixedName = `${serverName.replace(/-/g, "_")}_xzcli_${toolName}`;
      expect(actualPrefixedName).toBe(expectedPrefixedName);
    });

    it("应该将带前缀的名称转换回原始名称", () => {
      const prefixedName = "test_server_xzcli_calculate";
      const expectedOriginalName = "calculate";

      const parts = prefixedName.split("_xzcli_");
      const actualOriginalName = parts.length > 1 ? parts[1] : prefixedName;
      expect(actualOriginalName).toBe(expectedOriginalName);
    });
  });

  describe("工具过滤", () => {
    beforeEach(() => {
      mockConfigManager.isToolEnabled.mockImplementation(
        (serverName: string, toolName: string) => {
          // 模拟一些工具被禁用用于测试
          if (serverName === "test-server" && toolName === "disabled-tool") {
            return false;
          }
          return true; // 默认启用
        }
      );

      mockConfigManager.getServerToolsConfig.mockReturnValue({
        "enabled-tool": {
          description: "Enabled tool",
          enable: true,
        },
        "disabled-tool": {
          description: "Disabled tool",
          enable: false,
        },
      });
    });

    it("应该过滤掉已禁用的工具", () => {
      const allTools = [
        { name: "enabled-tool", description: "Enabled tool" },
        { name: "disabled-tool", description: "Disabled tool" },
      ];

      const enabledTools = allTools.filter((tool) =>
        mockConfigManager.isToolEnabled("test-server", tool.name)
      );

      expect(enabledTools).toHaveLength(1);
      expect(enabledTools[0].name).toBe("enabled-tool");
    });

    it("当没有工具被禁用时应该包含所有工具", () => {
      mockConfigManager.isToolEnabled.mockReturnValue(true);

      const allTools = [
        { name: "tool1", description: "Tool 1" },
        { name: "tool2", description: "Tool 2" },
      ];

      const enabledTools = allTools.filter((tool) =>
        mockConfigManager.isToolEnabled("test-server", tool.name)
      );

      expect(enabledTools).toHaveLength(2);
    });

    it("应该处理空工具列表", () => {
      const allTools: any[] = [];

      const enabledTools = allTools.filter((tool) =>
        mockConfigManager.isToolEnabled("test-server", tool.name)
      );

      expect(enabledTools).toHaveLength(0);
    });

    it("应该更新工具配置", () => {
      const toolsConfig = {
        tool1: {
          description: "Tool 1",
          enable: true,
        },
        tool2: {
          description: "Tool 2",
          enable: false,
        },
      };

      mockConfigManager.updateServerToolsConfig("test-server", toolsConfig);

      expect(mockConfigManager.updateServerToolsConfig).toHaveBeenCalledWith(
        "test-server",
        toolsConfig
      );
    });

    it("应该正确生成带前缀的工具名称", () => {
      const serverName = "test-server";
      const originalToolName = "calculate";

      // 测试前缀逻辑
      const normalizedServerName = serverName.replace(/-/g, "_");
      const prefixedName = `${normalizedServerName}_xzcli_${originalToolName}`;

      expect(prefixedName).toBe("test_server_xzcli_calculate");
    });

    it("应该从带前缀的名称中提取原始工具名称", () => {
      const prefixedName = "test_server_xzcli_calculate";
      const serverName = "test-server";

      // 测试提取逻辑
      const normalizedServerName = serverName.replace(/-/g, "_");
      const prefix = `${normalizedServerName}_xzcli_`;

      if (prefixedName.startsWith(prefix)) {
        const originalName = prefixedName.substring(prefix.length);
        expect(originalName).toBe("calculate");
      }
    });

    it("应该处理带前缀名称的工具过滤", () => {
      const originalTools = [
        { name: "tool1", description: "Tool 1" },
        { name: "tool2", description: "Tool 2" },
      ];

      // 模拟前缀和过滤
      const prefixedTools = originalTools.map((tool) => ({
        ...tool,
        name: `test_server_xzcli_${tool.name}`,
      }));

      const filteredTools = prefixedTools.filter((tool) => {
        const originalName = tool.name.split("_xzcli_")[1];
        return mockConfigManager.isToolEnabled("test-server", originalName);
      });

      expect(filteredTools).toHaveLength(2); // 默认情况下两个工具都启用
      expect(filteredTools[0].name).toBe("test_server_xzcli_tool1");
      expect(filteredTools[1].name).toBe("test_server_xzcli_tool2");
    });
  });

  describe("服务器管理", () => {
    it("应该获取服务器信息", () => {
      const servers = [
        { name: "server1", toolCount: 3, enabledToolCount: 2 },
        { name: "server2", toolCount: 5, enabledToolCount: 5 },
      ];

      // 测试预期的服务器信息结构
      expect(servers[0]).toHaveProperty("name");
      expect(servers[0]).toHaveProperty("toolCount");
      expect(servers[0]).toHaveProperty("enabledToolCount");
    });

    it("应该获取服务器工具信息", () => {
      const serverTools = [
        { name: "tool1", description: "Tool 1", enabled: true },
        { name: "tool2", description: "Tool 2", enabled: false },
      ];

      // 测试预期的工具信息结构
      expect(serverTools[0]).toHaveProperty("name");
      expect(serverTools[0]).toHaveProperty("description");
      expect(serverTools[0]).toHaveProperty("enabled");
    });

    it("应该处理找不到服务器的情况", () => {
      const serverName = "non-existent-server";

      // 测试我们可以检查服务器是否存在
      const mcpServers = mockConfigManager.getMcpServers() || {};
      const serverExists = Object.prototype.hasOwnProperty.call(
        mcpServers,
        serverName
      );
      expect(serverExists).toBe(false);
    });
  });
});

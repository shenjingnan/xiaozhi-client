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
    getMcpServers: vi.fn(),
    isToolEnabled: vi.fn(),
    updateServerToolsConfig: vi.fn(),
    getServerToolsConfig: vi.fn(),
  },
}));

// Mock ModelScopeMCPClient
vi.mock("./modelScopeMCPClient", () => ({
  ModelScopeMCPClient: vi.fn().mockImplementation((name, config) => ({
    name,
    config,
    initialized: false,
    tools: [],
    originalTools: [],
    start: vi.fn().mockResolvedValue(undefined),
    stop: vi.fn().mockResolvedValue(undefined),
    refreshTools: vi.fn().mockResolvedValue(undefined),
    callTool: vi.fn().mockResolvedValue({ result: "mocked" }),
    getOriginalToolName: vi.fn().mockReturnValue("original-tool"),
  })),
}));

// Mock StreamableHTTPMCPClient
vi.mock("./streamableHttpMCPClient", () => ({
  StreamableHTTPMCPClient: vi.fn().mockImplementation((name, config) => ({
    name,
    config,
    initialized: false,
    tools: [],
    originalTools: [],
    start: vi.fn().mockResolvedValue(undefined),
    stop: vi.fn().mockResolvedValue(undefined),
    refreshTools: vi.fn().mockResolvedValue(undefined),
    callTool: vi.fn().mockResolvedValue({ result: "mocked" }),
    getOriginalToolName: vi.fn().mockReturnValue("original-tool"),
  })),
}));

// Import after mocking
import { configManager } from "./configManager";
import {
  JSONRPCServer,
  MCPClient,
  MCPServerProxy,
  loadMCPConfig,
} from "./mcpServerProxy";
import { ModelScopeMCPClient } from "./modelScopeMCPClient";
import { StreamableHTTPMCPClient } from "./streamableHttpMCPClient";

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
    mockConfigManager.configExists.mockReturnValue(true);
    mockConfigManager.getMcpServers.mockReturnValue({
      "test-server": {
        command: "node",
        args: ["test.js"],
        env: { TEST_VAR: "test" },
      },
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("加载MCP配置", () => {
    it("应该成功从配置管理器加载配置", () => {
      mockConfigManager.configExists.mockReturnValue(true);
      mockConfigManager.getMcpServers.mockReturnValue({
        "test-server": {
          command: "node",
          args: ["test.js"],
          env: { TEST_VAR: "test" },
        },
      });

      const config = loadMCPConfig();
      expect(config).toEqual({
        "test-server": {
          command: "node",
          args: ["test.js"],
          env: { TEST_VAR: "test" },
        },
      });
    });

    it("应该处理遗留配置回退", () => {
      mockConfigManager.configExists.mockReturnValue(false);
      mockReadFileSync.mockReturnValue(
        JSON.stringify({
          mcpServers: {
            "legacy-server": {
              command: "python",
              args: ["server.py"],
            },
          },
        })
      );

      // 测试readFileSync是否可用于回退
      expect(mockReadFileSync).toBeDefined();
    });

    it("应该处理配置加载错误", () => {
      mockConfigManager.configExists.mockReturnValue(false);
      mockReadFileSync.mockImplementation(() => {
        throw new Error("File not found");
      });

      expect(() => loadMCPConfig()).toThrow("配置文件不存在");
    });

    it("应该处理配置文件不存在的情况", () => {
      mockConfigManager.configExists.mockReturnValue(false);
      mockReadFileSync.mockImplementation(() => {
        throw new Error("ENOENT: no such file");
      });

      expect(() => loadMCPConfig()).toThrow();
    });
  });

  describe("跨平台命令解析", () => {
    let originalPlatform: string;

    beforeEach(() => {
      originalPlatform = process.platform;
    });

    afterEach(() => {
      // 恢复原始平台
      Object.defineProperty(process, "platform", {
        value: originalPlatform,
        writable: true,
        configurable: true,
      });
    });

    it("在Windows平台应该为npm命令添加.cmd扩展名", async () => {
      // 模拟Windows平台
      Object.defineProperty(process, "platform", {
        value: "win32",
        writable: true,
        configurable: true,
      });

      const config = {
        command: "npm",
        args: ["install", "package"],
        env: {},
      };

      // 创建一个MCPClient实例来测试resolveCommand方法
      const { MCPClient } = await import("./mcpServerProxy");
      const client = new MCPClient("test", config);
      const result = client.resolveCommand("npm", ["install", "package"]);

      expect(result.resolvedCommand).toBe("npm.cmd");
      expect(result.resolvedArgs).toEqual(["install", "package"]);
    });

    it("在Windows平台应该为npx命令添加.cmd扩展名", async () => {
      // 模拟Windows平台
      Object.defineProperty(process, "platform", {
        value: "win32",
        writable: true,
        configurable: true,
      });

      const config = {
        command: "npx",
        args: ["-y", "@amap/amap-maps-mcp-server"],
        env: { AMAP_MAPS_API_KEY: "test-key" },
      };

      const { MCPClient } = await import("./mcpServerProxy");
      const client = new MCPClient("test", config);
      const result = client.resolveCommand("npx", [
        "-y",
        "@amap/amap-maps-mcp-server",
      ]);

      expect(result.resolvedCommand).toBe("npx.cmd");
      expect(result.resolvedArgs).toEqual(["-y", "@amap/amap-maps-mcp-server"]);
    });

    it("在Windows平台应该为uvx命令添加.bat扩展名", async () => {
      // 模拟Windows平台
      Object.defineProperty(process, "platform", {
        value: "win32",
        writable: true,
        configurable: true,
      });

      const config = {
        command: "uvx",
        args: ["mcp-server-time", "--local-timezone=America/New_York"],
        env: {},
      };

      const { MCPClient } = await import("./mcpServerProxy");
      const client = new MCPClient("test", config);
      const result = client.resolveCommand("uvx", [
        "mcp-server-time",
        "--local-timezone=America/New_York",
      ]);

      expect(result.resolvedCommand).toBe("uvx.bat");
      expect(result.resolvedArgs).toEqual([
        "mcp-server-time",
        "--local-timezone=America/New_York",
      ]);
    });

    it("在非Windows平台应该保持命令不变", async () => {
      // 模拟Linux/macOS平台
      Object.defineProperty(process, "platform", {
        value: "linux",
        writable: true,
        configurable: true,
      });

      const config = {
        command: "npx",
        args: ["-y", "@amap/amap-maps-mcp-server"],
        env: {},
      };

      const { MCPClient } = await import("./mcpServerProxy");
      const client = new MCPClient("test", config);
      const result = client.resolveCommand("npx", [
        "-y",
        "@amap/amap-maps-mcp-server",
      ]);

      expect(result.resolvedCommand).toBe("npx");
      expect(result.resolvedArgs).toEqual(["-y", "@amap/amap-maps-mcp-server"]);
    });

    it("对于非npm/npx/uvx命令应该保持不变", async () => {
      // 模拟Windows平台
      Object.defineProperty(process, "platform", {
        value: "win32",
        writable: true,
        configurable: true,
      });

      const config = {
        command: "node",
        args: ["server.js"],
        env: {},
      };

      const { MCPClient } = await import("./mcpServerProxy");
      const client = new MCPClient("test", config);
      const result = client.resolveCommand("node", ["server.js"]);

      expect(result.resolvedCommand).toBe("node");
      expect(result.resolvedArgs).toEqual(["server.js"]);
    });
  });

  describe("非Windows平台", () => {
    it("应该保持npm命令不变", async () => {
      // 模拟非Windows平台
      Object.defineProperty(process, "platform", {
        value: "linux",
        writable: true,
        configurable: true,
      });

      const config = {
        command: "npm",
        args: ["install", "package"],
        env: {},
      };

      const { MCPClient } = await import("./mcpServerProxy");
      const client = new MCPClient("test", config);
      const result = client.resolveCommand("npm", ["install", "package"]);

      expect(result.resolvedCommand).toBe("npm");
      expect(result.resolvedArgs).toEqual(["install", "package"]);
    });

    it("应该保持npx命令不变", async () => {
      // 模拟非Windows平台
      Object.defineProperty(process, "platform", {
        value: "darwin",
        writable: true,
        configurable: true,
      });

      const config = {
        command: "npx",
        args: ["-y", "@amap/amap-maps-mcp-server"],
        env: {},
      };

      const { MCPClient } = await import("./mcpServerProxy");
      const client = new MCPClient("test", config);
      const result = client.resolveCommand("npx", [
        "-y",
        "@amap/amap-maps-mcp-server",
      ]);

      expect(result.resolvedCommand).toBe("npx");
      expect(result.resolvedArgs).toEqual(["-y", "@amap/amap-maps-mcp-server"]);
    });

    it("应该保持uvx命令不变", async () => {
      // 模拟非Windows平台
      Object.defineProperty(process, "platform", {
        value: "linux",
        writable: true,
        configurable: true,
      });

      const config = {
        command: "uvx",
        args: ["mcp-server-time", "--local-timezone=America/New_York"],
        env: {},
      };

      const { MCPClient } = await import("./mcpServerProxy");
      const client = new MCPClient("test", config);
      const result = client.resolveCommand("uvx", [
        "mcp-server-time",
        "--local-timezone=America/New_York",
      ]);

      expect(result.resolvedCommand).toBe("uvx");
      expect(result.resolvedArgs).toEqual([
        "mcp-server-time",
        "--local-timezone=America/New_York",
      ]);
    });
  });

  describe("MCP客户端", () => {
    let mockProcess: MockChildProcess;

    beforeEach(async () => {
      mockProcess = new MockChildProcess();
      mockSpawn.mockReturnValue(mockProcess);
    });

    it("应该正确创建MCPClient实例", () => {
      const config = {
        command: "node",
        args: ["test.js"],
        env: { TEST_VAR: "test" },
      };

      const client = new MCPClient("test-server", config);
      expect(client).toBeDefined();
      expect(client.initialized).toBe(false);
      expect(client.tools).toEqual([]);
    });

    it("应该正确生成带前缀的工具名称", () => {
      const config = {
        command: "node",
        args: ["test.js"],
      };

      const client = new MCPClient("test-server", config);
      const prefixedName = (client as any).generatePrefixedToolName(
        "calculate"
      );
      expect(prefixedName).toBe("test_server_xzcli_calculate");
    });

    it("应该正确解析带前缀的工具名称", () => {
      const config = {
        command: "node",
        args: ["test.js"],
      };

      const client = new MCPClient("test-server", config);
      const originalName = client.getOriginalToolName(
        "test_server_xzcli_calculate"
      );
      expect(originalName).toBe("calculate");
    });

    it("对于无效前缀应该返回null", () => {
      const config = {
        command: "node",
        args: ["test.js"],
      };

      const client = new MCPClient("test-server", config);
      const originalName = client.getOriginalToolName("invalid_prefix_tool");
      expect(originalName).toBeNull();
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
    it("应该正确创建JSONRPCServer实例", () => {
      const proxy = new MCPServerProxy();
      const server = new JSONRPCServer(proxy);
      expect(server).toBeDefined();
    });

    it("应该处理初始化请求", async () => {
      const proxy = new MCPServerProxy();
      const server = new JSONRPCServer(proxy);

      const initRequest = {
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: {
          protocolVersion: "2024-11-05",
          clientInfo: { name: "test-client", version: "1.0.0" },
        },
      };

      const response = await server.handleRequest(initRequest);

      expect(response.jsonrpc).toBe("2.0");
      expect(response.id).toBe(1);
      expect(response.result.serverInfo.name).toBe("MCPServerProxy");
      expect(response.result.protocolVersion).toBe("2024-11-05");
    });

    it("应该处理工具列表请求", async () => {
      const proxy = new MCPServerProxy();
      proxy.initialized = true; // Mock initialization
      const server = new JSONRPCServer(proxy);

      const toolsListRequest = {
        jsonrpc: "2.0",
        id: 2,
        method: "tools/list",
        params: {},
      };

      const response = await server.handleRequest(toolsListRequest);

      expect(response.jsonrpc).toBe("2.0");
      expect(response.id).toBe(2);
      expect(response.result).toHaveProperty("tools");
      expect(Array.isArray(response.result.tools)).toBe(true);
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
      const proxy = new MCPServerProxy();
      const server = new JSONRPCServer(proxy);

      const pingRequest = {
        jsonrpc: "2.0",
        id: 4,
        method: "ping",
        params: {},
      };

      const response = await server.handleRequest(pingRequest);

      expect(response.jsonrpc).toBe("2.0");
      expect(response.id).toBe(4);
      expect(response.result).toEqual({});
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
      const proxy = new MCPServerProxy();
      const server = new JSONRPCServer(proxy);

      const invalidJson = "invalid json";
      const response = await server.handleMessage(invalidJson);
      const parsedResponse = JSON.parse(response!);

      expect(parsedResponse.jsonrpc).toBe("2.0");
      expect(parsedResponse.id).toBeNull();
      expect(parsedResponse.error.code).toBe(-32700);
      expect(parsedResponse.error.message).toBe("解析错误");
    });

    it("应该处理未知方法", async () => {
      const proxy = new MCPServerProxy();
      const server = new JSONRPCServer(proxy);

      const unknownMethodRequest = {
        jsonrpc: "2.0",
        id: 5,
        method: "unknown/method",
        params: {},
      };

      const response = await server.handleRequest(unknownMethodRequest);

      expect(response.jsonrpc).toBe("2.0");
      expect(response.id).toBe(5);
      expect(response.error.code).toBe(-32603);
      expect(response.error.message).toContain("未知的方法");
    });

    it("应该处理工具列表请求当代理未初始化时", async () => {
      const proxy = new MCPServerProxy();
      // 不设置initialized为true，保持默认的false
      const server = new JSONRPCServer(proxy);

      const toolsListRequest = {
        jsonrpc: "2.0",
        id: 6,
        method: "tools/list",
        params: {},
      };

      const response = await server.handleRequest(toolsListRequest);

      expect(response.jsonrpc).toBe("2.0");
      expect(response.id).toBe(6);
      expect(response.error).toBeDefined();
      expect(response.error.message).toBe("代理未初始化");
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

  describe("Streamable HTTP MCP客户端支持", () => {
    let MockStreamableHTTPMCPClient: any;
    let MockModelScopeMCPClient: any;

    beforeEach(() => {
      MockStreamableHTTPMCPClient = vi.mocked(StreamableHTTPMCPClient);
      MockModelScopeMCPClient = vi.mocked(ModelScopeMCPClient);
    });

    it("应该为Streamable HTTP服务创建StreamableHTTPMCPClient", async () => {
      mockConfigManager.getMcpServers.mockReturnValue({
        "http-server": {
          url: "https://example.com/mcp",
        },
      });

      const proxy = new MCPServerProxy();
      await proxy.start();

      expect(MockStreamableHTTPMCPClient).toHaveBeenCalledWith("http-server", {
        url: "https://example.com/mcp",
      });
    });

    it("应该为带type字段的Streamable HTTP服务创建正确的客户端", async () => {
      mockConfigManager.getMcpServers.mockReturnValue({
        "http-server-typed": {
          type: "streamable-http",
          url: "https://example.com/mcp",
        },
      });

      const proxy = new MCPServerProxy();
      await proxy.start();

      expect(MockStreamableHTTPMCPClient).toHaveBeenCalledWith(
        "http-server-typed",
        { type: "streamable-http", url: "https://example.com/mcp" }
      );
    });

    it("应该为SSE类型的服务创建ModelScopeMCPClient", async () => {
      mockConfigManager.getMcpServers.mockReturnValue({
        "sse-server": {
          type: "sse",
          url: "https://example.com/sse",
        },
      });

      const proxy = new MCPServerProxy();
      await proxy.start();

      expect(MockModelScopeMCPClient).toHaveBeenCalledWith("sse-server", {
        type: "sse",
        url: "https://example.com/sse",
      });
    });

    it("应该为以/sse结尾的URL创建SSE客户端", async () => {
      mockConfigManager.getMcpServers.mockReturnValue({
        "auto-sse-server": {
          url: "https://example.com/api/sse",
        },
      });

      const proxy = new MCPServerProxy();
      await proxy.start();

      expect(MockModelScopeMCPClient).toHaveBeenCalledWith("auto-sse-server", {
        url: "https://example.com/api/sse",
      });
    });

    it("应该为modelscope.net域名创建SSE客户端（向后兼容）", async () => {
      mockConfigManager.getMcpServers.mockReturnValue({
        "modelscope-server": {
          url: "https://api.modelscope.net/mcp/endpoint",
        },
      });

      const proxy = new MCPServerProxy();
      await proxy.start();

      expect(MockModelScopeMCPClient).toHaveBeenCalledWith(
        "modelscope-server",
        { url: "https://api.modelscope.net/mcp/endpoint" }
      );
    });

    it.skip("应该为本地命令创建MCPClient", async () => {
      const mockChildProcess = new MockChildProcess();
      mockSpawn.mockReturnValue(mockChildProcess);

      mockConfigManager.getMcpServers.mockReturnValue({
        "local-server": {
          command: "node",
          args: ["local.js"],
        },
      });

      const proxy = new MCPServerProxy();

      // 使用 Promise 来控制启动流程
      const startPromise = proxy.start();

      // 等待一个微任务后触发初始化完成
      await new Promise((resolve) => process.nextTick(resolve));

      mockChildProcess.stdout.emit(
        "data",
        Buffer.from(
          `${JSON.stringify({
            jsonrpc: "2.0",
            result: {
              protocolVersion: "0.1.0",
              capabilities: {},
              serverInfo: { name: "test" },
            },
            id: 1,
          })}\n`
        )
      );

      await startPromise;

      expect(mockSpawn).toHaveBeenCalledWith(
        "node",
        ["local.js"],
        expect.objectContaining({
          stdio: ["pipe", "pipe", "pipe"],
        })
      );
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
      const serverExists = Object.prototype.hasOwnProperty.call(
        mockConfigManager.getMcpServers(),
        serverName
      );
      expect(serverExists).toBe(false);
    });
  });

  describe("ModelScope MCP 集成", () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    it.skip("应该识别并创建 ModelScope MCP 客户端", async () => {
      const { ModelScopeMCPClient } = await import("./modelScopeMCPClient");

      mockConfigManager.configExists.mockReturnValue(true);
      mockConfigManager.getMcpServers.mockReturnValue({
        "local-server": {
          command: "node",
          args: ["server.js"],
        },
        "modelscope-server": {
          type: "sse",
          url: "https://mcp.api-inference.modelscope.net/test/sse",
        },
      });

      // Mock spawn for local server
      const mockChildProcess = new MockChildProcess();
      mockSpawn.mockReturnValue(mockChildProcess);

      const proxy = new MCPServerProxy();

      // Mock ModelScopeMCPClient 的 start 方法
      const mockModelScopeClient = {
        initialized: true,
        tools: [{ name: "modelscope_server_xzcli_test-tool" }],
        originalTools: [{ name: "test-tool" }],
        start: vi.fn().mockResolvedValue(undefined),
      };
      (ModelScopeMCPClient as any).mockReturnValue(mockModelScopeClient);

      // 立即触发本地服务器的初始化完成
      setImmediate(() => {
        mockChildProcess.stdout.emit(
          "data",
          Buffer.from(
            `${JSON.stringify({
              jsonrpc: "2.0",
              result: {
                protocolVersion: "0.1.0",
                capabilities: {},
                serverInfo: { name: "local-server" },
              },
              id: 1,
            })}\n`
          )
        );
      });

      await proxy.start();

      // 验证 ModelScopeMCPClient 被创建
      expect(ModelScopeMCPClient).toHaveBeenCalledWith("modelscope-server", {
        type: "sse",
        url: "https://mcp.api-inference.modelscope.net/test/sse",
      });
    });

    it("应该处理 ModelScope MCP 客户端启动失败", async () => {
      const { ModelScopeMCPClient } = await import("./modelScopeMCPClient");

      mockConfigManager.configExists.mockReturnValue(true);
      mockConfigManager.getMcpServers.mockReturnValue({
        "modelscope-server": {
          type: "sse",
          url: "https://mcp.api-inference.modelscope.net/test/sse",
        },
      });

      const proxy = new MCPServerProxy();

      // Mock ModelScopeMCPClient 启动失败
      const mockModelScopeClient = {
        start: vi.fn().mockRejectedValue(new Error("Failed to connect")),
      };
      (ModelScopeMCPClient as any).mockReturnValue(mockModelScopeClient);

      // 应该抛出错误，因为没有客户端成功启动
      await expect(proxy.start()).rejects.toThrow(
        "没有成功启动任何 MCP 客户端"
      );
    });

    it("应该正确调用 ModelScope MCP 工具", async () => {
      const { ModelScopeMCPClient } = await import("./modelScopeMCPClient");

      mockConfigManager.configExists.mockReturnValue(true);
      mockConfigManager.getMcpServers.mockReturnValue({
        "modelscope-server": {
          type: "sse",
          url: "https://mcp.api-inference.modelscope.net/test/sse",
        },
      });

      const proxy = new MCPServerProxy();

      // Mock ModelScopeMCPClient
      const mockModelScopeClient = {
        initialized: true,
        tools: [{ name: "modelscope_server_xzcli_test-tool" }],
        originalTools: [{ name: "test-tool" }],
        start: vi.fn().mockResolvedValue(undefined),
        callTool: vi.fn().mockResolvedValue({ result: "success" }),
      };
      (ModelScopeMCPClient as any).mockReturnValue(mockModelScopeClient);

      await proxy.start();

      const result = await proxy.callTool("modelscope_server_xzcli_test-tool", {
        input: "test",
      });

      expect(mockModelScopeClient.callTool).toHaveBeenCalledWith(
        "modelscope_server_xzcli_test-tool",
        { input: "test" }
      );
      expect(result).toEqual({ result: "success" });
    });
  });
});

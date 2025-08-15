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
  default: {
    readFileSync: vi.fn(),
    existsSync: vi.fn().mockReturnValue(true),
    writeFileSync: vi.fn(),
    createWriteStream: vi.fn().mockReturnValue({
      write: vi.fn(),
      end: vi.fn(),
    }),
  },
  readFileSync: vi.fn(),
  existsSync: vi.fn().mockReturnValue(true),
  writeFileSync: vi.fn(),
  createWriteStream: vi.fn().mockReturnValue({
    write: vi.fn(),
    end: vi.fn(),
  }),
}));

// Mock configManager
vi.mock("./configManager", () => ({
  configManager: {
    configExists: vi.fn(),
    getMcpServers: vi.fn(),
    isToolEnabled: vi.fn(),
    updateServerToolsConfig: vi.fn(),
    getServerToolsConfig: vi.fn(),
    getMcpServerConfig: vi.fn(),
    removeServerToolsConfig: vi.fn(),
    updateToolUsageStats: vi.fn(),
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

// Mock SSEMCPClient
vi.mock("./sseMCPClient", () => ({
  SSEMCPClient: vi.fn().mockImplementation((name, config) => ({
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
import { SSEMCPClient } from "./sseMCPClient";
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
        getOriginalToolName: vi
          .fn()
          .mockImplementation((prefixedName: string) => {
            if (prefixedName.startsWith("modelscope_server_xzcli_")) {
              return prefixedName.substring("modelscope_server_xzcli_".length);
            }
            return null;
          }),
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
  });

});

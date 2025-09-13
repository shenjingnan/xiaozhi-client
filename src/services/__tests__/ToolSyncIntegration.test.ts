import type { Tool } from "@modelcontextprotocol/sdk/types.js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { MCPServiceConfig } from "../MCPService.js";
import { MCPServiceManager } from "../MCPServiceManager.js";
import { ToolSyncManager } from "../ToolSyncManager.js";

// Mock logger
vi.mock("../../Logger.js", () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    withTag: vi.fn().mockReturnThis(),
  },
}));

// Mock configManager
vi.mock("../../configManager.js", async () => {
  const actual = await vi.importActual("../../configManager.js");
  const configManager = actual.configManager as any;
  return {
    ...actual,
    configManager: {
      ...(configManager || {}),
      getConfig: vi.fn(),
      getMcpServers: vi.fn(),
      getServerToolsConfig: vi.fn(),
      getCustomMCPTools: vi.fn(),
      addCustomMCPTools: vi.fn(),
      isToolEnabled: vi.fn(),
    },
  };
});

// Get mocked configManager
const { configManager: mockConfigManager } = await import(
  "../../configManager.js"
);

// Mock MCPService
vi.mock("../MCPService.js", () => {
  class MockMCPService {
    private connected = false;
    private tools: Tool[] = [];

    constructor(private config: MCPServiceConfig) {}

    async connect() {
      this.connected = true;
      // 模拟一些工具
      this.tools = [
        {
          name: "calculator",
          description: "Math calculation tool",
          inputSchema: {
            type: "object",
            properties: {
              expression: { type: "string" },
            },
          },
        },
        {
          name: "datetime",
          description: "Date and time tool",
          inputSchema: {
            type: "object",
            properties: {
              format: { type: "string" },
            },
          },
        },
      ];
    }

    isConnected() {
      return this.connected;
    }

    getTools(): Tool[] {
      return this.tools;
    }

    async callTool(name: string, args: any) {
      return {
        content: [{ type: "text", text: `Mock result for ${name}` }],
      };
    }
  }

  return {
    MCPService: MockMCPService,
    MCPTransportType: {
      STDIO: "stdio",
      SSE: "sse",
      STREAMABLE_HTTP: "streamable-http",
      MODELSCOPE_SSE: "modelscope-sse",
    },
  };
});

// Mock CustomMCPHandler
let mockCustomMCPTools: any[] = [];

vi.mock("../CustomMCPHandler.js", () => {
  class MockCustomMCPHandler {
    initialize() {}

    getTools(): any[] {
      return mockCustomMCPTools;
    }

    hasTool(name: string): boolean {
      return mockCustomMCPTools.some((tool) => tool.name === name);
    }

    getToolInfo(name: string) {
      return mockCustomMCPTools.find((tool) => tool.name === name);
    }

    async callTool(name: string, args: any) {
      return {
        content: [{ type: "text", text: `Custom MCP result for ${name}` }],
      };
    }
  }

  return { CustomMCPHandler: MockCustomMCPHandler };
});

// Mock MCPCacheManager
vi.mock("../MCPCacheManager.js", () => {
  class MockMCPCacheManager {
    constructor() {}

    async writeCacheEntry() {}
    async readCacheEntry() {
      return null;
    }
  }

  return { MCPCacheManager: MockMCPCacheManager };
});

describe("工具同步集成测试", () => {
  let serviceManager: MCPServiceManager;

  beforeEach(() => {
    // 创建测试配置
    const testConfig = {
      mcpEndpoint: "http://localhost:3000",
      mcpServers: {
        calculator: {
          name: "calculator",
          type: "stdio" as const,
          command: "node",
          args: ["./test-calculator.js"],
        },
      },
      mcpServerConfig: {
        calculator: {
          tools: {
            calculator: {
              description: "Math calculation tool",
              enable: true,
            },
            datetime: {
              description: "Date and time tool",
              enable: false, // datetime 工具被禁用
            },
          },
        },
      },
      customMCP: {
        tools: [],
      },
    };

    // Mock configManager 方法
    vi.mocked(mockConfigManager.getConfig).mockReturnValue(testConfig);
    vi.mocked(mockConfigManager.getMcpServers).mockReturnValue(
      testConfig.mcpServers
    );
    vi.mocked(mockConfigManager.getServerToolsConfig).mockImplementation(
      (serviceName: string) => {
        return (testConfig.mcpServerConfig as Record<string, any>)?.[
          serviceName
        ]?.tools;
      }
    );
    vi.mocked(mockConfigManager.getCustomMCPTools).mockReturnValue([]);
    vi.mocked(mockConfigManager.addCustomMCPTools).mockImplementation(
      async (tools) => {
        // 模拟添加到 customMCP
        const currentConfig =
          vi.mocked(mockConfigManager.getConfig).mock.results[0]?.value ||
          testConfig;
        currentConfig.customMCP!.tools.push(...tools);
      }
    );
    vi.mocked(mockConfigManager.isToolEnabled).mockReturnValue(true);

    serviceManager = new MCPServiceManager(
      testConfig.mcpServers as Record<string, any>
    );
  });

  afterEach(() => {
    vi.clearAllMocks();
    // 重置 mock 实现
    vi.mocked(mockConfigManager.getConfig).mockReturnValue({
      mcpEndpoint: "http://localhost:3000",
      mcpServers: {},
      mcpServerConfig: {},
      customMCP: { tools: [] },
    });
    vi.mocked(mockConfigManager.getMcpServers).mockReturnValue({});
    vi.mocked(mockConfigManager.getServerToolsConfig).mockReturnValue({});
    vi.mocked(mockConfigManager.getCustomMCPTools).mockReturnValue([]);
    vi.mocked(mockConfigManager.addCustomMCPTools).mockResolvedValue(undefined);
  });

  describe("端到端工具同步流程", () => {
    it("应该在服务启动后自动同步启用的工具到 customMCP", async () => {
      // Act - 启动服务
      await serviceManager.startService("calculator");

      // Assert - 验证工具同步
      expect(
        vi.mocked(mockConfigManager.addCustomMCPTools)
      ).toHaveBeenCalledWith([
        expect.objectContaining({
          name: "calculator__calculator",
          description: "Math calculation tool",
          handler: {
            type: "mcp",
            config: {
              serviceName: "calculator",
              toolName: "calculator",
            },
          },
        }),
      ]);

      // 验证只同步了启用的工具（calculator），没有同步禁用的工具（datetime）
      const callArgs = vi.mocked(mockConfigManager.addCustomMCPTools).mock
        .calls[0][0];
      expect(callArgs).toHaveLength(1);
      expect(callArgs[0].name).toBe("calculator__calculator");
    });

    it("应该正确路由同步的工具调用", async () => {
      // Arrange - 启动服务并同步工具
      await serviceManager.startService("calculator");

      // Act - 调用同步的工具
      const result = await serviceManager.callTool("calculator__calculator", {
        expression: "1 + 1",
      });

      // Assert
      expect(result).toEqual({
        content: [{ type: "text", text: "Mock result for calculator" }],
      });
    });

    it("应该在 getAllTools 中正确聚合和去重", () => {
      // Arrange - 设置 customMCP 工具来测试去重逻辑
      mockCustomMCPTools = [
        {
          name: "custom_tool",
          description: "Custom tool only",
          inputSchema: {},
          handler: {
            type: "proxy" as const,
            platform: "coze" as const,
            config: {},
          },
        },
      ];

      // Act
      const allTools = serviceManager.getAllTools();

      // Assert - 应该有 1 个 customMCP 工具
      expect(allTools.length).toBe(1);

      // 验证 customMCP 工具存在
      const customTool = allTools.find((t) => t.name === "custom_tool");
      expect(customTool).toBeDefined();
      expect(customTool!.serviceName).toBe("customMCP");

      // 清理 mock
      mockCustomMCPTools = [];
    });
  });

  describe("错误处理和边界情况", () => {
    it("应该处理同步失败的情况", async () => {
      // Arrange - 模拟添加工具失败
      vi.mocked(mockConfigManager.addCustomMCPTools).mockRejectedValue(
        new Error("添加失败")
      );

      // Act - 启动服务不应该抛出异常
      await expect(
        serviceManager.startService("calculator")
      ).resolves.not.toThrow();

      // Assert - 验证同步尝试失败，但不影响服务启动
      expect(mockConfigManager.addCustomMCPTools).toHaveBeenCalled();
      // 服务启动成功，但同步失败不会阻止服务运行
    });

    it("应该跳过没有配置的服务", async () => {
      // Arrange - 移除 calculator 的 mcpServerConfig
      vi.mocked(mockConfigManager.getServerToolsConfig).mockReturnValue({});

      // Act
      await serviceManager.startService("calculator");

      // Assert - 不应该调用 addCustomMCPTools
      expect(
        vi.mocked(mockConfigManager.addCustomMCPTools)
      ).not.toHaveBeenCalled();
    });
  });

  describe("并发安全", () => {
    it("应该防止重复同步", async () => {
      // Arrange - 模拟慢速的添加操作
      let addCallCount = 0;
      vi.mocked(mockConfigManager.addCustomMCPTools).mockImplementation(
        async () => {
          addCallCount++;
          await new Promise((resolve) => setTimeout(resolve, 100));
        }
      );

      // Act - 同时启动多个服务实例
      const promises = [
        serviceManager.startService("calculator"),
        serviceManager.startService("calculator"),
        serviceManager.startService("calculator"),
      ];

      await Promise.all(promises);

      // Assert - 只应该调用一次 addCustomMCPTools
      expect(addCallCount).toBe(1);
    });
  });
});

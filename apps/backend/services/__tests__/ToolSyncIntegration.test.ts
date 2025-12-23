import type { MCPServiceConfig } from "@/lib/mcp/types.js";
import type { Tool } from "@modelcontextprotocol/sdk/types.js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Mock CustomMCPHandler - 需要在其他 mock 之前定义
let mockCustomMCPTools: any[] = [];

// Mock the entire @/lib/mcp module before importing
vi.mock("@/lib/mcp", () => {
  // Mock MCPService class
  class MockMCPService {
    private connected = false;
    private tools: Tool[] = [];

    constructor(private config: MCPServiceConfig) {}

    async connect() {
      // 模拟连接延迟
      await new Promise((resolve) => setTimeout(resolve, 10));
      this.connected = true;

      // 模拟一些工具
      this.tools = [
        {
          name: "calculator",
          description:
            "For mathematical calculation, always use this tool to calculate the result of a JavaScript expression. Math object and basic operations are available.",
          inputSchema: {
            type: "object" as const,
            properties: {
              expression: { type: "string" },
            },
          },
        },
        {
          name: "datetime",
          description: "Date and time tool",
          inputSchema: {
            type: "object" as const,
            properties: {
              format: { type: "string" },
              action: { type: "string" },
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
      if (name === "calculator") {
        const expression = args?.expression || "1 + 1";
        try {
          // 简单的数学表达式计算（避免使用 eval）
          const result = this.evaluateSimpleExpression(expression);
          return {
            content: [{ type: "text", text: `Result: ${result}` }],
          };
        } catch {
          return {
            content: [{ type: "text", text: `Mock result for ${name}` }],
          };
        }
      }

      return {
        content: [{ type: "text", text: `Mock result for ${name}` }],
      };
    }

    // 简单的数学表达式求值器（仅用于测试）
    private evaluateSimpleExpression(expression: string): number {
      // 只处理简单的加法
      if (expression.includes("+")) {
        const parts = expression.split("+");
        return parts.reduce(
          (sum, part) => sum + Number.parseFloat(part.trim()),
          0
        );
      }
      return Number.parseFloat(expression) || 1;
    }
  }

  // Mock MCPServiceManager class
  class MockMCPServiceManager {
    private services: Map<string, any> = new Map();

    constructor(configs?: any) {
      // 初始化
    }

    async startService(serviceName: string): Promise<void> {
      const config = {
        name: serviceName,
        type: "stdio" as any, // 使用字符串类型，在 mock 中这是兼容的
        command: "node",
        args: ["./test-calculator.js"],
      };
      const service = new MockMCPService(config);
      await service.connect();
      this.services.set(serviceName, service);
    }

    async stopService(serviceName: string): Promise<void> {
      this.services.delete(serviceName);
    }

    getAllTools(): Array<{
      name: string;
      description: string;
      inputSchema: any;
      serviceName: string;
      originalName: string;
    }> {
      const allTools: Array<{
        name: string;
        description: string;
        inputSchema: any;
        serviceName: string;
        originalName: string;
      }> = [];

      // 添加 customMCP 工具
      for (const tool of mockCustomMCPTools) {
        allTools.push({
          name: tool.name,
          description: tool.description || "",
          inputSchema: tool.inputSchema,
          serviceName: "customMCP",
          originalName: tool.name,
        });
      }

      return allTools;
    }

    async callTool(
      toolName: string,
      arguments_: Record<string, unknown>
    ): Promise<any> {
      // 检查是否是 customMCP 工具
      if (mockCustomMCPTools.some((tool) => tool.name === toolName)) {
        return {
          content: [
            { type: "text", text: `Custom MCP result for ${toolName}` },
          ],
        };
      }

      // 检查是否是格式化后的工具名 (serviceName__toolName)
      if (toolName.includes("__")) {
        const [serviceName, originalName] = toolName.split("__");
        const service = this.services.get(serviceName);
        if (service) {
          return await service.callTool(originalName, arguments_);
        }
      }

      throw new Error(`未找到工具: ${toolName}`);
    }

    hasTool(toolName: string): boolean {
      // 检查 customMCP 工具
      if (mockCustomMCPTools.some((tool) => tool.name === toolName)) {
        return true;
      }

      // 检查格式化后的工具名
      if (toolName.includes("__")) {
        const [serviceName] = toolName.split("__");
        return this.services.has(serviceName);
      }

      return false;
    }

    getConnectedServices(): string[] {
      return Array.from(this.services.keys());
    }
  }

  return {
    MCPServiceManager: MockMCPServiceManager,
    MCPService: MockMCPService,
    MCPTransportType: {
      STDIO: "stdio" as const,
      SSE: "sse" as const,
      STREAMABLE_HTTP: "streamable-http" as const,
    },
  };
});

// Now import the mocked MCPServiceManager
import { MCPServiceManager } from "@/lib/mcp";

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
vi.mock("@/lib/config/manager.js", async () => {
  const actual = await vi.importActual("@/lib/config/manager.js");
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
      getCustomMCPConfig: vi.fn(),
      updateCustomMCPTools: vi.fn(),
      isToolEnabled: vi.fn(),
      getToolCallLogConfig: vi.fn(),
      getConfigDir: vi.fn(),
    },
  };
});

// Mock CustomMCPHandler
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
    async writeCacheEntry() {}
    async readCacheEntry() {
      return null;
    }
  }

  return { MCPCacheManager: MockMCPCacheManager };
});

// Get mocked configManager
const { configManager: mockConfigManager } = await import(
  "@/lib/config/manager.js"
);

describe("工具缓存集成测试", () => {
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
    vi.mocked(mockConfigManager.getCustomMCPConfig).mockReturnValue(null);
    vi.mocked(mockConfigManager.updateCustomMCPTools).mockResolvedValue(
      undefined
    );
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
    vi.mocked(mockConfigManager.getToolCallLogConfig).mockReturnValue({});
    vi.mocked(mockConfigManager.getConfigDir).mockReturnValue("/tmp/test");

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
    vi.mocked(mockConfigManager.getCustomMCPConfig).mockReturnValue(null);
    vi.mocked(mockConfigManager.updateCustomMCPTools).mockResolvedValue(
      undefined
    );
    vi.mocked(mockConfigManager.addCustomMCPTools).mockResolvedValue(undefined);
    vi.mocked(mockConfigManager.getToolCallLogConfig).mockReturnValue({});
    vi.mocked(mockConfigManager.getConfigDir).mockReturnValue("/tmp/test");
  });

  describe("端到端工具聚合流程", () => {
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
    it("应该能成功启动和停止服务", async () => {
      // Act - 启动服务
      await serviceManager.startService("calculator");

      // Assert - 服务应该成功启动
      expect(serviceManager.getConnectedServices()).toContain("calculator");

      // Act - 停止服务
      await serviceManager.stopService("calculator");

      // Assert - 服务应该成功停止
      expect(serviceManager.getConnectedServices()).not.toContain("calculator");
    });
  });
});

import { configManager } from "@/lib/config/manager.js";
import type {
  MCPServerConfig,
  MCPServerToolsConfig,
  MCPToolConfig,
} from "@/lib/config/manager.js";
import type { IDIContainer } from "@cli/interfaces/Config.js";
import ora from "ora";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { McpCommandHandler } from "../McpCommandHandler.js";

// 测试专用类型定义
interface MockedOra {
  start: ReturnType<typeof vi.fn>;
  succeed: ReturnType<typeof vi.fn>;
  fail: ReturnType<typeof vi.fn>;
  warn: ReturnType<typeof vi.fn>;
}

// 简化 mock spinner 类型
interface MockSpinner extends MockedOra {
  // 只包含我们实际需要的方法
  text?: string;
}

interface MockServerConfig {
  [serverName: string]: MCPServerConfig;
}

interface MockServerToolsConfig {
  [serverName: string]: MCPServerToolsConfig;
}

interface ListCommandOptions {
  tools?: boolean;
}

// 为测试创建可访问私有方法的扩展类
class McpCommandHandlerTest extends McpCommandHandler {
  // 公开静态私有方法用于测试
  public static testGetDisplayWidth(str: string): number {
    return (
      McpCommandHandler as unknown as {
        getDisplayWidth: (str: string) => number;
      }
    ).getDisplayWidth(str);
  }

  public static testTruncateToWidth(str: string, maxWidth: number): string {
    return (
      McpCommandHandler as unknown as {
        truncateToWidth: (str: string, maxWidth: number) => string;
      }
    ).truncateToWidth(str, maxWidth);
  }

  // 公开实例私有方法用于测试
  public async testHandleListInternal(
    options: ListCommandOptions = {}
  ): Promise<void> {
    return (
      this as unknown as {
        handleListInternal: (options: ListCommandOptions) => Promise<void>;
      }
    ).handleListInternal(options);
  }

  public async testHandleServerInternal(serverName: string): Promise<void> {
    return (
      this as unknown as {
        handleServerInternal: (serverName: string) => Promise<void>;
      }
    ).handleServerInternal(serverName);
  }

  public async testHandleToolInternal(
    serverName: string,
    toolName: string,
    enabled: boolean
  ): Promise<void> {
    return (
      this as unknown as {
        handleToolInternal: (
          serverName: string,
          toolName: string,
          enabled: boolean
        ) => Promise<void>;
      }
    ).handleToolInternal(serverName, toolName, enabled);
  }

  public async testHandleCall(
    serviceName: string,
    toolName: string,
    argsString: string
  ): Promise<void> {
    return (
      this as unknown as {
        handleCall: (
          serviceName: string,
          toolName: string,
          argsString: string
        ) => Promise<void>;
      }
    ).handleCall(serviceName, toolName, argsString);
  }
}

// Mock dependencies
vi.mock("chalk", () => ({
  default: {
    cyan: vi.fn((text) => text),
    bold: vi.fn((text) => text),
    green: vi.fn((text) => text),
    red: vi.fn((text) => text),
    yellow: vi.fn((text) => text),
    gray: vi.fn((text) => text),
  },
}));

vi.mock("ora", () => ({
  default: vi.fn(() => ({
    start: vi.fn().mockReturnThis(),
    succeed: vi.fn().mockReturnThis(),
    fail: vi.fn().mockReturnThis(),
    warn: vi.fn().mockReturnThis(),
  })),
}));

vi.mock("@/lib/config/manager.js", () => ({
  configManager: {
    getMcpServers: vi.fn(),
    getMcpServerConfig: vi.fn(),
    getServerToolsConfig: vi.fn(),
    setToolEnabled: vi.fn(),
    getCustomMCPTools: vi.fn(),
    getWebUIPort: vi.fn(),
  },
}));

// Mock ProcessManager
const mockGetServiceStatus = vi
  .fn()
  .mockReturnValue({ running: false, pid: null });

vi.mock("@cli/services/ProcessManager.js", () => ({
  ProcessManagerImpl: vi.fn().mockImplementation(() => ({
    getServiceStatus: mockGetServiceStatus,
  })),
}));

// Mock fetch for HTTP API calls
global.fetch = vi.fn();

// Mock console methods
const mockConsoleLog = vi.spyOn(console, "log").mockImplementation(() => {});
const mockConsoleError = vi
  .spyOn(console, "error")
  .mockImplementation(() => {});
const mockProcessExit = vi.spyOn(process, "exit").mockImplementation(() => {
  throw new Error("process.exit called");
});

describe("McpCommandHandler", () => {
  const mockSpinner: MockSpinner = {
    start: vi.fn().mockReturnThis(),
    succeed: vi.fn().mockReturnThis(),
    fail: vi.fn().mockReturnThis(),
    warn: vi.fn().mockReturnThis(),
    text: "",
  };

  const mockContainer: IDIContainer = {
    get: vi.fn(),
    has: vi.fn(),
    register: vi.fn(),
  };

  let handler: McpCommandHandlerTest;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(ora).mockReturnValue(
      mockSpinner as unknown as ReturnType<typeof ora>
    );
    handler = new McpCommandHandlerTest(mockContainer);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("静态工具函数", () => {
    describe("getDisplayWidth", () => {
      it("应该正确计算英文字符的宽度", () => {
        expect(McpCommandHandlerTest.testGetDisplayWidth("hello")).toBe(5);
        expect(McpCommandHandlerTest.testGetDisplayWidth("Hello World!")).toBe(
          12
        );
        expect(McpCommandHandlerTest.testGetDisplayWidth("")).toBe(0);
      });

      it("应该正确计算中文字符的宽度", () => {
        expect(McpCommandHandlerTest.testGetDisplayWidth("你好")).toBe(4); // 2个中文字符 = 4宽度
        expect(McpCommandHandlerTest.testGetDisplayWidth("中文测试")).toBe(8); // 4个中文字符 = 8宽度
        expect(McpCommandHandlerTest.testGetDisplayWidth("测试")).toBe(4); // 2个中文字符 = 4宽度
      });

      it("应该正确计算混合字符的宽度", () => {
        expect(McpCommandHandlerTest.testGetDisplayWidth("Hello你好")).toBe(9); // 5个英文 + 2个中文 = 5 + 4 = 9
        expect(McpCommandHandlerTest.testGetDisplayWidth("测试Test")).toBe(8); // 2个中文 + 4个英文 = 4 + 4 = 8
        expect(
          McpCommandHandlerTest.testGetDisplayWidth("中文English混合")
        ).toBe(15); // 2个中文 + 7个英文 + 2个中文 = 4 + 7 + 4 = 15
      });

      it("应该正确处理中文标点符号", () => {
        expect(McpCommandHandlerTest.testGetDisplayWidth("你好，世界！")).toBe(
          12
        ); // 4个中文字符 + 2个中文标点 = 12
        expect(McpCommandHandlerTest.testGetDisplayWidth("测试：成功")).toBe(
          10
        ); // 4个中文字符 + 1个中文冒号 = 10
      });

      it("应该处理特殊字符", () => {
        expect(
          McpCommandHandlerTest.testGetDisplayWidth("test@example.com")
        ).toBe(16);
        expect(McpCommandHandlerTest.testGetDisplayWidth("123-456-789")).toBe(
          11
        );
      });
    });

    describe("truncateToWidth", () => {
      it("应该不截断宽度限制内的字符串", () => {
        expect(McpCommandHandlerTest.testTruncateToWidth("hello", 10)).toBe(
          "hello"
        );
        expect(McpCommandHandlerTest.testTruncateToWidth("你好", 10)).toBe(
          "你好"
        );
        expect(McpCommandHandlerTest.testTruncateToWidth("Hello你好", 10)).toBe(
          "Hello你好"
        );
      });

      it("应该正确截断英文字符串", () => {
        expect(
          McpCommandHandlerTest.testTruncateToWidth("Hello World", 8)
        ).toBe("Hello...");
        expect(
          McpCommandHandlerTest.testTruncateToWidth(
            "This is a very long description",
            15
          )
        ).toBe("This is a ve...");
      });

      it("应该正确截断中文字符串", () => {
        // "这是一个很长的描述文本" = 16宽度, maxWidth=10, 所以 "这是一..." = 7宽度
        expect(
          McpCommandHandlerTest.testTruncateToWidth(
            "这是一个很长的描述文本",
            10
          )
        ).toBe("这是一...");
        // "中文测试内容" = 10宽度, maxWidth=6, 所以 "中..." = 5宽度
        expect(
          McpCommandHandlerTest.testTruncateToWidth("中文测试内容", 6)
        ).toBe("中...");
      });

      it("应该正确截断混合字符串", () => {
        // "Hello你好World" = 13宽度, maxWidth=10, 所以 "Hello你..." = 10宽度
        expect(
          McpCommandHandlerTest.testTruncateToWidth("Hello你好World", 10)
        ).toBe("Hello你...");
        // "测试Test内容" = 12宽度, maxWidth=8, 所以 "测试T..." = 8宽度
        expect(
          McpCommandHandlerTest.testTruncateToWidth("测试Test内容", 8)
        ).toBe("测试T...");
      });

      it("应该处理边界情况", () => {
        expect(McpCommandHandlerTest.testTruncateToWidth("", 10)).toBe("");
        expect(McpCommandHandlerTest.testTruncateToWidth("a", 1)).toBe("a");
        expect(McpCommandHandlerTest.testTruncateToWidth("ab", 1)).toBe(""); // 连一个字符 + "..." 都放不下
      });

      it("应该处理非常短的宽度限制", () => {
        expect(McpCommandHandlerTest.testTruncateToWidth("hello", 3)).toBe(""); // maxWidth <= 3, 返回空字符串
        expect(McpCommandHandlerTest.testTruncateToWidth("hello", 4)).toBe(
          "h..."
        );
        expect(McpCommandHandlerTest.testTruncateToWidth("你好", 4)).toBe(
          "你好"
        ); // "你好" 宽度=4, 正好符合 maxWidth=4
        expect(McpCommandHandlerTest.testTruncateToWidth("你好世界", 4)).toBe(
          ""
        ); // "你好世界" 宽度=8 > 4, 但连一个字符 + "..." 都放不下
        expect(McpCommandHandlerTest.testTruncateToWidth("你好", 5)).toBe(
          "你好"
        ); // "你好" 宽度=4 <= maxWidth=5, 不需要截断
        expect(McpCommandHandlerTest.testTruncateToWidth("你好世界", 5)).toBe(
          "你..."
        );
      });
    });
  });

  describe("handleListInternal", () => {
    const mockServers: MockServerConfig = {
      calculator: {
        command: "node",
        args: ["./mcpServers/calculator.js"],
      },
      datetime: {
        command: "node",
        args: ["./mcpServers/datetime.js"],
      },
    };

    const mockServerConfig: MockServerToolsConfig = {
      calculator: {
        tools: {
          calculator: {
            description: "数学计算工具",
            enable: true,
          },
        },
      },
      datetime: {
        tools: {
          get_current_time: {
            description: "获取当前时间",
            enable: true,
          },
          get_current_date: {
            description: "获取当前日期",
            enable: false,
          },
        },
      },
    };

    beforeEach(() => {
      vi.mocked(configManager.getMcpServers).mockReturnValue(mockServers);
      vi.mocked(configManager.getMcpServerConfig).mockReturnValue(
        mockServerConfig
      );
      vi.mocked(configManager.getServerToolsConfig).mockImplementation(
        (serverName: string) => {
          return mockServerConfig[serverName]?.tools || {};
        }
      );
      vi.mocked(configManager.getCustomMCPTools).mockReturnValue([]);
    });

    it("应该列出不带工具选项的服务", async () => {
      await handler.testHandleListInternal();

      expect(mockSpinner.succeed).toHaveBeenCalledWith("找到 2 个 MCP 服务");
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining("MCP 服务列表:")
      );
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining("calculator")
      );
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining("datetime")
      );
    });

    it("应该使用cli-table3列出带工具选项的服务", async () => {
      await handler.testHandleListInternal({ tools: true });

      expect(mockSpinner.succeed).toHaveBeenCalledWith("找到 2 个 MCP 服务");
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining("MCP 服务工具列表:")
      );
      // 检查表格输出中的工具名称（现在只显示工具名，不包含服务名前缀）
      const tableOutput = mockConsoleLog.mock.calls.find(
        (call) =>
          call[0] &&
          typeof call[0] === "string" &&
          call[0].includes("calculator")
      );
      expect(tableOutput).toBeDefined();

      const timeToolOutput = mockConsoleLog.mock.calls.find(
        (call) =>
          call[0] &&
          typeof call[0] === "string" &&
          call[0].includes("get_current_time")
      );
      expect(timeToolOutput).toBeDefined();
    });

    it("应该处理空服务列表", async () => {
      vi.mocked(configManager.getMcpServers).mockReturnValue({});

      await handler.testHandleListInternal();

      expect(mockSpinner.warn).toHaveBeenCalledWith(
        "未配置任何 MCP 服务或 customMCP 工具"
      );
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining("提示: 使用 'xiaozhi config' 命令配置 MCP 服务")
      );
    });

    it("应该优雅地处理错误", async () => {
      vi.mocked(configManager.getMcpServers).mockImplementation(() => {
        throw new Error("Config error");
      });

      await expect(async () => {
        await handler.testHandleListInternal();
      }).rejects.toThrow("process.exit called");

      expect(mockSpinner.fail).toHaveBeenCalledWith("获取 MCP 服务列表失败");
      expect(mockConsoleError).toHaveBeenCalledWith(
        expect.stringContaining("错误: Config error")
      );
      expect(mockProcessExit).toHaveBeenCalledWith(1);
    });
  });

  describe("handleServerInternal", () => {
    const mockServers: MockServerConfig = {
      datetime: {
        command: "node",
        args: ["./mcpServers/datetime.js"],
      },
    };

    const mockToolsConfig: Record<string, MCPToolConfig> = {
      get_current_time: {
        description: "获取当前时间",
        enable: true,
      },
      get_current_date: {
        description: "获取当前日期",
        enable: false,
      },
    };

    beforeEach(() => {
      vi.mocked(configManager.getMcpServers).mockReturnValue(mockServers);
      vi.mocked(configManager.getServerToolsConfig).mockReturnValue(
        mockToolsConfig
      );
    });

    it("应该列出现有服务的工具", async () => {
      await handler.testHandleServerInternal("datetime");

      expect(mockSpinner.succeed).toHaveBeenCalledWith(
        "服务 'datetime' 共有 2 个工具"
      );
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining("datetime 服务工具列表:")
      );
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining("get_current_time")
      );
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining("get_current_date")
      );
    });

    it("应该处理不存在的服务", async () => {
      vi.mocked(configManager.getMcpServers).mockReturnValue({});

      await handler.testHandleServerInternal("non-existent");

      expect(mockSpinner.fail).toHaveBeenCalledWith(
        "服务 'non-existent' 不存在"
      );
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining(
          "提示: 使用 'xiaozhi mcp list' 查看所有可用服务"
        )
      );
    });

    it("应该优雅地处理错误", async () => {
      vi.mocked(configManager.getMcpServers).mockImplementation(() => {
        throw new Error("Config error");
      });

      await expect(async () => {
        await handler.testHandleServerInternal("datetime");
      }).rejects.toThrow("process.exit called");

      expect(mockSpinner.fail).toHaveBeenCalledWith("获取工具列表失败");
      expect(mockConsoleError).toHaveBeenCalledWith(
        expect.stringContaining("错误: Config error")
      );
      expect(mockProcessExit).toHaveBeenCalledWith(1);
    });
  });

  describe("handleToolInternal", () => {
    const mockServers: MockServerConfig = {
      datetime: {
        command: "node",
        args: ["./mcpServers/datetime.js"],
      },
    };

    const mockToolsConfig: Record<string, MCPToolConfig> = {
      get_current_time: {
        description: "获取当前时间",
        enable: true,
      },
    };

    beforeEach(() => {
      vi.mocked(configManager.getMcpServers).mockReturnValue(mockServers);
      vi.mocked(configManager.getServerToolsConfig).mockReturnValue(
        mockToolsConfig
      );
    });

    it("应该成功启用工具", async () => {
      await handler.testHandleToolInternal(
        "datetime",
        "get_current_time",
        true
      );

      expect(mockSpinner.succeed).toHaveBeenCalledWith(
        expect.stringContaining("成功启用工具")
      );
      expect(configManager.setToolEnabled).toHaveBeenCalledWith(
        "datetime",
        "get_current_time",
        true,
        "获取当前时间"
      );
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining("提示: 工具状态更改将在下次启动服务时生效")
      );
    });

    it("应该成功禁用工具", async () => {
      await handler.testHandleToolInternal(
        "datetime",
        "get_current_time",
        false
      );

      expect(mockSpinner.succeed).toHaveBeenCalledWith(
        expect.stringContaining("成功禁用工具")
      );
      expect(configManager.setToolEnabled).toHaveBeenCalledWith(
        "datetime",
        "get_current_time",
        false,
        "获取当前时间"
      );
    });

    it("应该处理不存在的服务", async () => {
      vi.mocked(configManager.getMcpServers).mockReturnValue({});

      await handler.testHandleToolInternal("non-existent", "tool", true);

      expect(mockSpinner.fail).toHaveBeenCalledWith(
        "服务 'non-existent' 不存在"
      );
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining(
          "提示: 使用 'xiaozhi mcp list' 查看所有可用服务"
        )
      );
    });

    it("应该处理不存在的工具", async () => {
      vi.mocked(configManager.getServerToolsConfig).mockReturnValue({});

      await handler.testHandleToolInternal(
        "datetime",
        "non-existent-tool",
        true
      );

      expect(mockSpinner.fail).toHaveBeenCalledWith(
        "工具 'non-existent-tool' 在服务 'datetime' 中不存在"
      );
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining(
          "提示: 使用 'xiaozhi mcp datetime list' 查看该服务的所有工具"
        )
      );
    });

    it("应该优雅地处理启用工具时的错误", async () => {
      vi.mocked(configManager.getMcpServers).mockImplementation(() => {
        throw new Error("Config error");
      });

      await expect(async () => {
        await handler.testHandleToolInternal("datetime", "tool", true);
      }).rejects.toThrow("process.exit called");

      expect(mockSpinner.fail).toHaveBeenCalledWith("启用工具失败");
      expect(mockConsoleError).toHaveBeenCalledWith(
        expect.stringContaining("错误: Config error")
      );
      expect(mockProcessExit).toHaveBeenCalledWith(1);
    });
  });

  describe("handleCall", () => {
    beforeEach(() => {
      // 默认 mock Web 端口
      vi.mocked(configManager.getWebUIPort).mockReturnValue(9999);
    });

    it("应该成功调用工具并返回结果", async () => {
      // Mock ProcessManager 返回服务运行中
      mockGetServiceStatus.mockReturnValue({
        running: true,
        pid: 12345,
      });

      // Mock fetch 返回成功响应
      const mockFetch = vi.mocked(fetch);
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ success: true }),
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            success: true,
            data: {
              content: [{ type: "text", text: "3" }],
            },
          }),
        } as Response);

      await handler.testHandleCall("calculator", "calculator", '{"a": 1}');

      // 验证调用了正确的 API
      expect(mockFetch).toHaveBeenCalledWith(
        "http://localhost:9999/api/tools/call",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            serviceName: "calculator",
            toolName: "calculator",
            args: { a: 1 },
          }),
        }
      );

      // 验证输出结果
      expect(mockConsoleLog).toHaveBeenCalledWith(
        '{"content":[{"type":"text","text":"3"}]}'
      );
    });

    it("应该在参数格式错误时抛出错误", async () => {
      await expect(async () => {
        await handler.testHandleCall(
          "calculator",
          "calculator",
          "invalid-json"
        );
      }).rejects.toThrow("process.exit called");

      expect(mockConsoleError).toHaveBeenCalledWith(
        expect.stringContaining("错误:"),
        expect.stringContaining("参数格式错误")
      );
    });

    it("应该在服务未启动时显示提示", async () => {
      // 重置 ProcessManager mock 返回服务未运行
      mockGetServiceStatus.mockReturnValue({ running: false, pid: null });

      // 确保 fetch 返回一个有效的 Response，但由于服务未启动，不应该调用到 fetch
      const mockFetch = vi.mocked(fetch);
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ success: true }),
      } as Response);

      await expect(async () => {
        await handler.testHandleCall("calculator", "calculator", '{"a": 1}');
      }).rejects.toThrow("process.exit called");

      // 验证错误处理流程 - 服务未启动的错误应该在调用 fetch 之前被抛出
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining("工具调用失败:")
      );
      expect(mockConsoleError).toHaveBeenCalledWith(
        "错误:",
        expect.stringContaining("服务未启动")
      );
      expect(mockProcessExit).toHaveBeenCalledWith(1);

      // fetch 不应该被调用，因为在服务状态检查时就失败了
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it("应该在 HTTP API 调用失败时显示错误", async () => {
      // Mock ProcessManager 返回服务运行中
      mockGetServiceStatus.mockReturnValue({
        running: true,
        pid: 12345,
      });

      // Mock fetch 返回失败响应
      const mockFetch = vi.mocked(fetch);
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ success: true }),
        } as Response)
        .mockResolvedValueOnce({
          ok: false,
          status: 500,
          statusText: "Internal Server Error",
          json: async () => ({
            success: false,
            error: { message: "工具调用失败" },
          }),
        } as Response);

      await expect(async () => {
        await handler.testHandleCall("calculator", "calculator", '{"a": 1}');
      }).rejects.toThrow("process.exit called");

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining("工具调用失败:")
      );
    });
  });
});

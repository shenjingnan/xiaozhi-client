import ora from "ora";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { configManager } from "@root/configManager.js";
import { McpCommandHandler } from "../McpCommandHandler.js";
import type { IDIContainer } from "@cli/interfaces/Config.js";

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

vi.mock("@root/configManager.js", () => ({
  configManager: {
    getMcpServers: vi.fn(),
    getMcpServerConfig: vi.fn(),
    getServerToolsConfig: vi.fn(),
    setToolEnabled: vi.fn(),
    getCustomMCPTools: vi.fn(),
  },
}));

vi.mock("@services/ToolCallService.js", () => ({
  ToolCallService: vi.fn().mockImplementation(() => ({
    parseJsonArgs: vi.fn(),
    callTool: vi.fn(),
    formatOutput: vi.fn(),
  })),
}));

// Mock console methods
const mockConsoleLog = vi.spyOn(console, "log").mockImplementation(() => {});
const mockConsoleError = vi
  .spyOn(console, "error")
  .mockImplementation(() => {});
const mockProcessExit = vi.spyOn(process, "exit").mockImplementation(() => {
  throw new Error("process.exit called");
});

describe("McpCommandHandler", () => {
  const mockSpinner = {
    start: vi.fn().mockReturnThis(),
    succeed: vi.fn().mockReturnThis(),
    fail: vi.fn().mockReturnThis(),
    warn: vi.fn().mockReturnThis(),
  };

  const mockContainer: IDIContainer = {
    get: vi.fn(),
    has: vi.fn(),
    register: vi.fn(),
  };

  let handler: McpCommandHandler;

  beforeEach(() => {
    vi.clearAllMocks();
    (ora as any).mockReturnValue(mockSpinner);
    handler = new McpCommandHandler(mockContainer);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("静态工具函数", () => {
    describe("getDisplayWidth", () => {
      it("应该正确计算英文字符的宽度", () => {
        expect((McpCommandHandler as any).getDisplayWidth("hello")).toBe(5);
        expect((McpCommandHandler as any).getDisplayWidth("Hello World!")).toBe(12);
        expect((McpCommandHandler as any).getDisplayWidth("")).toBe(0);
      });

      it("应该正确计算中文字符的宽度", () => {
        expect((McpCommandHandler as any).getDisplayWidth("你好")).toBe(4); // 2个中文字符 = 4宽度
        expect((McpCommandHandler as any).getDisplayWidth("中文测试")).toBe(8); // 4个中文字符 = 8宽度
        expect((McpCommandHandler as any).getDisplayWidth("测试")).toBe(4); // 2个中文字符 = 4宽度
      });

      it("应该正确计算混合字符的宽度", () => {
        expect((McpCommandHandler as any).getDisplayWidth("Hello你好")).toBe(9); // 5个英文 + 2个中文 = 5 + 4 = 9
        expect((McpCommandHandler as any).getDisplayWidth("测试Test")).toBe(8); // 2个中文 + 4个英文 = 4 + 4 = 8
        expect((McpCommandHandler as any).getDisplayWidth("中文English混合")).toBe(15); // 2个中文 + 7个英文 + 2个中文 = 4 + 7 + 4 = 15
      });

      it("应该正确处理中文标点符号", () => {
        expect((McpCommandHandler as any).getDisplayWidth("你好，世界！")).toBe(12); // 4个中文字符 + 2个中文标点 = 12
        expect((McpCommandHandler as any).getDisplayWidth("测试：成功")).toBe(10); // 4个中文字符 + 1个中文冒号 = 10
      });

      it("应该处理特殊字符", () => {
        expect((McpCommandHandler as any).getDisplayWidth("test@example.com")).toBe(16);
        expect((McpCommandHandler as any).getDisplayWidth("123-456-789")).toBe(11);
      });
    });

    describe("truncateToWidth", () => {
      it("应该不截断宽度限制内的字符串", () => {
        expect((McpCommandHandler as any).truncateToWidth("hello", 10)).toBe("hello");
        expect((McpCommandHandler as any).truncateToWidth("你好", 10)).toBe("你好");
        expect((McpCommandHandler as any).truncateToWidth("Hello你好", 10)).toBe("Hello你好");
      });

      it("应该正确截断英文字符串", () => {
        expect((McpCommandHandler as any).truncateToWidth("Hello World", 8)).toBe("Hello...");
        expect((McpCommandHandler as any).truncateToWidth("This is a very long description", 15)).toBe(
          "This is a ve..."
        );
      });

      it("应该正确截断中文字符串", () => {
        // "这是一个很长的描述文本" = 16宽度, maxWidth=10, 所以 "这是一..." = 7宽度
        expect((McpCommandHandler as any).truncateToWidth("这是一个很长的描述文本", 10)).toBe("这是一...");
        // "中文测试内容" = 10宽度, maxWidth=6, 所以 "中..." = 5宽度
        expect((McpCommandHandler as any).truncateToWidth("中文测试内容", 6)).toBe("中...");
      });

      it("应该正确截断混合字符串", () => {
        // "Hello你好World" = 13宽度, maxWidth=10, 所以 "Hello你..." = 10宽度
        expect((McpCommandHandler as any).truncateToWidth("Hello你好World", 10)).toBe("Hello你...");
        // "测试Test内容" = 12宽度, maxWidth=8, 所以 "测试T..." = 8宽度
        expect((McpCommandHandler as any).truncateToWidth("测试Test内容", 8)).toBe("测试T...");
      });

      it("应该处理边界情况", () => {
        expect((McpCommandHandler as any).truncateToWidth("", 10)).toBe("");
        expect((McpCommandHandler as any).truncateToWidth("a", 1)).toBe("a");
        expect((McpCommandHandler as any).truncateToWidth("ab", 1)).toBe(""); // 连一个字符 + "..." 都放不下
      });

      it("应该处理非常短的宽度限制", () => {
        expect((McpCommandHandler as any).truncateToWidth("hello", 3)).toBe(""); // maxWidth <= 3, 返回空字符串
        expect((McpCommandHandler as any).truncateToWidth("hello", 4)).toBe("h...");
        expect((McpCommandHandler as any).truncateToWidth("你好", 4)).toBe("你好"); // "你好" 宽度=4, 正好符合 maxWidth=4
        expect((McpCommandHandler as any).truncateToWidth("你好世界", 4)).toBe(""); // "你好世界" 宽度=8 > 4, 但连一个字符 + "..." 都放不下
        expect((McpCommandHandler as any).truncateToWidth("你好", 5)).toBe("你好"); // "你好" 宽度=4 <= maxWidth=5, 不需要截断
        expect((McpCommandHandler as any).truncateToWidth("你好世界", 5)).toBe("你...");
      });
    });
  });

  describe("handleListInternal", () => {
    const mockServers = {
      calculator: {
        command: "node",
        args: ["./mcpServers/calculator.js"],
      },
      datetime: {
        command: "node",
        args: ["./mcpServers/datetime.js"],
      },
    };

    const mockServerConfig = {
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
      (configManager.getMcpServers as any).mockReturnValue(mockServers);
      (configManager.getMcpServerConfig as any).mockReturnValue(
        mockServerConfig
      );
      (configManager.getServerToolsConfig as any).mockImplementation(
        (serverName: string) => {
          return (mockServerConfig as any)[serverName]?.tools || {};
        }
      );
      (configManager.getCustomMCPTools as any).mockReturnValue([]);
    });

    it("应该列出不带工具选项的服务", async () => {
      await (handler as any).handleListInternal();

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
      await (handler as any).handleListInternal({ tools: true });

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
      (configManager.getMcpServers as any).mockReturnValue({});

      await (handler as any).handleListInternal();

      expect(mockSpinner.warn).toHaveBeenCalledWith(
        "未配置任何 MCP 服务或 customMCP 工具"
      );
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining("提示: 使用 'xiaozhi config' 命令配置 MCP 服务")
      );
    });

    it("应该优雅地处理错误", async () => {
      (configManager.getMcpServers as any).mockImplementation(() => {
        throw new Error("Config error");
      });

      await expect(async () => {
        await (handler as any).handleListInternal();
      }).rejects.toThrow("process.exit called");

      expect(mockSpinner.fail).toHaveBeenCalledWith("获取 MCP 服务列表失败");
      expect(mockConsoleError).toHaveBeenCalledWith(
        expect.stringContaining("错误: Config error")
      );
      expect(mockProcessExit).toHaveBeenCalledWith(1);
    });
  });

  describe("handleServerInternal", () => {
    const mockServers = {
      datetime: {
        command: "node",
        args: ["./mcpServers/datetime.js"],
      },
    };

    const mockToolsConfig = {
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
      (configManager.getMcpServers as any).mockReturnValue(mockServers);
      (configManager.getServerToolsConfig as any).mockReturnValue(
        mockToolsConfig
      );
    });

    it("应该列出现有服务的工具", async () => {
      await (handler as any).handleServerInternal("datetime");

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
      (configManager.getMcpServers as any).mockReturnValue({});

      await (handler as any).handleServerInternal("non-existent");

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
      (configManager.getMcpServers as any).mockImplementation(() => {
        throw new Error("Config error");
      });

      await expect(async () => {
        await (handler as any).handleServerInternal("datetime");
      }).rejects.toThrow("process.exit called");

      expect(mockSpinner.fail).toHaveBeenCalledWith("获取工具列表失败");
      expect(mockConsoleError).toHaveBeenCalledWith(
        expect.stringContaining("错误: Config error")
      );
      expect(mockProcessExit).toHaveBeenCalledWith(1);
    });
  });

  describe("handleToolInternal", () => {
    const mockServers = {
      datetime: {
        command: "node",
        args: ["./mcpServers/datetime.js"],
      },
    };

    const mockToolsConfig = {
      get_current_time: {
        description: "获取当前时间",
        enable: true,
      },
    };

    beforeEach(() => {
      (configManager.getMcpServers as any).mockReturnValue(mockServers);
      (configManager.getServerToolsConfig as any).mockReturnValue(
        mockToolsConfig
      );
    });

    it("应该成功启用工具", async () => {
      await (handler as any).handleToolInternal("datetime", "get_current_time", true);

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
      await (handler as any).handleToolInternal("datetime", "get_current_time", false);

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
      (configManager.getMcpServers as any).mockReturnValue({});

      await (handler as any).handleToolInternal("non-existent", "tool", true);

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
      (configManager.getServerToolsConfig as any).mockReturnValue({});

      await (handler as any).handleToolInternal("datetime", "non-existent-tool", true);

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
      (configManager.getMcpServers as any).mockImplementation(() => {
        throw new Error("Config error");
      });

      await expect(async () => {
        await (handler as any).handleToolInternal("datetime", "tool", true);
      }).rejects.toThrow("process.exit called");

      expect(mockSpinner.fail).toHaveBeenCalledWith("启用工具失败");
      expect(mockConsoleError).toHaveBeenCalledWith(
        expect.stringContaining("错误: Config error")
      );
      expect(mockProcessExit).toHaveBeenCalledWith(1);
    });
  });
});
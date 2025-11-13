import ora from "ora";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { configManager } from "./configManager";
import {
  getDisplayWidth,
  listMcpServers,
  listServerTools,
  setToolEnabled,
  truncateToWidth,
} from "./mcpCommands";

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

vi.mock("./configManager", () => ({
  configManager: {
    getMcpServers: vi.fn(),
    getMcpServerConfig: vi.fn(),
    getServerToolsConfig: vi.fn(),
    setToolEnabled: vi.fn(),
    getCustomMCPTools: vi.fn(),
  },
}));

// Mock console methods
const mockConsoleLog = vi.spyOn(console, "log").mockImplementation(() => {});
const mockConsoleError = vi
  .spyOn(console, "error")
  .mockImplementation(() => {});
const mockProcessExit = vi.spyOn(process, "exit").mockImplementation(() => {
  throw new Error("process.exit called");
});

describe("mcpCommands", () => {
  const mockSpinner = {
    start: vi.fn().mockReturnThis(),
    succeed: vi.fn().mockReturnThis(),
    fail: vi.fn().mockReturnThis(),
    warn: vi.fn().mockReturnThis(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    (ora as any).mockReturnValue(mockSpinner);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("listMcpServers", () => {
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
      await listMcpServers();

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
      await listMcpServers({ tools: true });

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

      await listMcpServers();

      expect(mockSpinner.warn).toHaveBeenCalledWith(
        "未配置任何 MCP 服务或 customMCP 工具"
      );
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining("提示: 使用 'xiaozhi config' 命令配置 MCP 服务")
      );
    });

    it("应该处理没有工具的服务", async () => {
      (configManager.getServerToolsConfig as any).mockReturnValue({});

      await listMcpServers({ tools: true });

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining("暂未识别到相关工具")
      );
    });

    it("应该优雅地处理错误", async () => {
      (configManager.getMcpServers as any).mockImplementation(() => {
        throw new Error("Config error");
      });

      await expect(async () => {
        await listMcpServers();
      }).rejects.toThrow("process.exit called");

      expect(mockSpinner.fail).toHaveBeenCalledWith("获取 MCP 服务列表失败");
      expect(mockConsoleError).toHaveBeenCalledWith(
        expect.stringContaining("错误: Config error")
      );
      expect(mockProcessExit).toHaveBeenCalledWith(1);
    });
  });

  describe("listServerTools", () => {
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
      await listServerTools("datetime");

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

      await listServerTools("non-existent");

      expect(mockSpinner.fail).toHaveBeenCalledWith(
        "服务 'non-existent' 不存在"
      );
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining(
          "提示: 使用 'xiaozhi mcp list' 查看所有可用服务"
        )
      );
    });

    it("应该处理没有工具的服务", async () => {
      (configManager.getServerToolsConfig as any).mockReturnValue({});

      await listServerTools("datetime");

      expect(mockSpinner.warn).toHaveBeenCalledWith(
        "服务 'datetime' 暂无工具信息"
      );
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining("提示: 请先启动服务以扫描工具列表")
      );
    });

    it("应该优雅地处理错误", async () => {
      (configManager.getMcpServers as any).mockImplementation(() => {
        throw new Error("Config error");
      });

      await expect(async () => {
        await listServerTools("datetime");
      }).rejects.toThrow("process.exit called");

      expect(mockSpinner.fail).toHaveBeenCalledWith("获取工具列表失败");
      expect(mockConsoleError).toHaveBeenCalledWith(
        expect.stringContaining("错误: Config error")
      );
      expect(mockProcessExit).toHaveBeenCalledWith(1);
    });
  });

  describe("setToolEnabled", () => {
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
      await setToolEnabled("datetime", "get_current_time", true);

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
      await setToolEnabled("datetime", "get_current_time", false);

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

      await setToolEnabled("non-existent", "tool", true);

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

      await setToolEnabled("datetime", "non-existent-tool", true);

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
        await setToolEnabled("datetime", "tool", true);
      }).rejects.toThrow("process.exit called");

      expect(mockSpinner.fail).toHaveBeenCalledWith("启用工具失败");
      expect(mockConsoleError).toHaveBeenCalledWith(
        expect.stringContaining("错误: Config error")
      );
      expect(mockProcessExit).toHaveBeenCalledWith(1);
    });

    it("应该优雅地处理禁用工具时的错误", async () => {
      (configManager.getMcpServers as any).mockImplementation(() => {
        throw new Error("Config error");
      });

      await expect(async () => {
        await setToolEnabled("datetime", "tool", false);
      }).rejects.toThrow("process.exit called");

      expect(mockSpinner.fail).toHaveBeenCalledWith("禁用工具失败");
      expect(mockConsoleError).toHaveBeenCalledWith(
        expect.stringContaining("错误: Config error")
      );
      expect(mockProcessExit).toHaveBeenCalledWith(1);
    });
  });

  describe("边界情况和错误处理", () => {
    it("应该处理非常长的工具描述", async () => {
      const longDescription = "A".repeat(100);
      const mockToolsConfig = {
        "long-desc-tool": {
          description: longDescription,
          enable: true,
        },
      };

      (configManager.getMcpServers as any).mockReturnValue({
        "test-server": {},
      });
      (configManager.getServerToolsConfig as any).mockReturnValue(
        mockToolsConfig
      );

      await listServerTools("test-server");

      expect(mockSpinner.succeed).toHaveBeenCalled();
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining("long-desc-tool")
      );
    });

    it("应该处理名称中包含特殊字符的服务", async () => {
      const specialServerName = "test-server_with.special-chars";
      const mockServers = {
        [specialServerName]: {
          command: "node",
          args: ["test.js"],
        },
      };

      (configManager.getMcpServers as any).mockReturnValue(mockServers);
      (configManager.getServerToolsConfig as any).mockReturnValue({});

      await listMcpServers();

      expect(mockSpinner.succeed).toHaveBeenCalledWith("找到 1 个 MCP 服务");
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining(specialServerName)
      );
    });

    it("应该处理混合启用/禁用工具的显示", async () => {
      const mockServers = {
        "mixed-server": {
          command: "node",
          args: ["test.js"],
        },
      };

      const mockServerConfig = {
        "mixed-server": {
          tools: {
            "enabled-tool": {
              description: "已启用的工具",
              enable: true,
            },
            "disabled-tool": {
              description: "已禁用的工具",
              enable: false,
            },
            "another-enabled": {
              description: "另一个已启用的工具",
              enable: true,
            },
          },
        },
      };

      (configManager.getMcpServers as any).mockReturnValue(mockServers);
      (configManager.getMcpServerConfig as any).mockReturnValue(
        mockServerConfig
      );
      (configManager.getServerToolsConfig as any).mockImplementation(
        (serverName: string) => {
          return (mockServerConfig as any)[serverName]?.tools || {};
        }
      );

      await listMcpServers({ tools: true });

      expect(mockSpinner.succeed).toHaveBeenCalledWith("找到 1 个 MCP 服务");
      // 检查表格输出中包含工具名称（现在只显示工具名，不包含服务名前缀）
      const enabledToolOutput = mockConsoleLog.mock.calls.find(
        (call) =>
          call[0] &&
          typeof call[0] === "string" &&
          call[0].includes("enabled-tool")
      );
      expect(enabledToolOutput).toBeDefined();

      const disabledToolOutput = mockConsoleLog.mock.calls.find(
        (call) =>
          call[0] &&
          typeof call[0] === "string" &&
          call[0].includes("disabled-tool")
      );
      expect(disabledToolOutput).toBeDefined();
    });
  });

  describe("字符串宽度计算和截断工具", () => {
    describe("getDisplayWidth", () => {
      it("应该正确计算英文字符的宽度", () => {
        expect(getDisplayWidth("hello")).toBe(5);
        expect(getDisplayWidth("Hello World!")).toBe(12);
        expect(getDisplayWidth("")).toBe(0);
      });

      it("应该正确计算中文字符的宽度", () => {
        expect(getDisplayWidth("你好")).toBe(4); // 2个中文字符 = 4宽度
        expect(getDisplayWidth("中文测试")).toBe(8); // 4个中文字符 = 8宽度
        expect(getDisplayWidth("测试")).toBe(4); // 2个中文字符 = 4宽度
      });

      it("应该正确计算混合字符的宽度", () => {
        expect(getDisplayWidth("Hello你好")).toBe(9); // 5个英文 + 2个中文 = 5 + 4 = 9
        expect(getDisplayWidth("测试Test")).toBe(8); // 2个中文 + 4个英文 = 4 + 4 = 8
        expect(getDisplayWidth("中文English混合")).toBe(15); // 2个中文 + 7个英文 + 2个中文 = 4 + 7 + 4 = 15
      });

      it("应该正确处理中文标点符号", () => {
        expect(getDisplayWidth("你好，世界！")).toBe(12); // 4个中文字符 + 2个中文标点 = 12
        expect(getDisplayWidth("测试：成功")).toBe(10); // 4个中文字符 + 1个中文冒号 = 10
      });

      it("应该处理特殊字符", () => {
        expect(getDisplayWidth("test@example.com")).toBe(16);
        expect(getDisplayWidth("123-456-789")).toBe(11);
      });
    });

    describe("truncateToWidth", () => {
      it("应该不截断宽度限制内的字符串", () => {
        expect(truncateToWidth("hello", 10)).toBe("hello");
        expect(truncateToWidth("你好", 10)).toBe("你好");
        expect(truncateToWidth("Hello你好", 10)).toBe("Hello你好");
      });

      it("应该正确截断英文字符串", () => {
        expect(truncateToWidth("Hello World", 8)).toBe("Hello...");
        expect(truncateToWidth("This is a very long description", 15)).toBe(
          "This is a ve..."
        );
      });

      it("应该正确截断中文字符串", () => {
        // "这是一个很长的描述文本" = 16宽度, maxWidth=10, 所以 "这是一..." = 7宽度
        expect(truncateToWidth("这是一个很长的描述文本", 10)).toBe("这是一...");
        // "中文测试内容" = 10宽度, maxWidth=6, 所以 "中..." = 5宽度
        expect(truncateToWidth("中文测试内容", 6)).toBe("中...");
      });

      it("应该正确截断混合字符串", () => {
        // "Hello你好World" = 13宽度, maxWidth=10, 所以 "Hello你..." = 10宽度
        expect(truncateToWidth("Hello你好World", 10)).toBe("Hello你...");
        // "测试Test内容" = 12宽度, maxWidth=8, 所以 "测试T..." = 8宽度
        expect(truncateToWidth("测试Test内容", 8)).toBe("测试T...");
      });

      it("应该处理边界情况", () => {
        expect(truncateToWidth("", 10)).toBe("");
        expect(truncateToWidth("a", 1)).toBe("a");
        expect(truncateToWidth("ab", 1)).toBe(""); // 连一个字符 + "..." 都放不下
      });

      it("应该处理非常短的宽度限制", () => {
        expect(truncateToWidth("hello", 3)).toBe(""); // maxWidth <= 3, 返回空字符串
        expect(truncateToWidth("hello", 4)).toBe("h...");
        expect(truncateToWidth("你好", 4)).toBe("你好"); // "你好" 宽度=4, 正好符合 maxWidth=4
        expect(truncateToWidth("你好世界", 4)).toBe(""); // "你好世界" 宽度=8 > 4, 但连一个字符 + "..." 都放不下
        expect(truncateToWidth("你好", 5)).toBe("你好"); // "你好" 宽度=4 <= maxWidth=5, 不需要截断
        expect(truncateToWidth("你好世界", 5)).toBe("你...");
      });

      it("应该处理正好20个中文字符宽度（40显示宽度）", () => {
        const longChinese =
          "这是一个非常长的中文描述内容用来测试截断功能是否正常工作";
        const result = truncateToWidth(longChinese, 40);
        expect(getDisplayWidth(result)).toBeLessThanOrEqual(40);
        expect(result.endsWith("...")).toBe(true);
      });
    });
  });

  describe("使用cli-table3的表格显示", () => {
    it("应该使用cli-table3显示带MCP列的工具表格", async () => {
      const mockServers = {
        "test-server": {
          command: "node",
          args: ["test.js"],
        },
      };

      const mockToolsConfig = {
        "test-tool": {
          description: "这是一个测试工具的描述信息，用来验证表格显示功能",
          enable: true,
        },
        "another-tool": {
          description: "另一个测试工具的英文描述",
          enable: false,
        },
      };

      (configManager.getMcpServers as any).mockReturnValue(mockServers);
      (configManager.getServerToolsConfig as any).mockReturnValue(
        mockToolsConfig
      );

      await listMcpServers({ tools: true });

      expect(mockSpinner.succeed).toHaveBeenCalledWith("找到 1 个 MCP 服务");
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining("MCP 服务工具列表:")
      );
    });

    it("应该显示正确列的表格：MCP | 工具名称 | 状态 | 描述", async () => {
      const mockServers = {
        "test-server": {
          command: "node",
          args: ["test.js"],
        },
        "another-server": {
          command: "python",
          args: ["server.py"],
        },
      };

      const mockToolsConfigServer1 = {
        tool1: {
          description: "测试工具1",
          enable: true,
        },
      };

      const mockToolsConfigServer2 = {
        tool2: {
          description: "测试工具2",
          enable: false,
        },
      };

      (configManager.getMcpServers as any).mockReturnValue(mockServers);
      (configManager.getServerToolsConfig as any)
        .mockReturnValueOnce(mockToolsConfigServer1)
        .mockReturnValueOnce(mockToolsConfigServer2);

      await listMcpServers({ tools: true });

      expect(mockSpinner.succeed).toHaveBeenCalledWith("找到 2 个 MCP 服务");
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining("MCP 服务工具列表:")
      );
    });

    it("应该正确处理没有工具的服务", async () => {
      const mockServers = {
        "empty-server": {
          command: "node",
          args: ["empty.js"],
        },
      };

      const mockToolsConfig = {};

      (configManager.getMcpServers as any).mockReturnValue(mockServers);
      (configManager.getServerToolsConfig as any).mockReturnValue(
        mockToolsConfig
      );

      await listMcpServers({ tools: true });

      expect(mockSpinner.succeed).toHaveBeenCalledWith("找到 1 个 MCP 服务");
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining("MCP 服务工具列表:")
      );
      // 表格输出应该为没有工具的服务显示"暂未识别到相关工具"
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringMatching(/暂未识别到相关工具/)
      );
    });

    it("应该在表格显示中处理长描述", async () => {
      const longDescription =
        "这是一个非常非常长的工具描述信息，包含了很多中文字符，用来测试表格显示时的截断功能是否能够正常工作，确保表格对齐不会出现问题";

      const mockServers = {
        "long-desc-server": {
          command: "node",
          args: ["test.js"],
        },
      };

      const mockToolsConfig = {
        "long-desc-tool": {
          description: longDescription,
          enable: true,
        },
      };

      (configManager.getMcpServers as any).mockReturnValue(mockServers);
      (configManager.getServerToolsConfig as any).mockReturnValue(
        mockToolsConfig
      );

      await listServerTools("long-desc-server");

      expect(mockSpinner.succeed).toHaveBeenCalled();
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining("long-desc-server 服务工具列表:")
      );
    });

    it("应该根据最长工具名称动态调整列宽", async () => {
      const mockServers = {
        "test-server": {
          command: "node",
          args: ["test.js"],
        },
      };

      const mockToolsConfig = {
        short: {
          description: "短工具名",
          enable: true,
        },
        very_long_tool_name_that_should_determine_column_width: {
          description: "非常长的工具名称，应该决定列宽",
          enable: true,
        },
        medium_length_tool: {
          description: "中等长度工具名",
          enable: false,
        },
      };

      (configManager.getMcpServers as any).mockReturnValue(mockServers);
      (configManager.getServerToolsConfig as any).mockReturnValue(
        mockToolsConfig
      );

      await listMcpServers({ tools: true });

      expect(mockSpinner.succeed).toHaveBeenCalledWith("找到 1 个 MCP 服务");
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining("MCP 服务工具列表:")
      );

      // 验证表格输出包含工具名称（检查较短的名称，因为长名称可能被截断）
      const shortToolOutput = mockConsoleLog.mock.calls.find(
        (call) =>
          call[0] && typeof call[0] === "string" && call[0].includes("short")
      );
      expect(shortToolOutput).toBeDefined();

      const mediumToolOutput = mockConsoleLog.mock.calls.find(
        (call) =>
          call[0] &&
          typeof call[0] === "string" &&
          call[0].includes("medium_length_tool")
      );
      expect(mediumToolOutput).toBeDefined();
    });

    it("应该确保工具名称列有最小宽度", async () => {
      const mockServers = {
        "test-server": {
          command: "node",
          args: ["test.js"],
        },
      };

      const mockToolsConfig = {
        a: {
          description: "单字符工具名",
          enable: true,
        },
        bb: {
          description: "双字符工具名",
          enable: true,
        },
      };

      (configManager.getMcpServers as any).mockReturnValue(mockServers);
      (configManager.getServerToolsConfig as any).mockReturnValue(
        mockToolsConfig
      );

      await listMcpServers({ tools: true });

      expect(mockSpinner.succeed).toHaveBeenCalledWith("找到 1 个 MCP 服务");
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining("MCP 服务工具列表:")
      );

      // 即使工具名很短，也应该有合理的列宽显示
      const tableOutput = mockConsoleLog.mock.calls.find(
        (call) =>
          call[0] && typeof call[0] === "string" && call[0].includes("a")
      );
      expect(tableOutput).toBeDefined();
    });
  });
});

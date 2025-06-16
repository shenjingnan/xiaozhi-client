import chalk from "chalk";
import ora from "ora";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { configManager } from "./configManager.js";
import {
  getDisplayWidth,
  listMcpServers,
  listServerTools,
  setToolEnabled,
  truncateToWidth,
} from "./mcpCommands.js";

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

vi.mock("./configManager.js", () => ({
  configManager: {
    getMcpServers: vi.fn(),
    getMcpServerConfig: vi.fn(),
    getServerToolsConfig: vi.fn(),
    setToolEnabled: vi.fn(),
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
            description: "Mathematical calculation tool",
            enable: true,
          },
        },
      },
      datetime: {
        tools: {
          get_current_time: {
            description: "Get current time",
            enable: true,
          },
          get_current_date: {
            description: "Get current date",
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
          return mockServerConfig[serverName]?.tools || {};
        }
      );
    });

    it("should list servers without tools option", async () => {
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

    it("should list servers with tools option using cli-table3", async () => {
      await listMcpServers({ tools: true });

      expect(mockSpinner.succeed).toHaveBeenCalledWith("找到 2 个 MCP 服务");
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining("MCP 服务工具列表:")
      );
      // Check for table output with tool names in new format
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringMatching(/calculator_calculator/)
      );
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringMatching(/datetime_get_current_time/)
      );
    });

    it("should handle empty servers list", async () => {
      (configManager.getMcpServers as any).mockReturnValue({});

      await listMcpServers();

      expect(mockSpinner.warn).toHaveBeenCalledWith("未配置任何 MCP 服务");
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining("提示: 使用 'xiaozhi config' 命令配置 MCP 服务")
      );
    });

    it("should handle servers with no tools", async () => {
      (configManager.getServerToolsConfig as any).mockReturnValue({});

      await listMcpServers({ tools: true });

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining("(无工具)")
      );
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining("请先启动服务扫描工具")
      );
    });

    it("should handle errors gracefully", async () => {
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
        description: "Get current time",
        enable: true,
      },
      get_current_date: {
        description: "Get current date",
        enable: false,
      },
    };

    beforeEach(() => {
      (configManager.getMcpServers as any).mockReturnValue(mockServers);
      (configManager.getServerToolsConfig as any).mockReturnValue(
        mockToolsConfig
      );
    });

    it("should list tools for existing server", async () => {
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

    it("should handle non-existent server", async () => {
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

    it("should handle server with no tools", async () => {
      (configManager.getServerToolsConfig as any).mockReturnValue({});

      await listServerTools("datetime");

      expect(mockSpinner.warn).toHaveBeenCalledWith(
        "服务 'datetime' 暂无工具信息"
      );
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining("提示: 请先启动服务以扫描工具列表")
      );
    });

    it("should handle errors gracefully", async () => {
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
        description: "Get current time",
        enable: true,
      },
    };

    beforeEach(() => {
      (configManager.getMcpServers as any).mockReturnValue(mockServers);
      (configManager.getServerToolsConfig as any).mockReturnValue(
        mockToolsConfig
      );
    });

    it("should enable tool successfully", async () => {
      await setToolEnabled("datetime", "get_current_time", true);

      expect(mockSpinner.succeed).toHaveBeenCalledWith(
        expect.stringContaining("成功启用工具")
      );
      expect(configManager.setToolEnabled).toHaveBeenCalledWith(
        "datetime",
        "get_current_time",
        true,
        "Get current time"
      );
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining("提示: 工具状态更改将在下次启动服务时生效")
      );
    });

    it("should disable tool successfully", async () => {
      await setToolEnabled("datetime", "get_current_time", false);

      expect(mockSpinner.succeed).toHaveBeenCalledWith(
        expect.stringContaining("成功禁用工具")
      );
      expect(configManager.setToolEnabled).toHaveBeenCalledWith(
        "datetime",
        "get_current_time",
        false,
        "Get current time"
      );
    });

    it("should handle non-existent server", async () => {
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

    it("should handle non-existent tool", async () => {
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

    it("should handle errors gracefully", async () => {
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

    it("should handle disable action errors gracefully", async () => {
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

  describe("Edge cases and error handling", () => {
    it("should handle very long tool descriptions", async () => {
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

    it("should handle servers with special characters in names", async () => {
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

    it("should handle mixed enabled/disabled tools display", async () => {
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
              description: "Enabled tool",
              enable: true,
            },
            "disabled-tool": {
              description: "Disabled tool",
              enable: false,
            },
            "another-enabled": {
              description: "Another enabled tool",
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
          return mockServerConfig[serverName]?.tools || {};
        }
      );

      await listMcpServers({ tools: true });

      expect(mockSpinner.succeed).toHaveBeenCalledWith("找到 1 个 MCP 服务");
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining("enabled-tool")
      );
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining("disabled-tool")
      );
    });
  });

  describe("String width calculation and truncation utilities", () => {
    describe("getDisplayWidth", () => {
      it("should calculate width correctly for English characters", () => {
        expect(getDisplayWidth("hello")).toBe(5);
        expect(getDisplayWidth("Hello World!")).toBe(12);
        expect(getDisplayWidth("")).toBe(0);
      });

      it("should calculate width correctly for Chinese characters", () => {
        expect(getDisplayWidth("你好")).toBe(4); // 2 Chinese chars = 4 width
        expect(getDisplayWidth("中文测试")).toBe(8); // 4 Chinese chars = 8 width
        expect(getDisplayWidth("测试")).toBe(4); // 2 Chinese chars = 4 width
      });

      it("should calculate width correctly for mixed characters", () => {
        expect(getDisplayWidth("Hello你好")).toBe(9); // 5 English + 2 Chinese = 5 + 4 = 9
        expect(getDisplayWidth("测试Test")).toBe(8); // 2 Chinese + 4 English = 4 + 4 = 8
        expect(getDisplayWidth("中文English混合")).toBe(15); // 2 Chinese + 7 English + 2 Chinese = 4 + 7 + 4 = 15
      });

      it("should handle Chinese punctuation correctly", () => {
        expect(getDisplayWidth("你好，世界！")).toBe(12); // 4 Chinese chars + 2 Chinese punctuation = 12
        expect(getDisplayWidth("测试：成功")).toBe(10); // 4 Chinese chars + 1 Chinese colon = 10
      });

      it("should handle special characters", () => {
        expect(getDisplayWidth("test@example.com")).toBe(16);
        expect(getDisplayWidth("123-456-789")).toBe(11);
      });
    });

    describe("truncateToWidth", () => {
      it("should not truncate strings within width limit", () => {
        expect(truncateToWidth("hello", 10)).toBe("hello");
        expect(truncateToWidth("你好", 10)).toBe("你好");
        expect(truncateToWidth("Hello你好", 10)).toBe("Hello你好");
      });

      it("should truncate English strings correctly", () => {
        expect(truncateToWidth("Hello World", 8)).toBe("Hello...");
        expect(truncateToWidth("This is a very long description", 15)).toBe(
          "This is a ve..."
        );
      });

      it("should truncate Chinese strings correctly", () => {
        // "这是一个很长的描述文本" = 16 width, maxWidth=10, so "这是一..." = 7 width
        expect(truncateToWidth("这是一个很长的描述文本", 10)).toBe("这是一...");
        // "中文测试内容" = 10 width, maxWidth=6, so "中..." = 5 width
        expect(truncateToWidth("中文测试内容", 6)).toBe("中...");
      });

      it("should truncate mixed strings correctly", () => {
        // "Hello你好World" = 13 width, maxWidth=10, so "Hello你..." = 10 width
        expect(truncateToWidth("Hello你好World", 10)).toBe("Hello你...");
        // "测试Test内容" = 12 width, maxWidth=8, so "测试T..." = 8 width
        expect(truncateToWidth("测试Test内容", 8)).toBe("测试T...");
      });

      it("should handle edge cases", () => {
        expect(truncateToWidth("", 10)).toBe("");
        expect(truncateToWidth("a", 1)).toBe("a");
        expect(truncateToWidth("ab", 1)).toBe(""); // Can't fit even one char + "..."
      });

      it("should handle very short width limits", () => {
        expect(truncateToWidth("hello", 3)).toBe(""); // maxWidth <= 3, return empty
        expect(truncateToWidth("hello", 4)).toBe("h...");
        expect(truncateToWidth("你好", 4)).toBe("你好"); // "你好" width=4, exactly fits maxWidth=4
        expect(truncateToWidth("你好世界", 4)).toBe(""); // "你好世界" width=8 > 4, but can't fit even one char + "..."
        expect(truncateToWidth("你好", 5)).toBe("你好"); // "你好" width=4 <= maxWidth=5, no truncation needed
        expect(truncateToWidth("你好世界", 5)).toBe("你...");
      });

      it("should handle exactly 20 Chinese characters width (40 display width)", () => {
        const longChinese =
          "这是一个非常长的中文描述内容用来测试截断功能是否正常工作";
        const result = truncateToWidth(longChinese, 40);
        expect(getDisplayWidth(result)).toBeLessThanOrEqual(40);
        expect(result.endsWith("...")).toBe(true);
      });
    });
  });

  describe("Table display with cli-table3", () => {
    it("should use cli-table3 for tools display", async () => {
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
          description: "Another test tool with English description",
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
      // The table output should contain the tool names and truncated descriptions
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringMatching(/test-server_test-tool/)
      );
    });

    it("should handle long descriptions in table display", async () => {
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
  });
});

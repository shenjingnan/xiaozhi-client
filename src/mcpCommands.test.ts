import chalk from "chalk";
import ora from "ora";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { configManager } from "./configManager.js";
import {
  listMcpServers,
  listServerTools,
  setToolEnabled,
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

    it("should list servers with tools option", async () => {
      await listMcpServers({ tools: true });

      expect(mockSpinner.succeed).toHaveBeenCalledWith("找到 2 个 MCP 服务");
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining("MCP 服务工具列表:")
      );
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining("服务名称")
      );
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining("工具名称")
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
});

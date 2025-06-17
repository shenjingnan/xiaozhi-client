import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { setupAutoCompletion, showCompletionHelp } from "./autoCompletion";
import { configManager } from "./configManager";

// Mock configManager
vi.mock("./configManager", () => ({
  configManager: {
    configExists: vi.fn(),
    getMcpServers: vi.fn(),
    getServerToolsConfig: vi.fn(),
  },
}));

// Mock omelette
const mockOmelette = {
  on: vi.fn(),
  init: vi.fn(),
  setupShellInitFile: vi.fn(),
};

vi.mock("omelette", () => ({
  default: vi.fn(() => mockOmelette),
}));

describe("autoCompletion", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // 设置默认的mock返回值
    (configManager.configExists as any).mockReturnValue(true);
    (configManager.getMcpServers as any).mockReturnValue({
      calculator: {
        command: "node",
        args: ["calculator.js"],
      },
      datetime: {
        command: "node",
        args: ["datetime.js"],
      },
    });
    (configManager.getServerToolsConfig as any).mockImplementation(
      (serverName: string) => {
        if (serverName === "calculator") {
          return {
            calculator: {
              description: "数学计算工具",
              enable: true,
            },
          };
        }
        if (serverName === "datetime") {
          return {
            get_current_time: {
              description: "获取当前时间",
              enable: true,
            },
            get_current_date: {
              description: "获取当前日期",
              enable: false,
            },
          };
        }
        return {};
      }
    );
  });

  describe("setupAutoCompletion", () => {
    it("应该正确初始化omelette", () => {
      setupAutoCompletion();

      expect(mockOmelette.on).toHaveBeenCalledWith(
        "complete",
        expect.any(Function)
      );
      expect(mockOmelette.init).toHaveBeenCalled();
    });

    it("应该正确处理主命令补全", () => {
      setupAutoCompletion();

      // 获取complete事件的回调函数
      const completeCallback = (mockOmelette.on as any).mock.calls.find(
        (call: any) => call[0] === "complete"
      )[1];

      const mockReply = vi.fn();

      // 测试主命令补全
      completeCallback(undefined, {
        line: "xiaozhi m",
        before: "m",
        reply: mockReply,
      });

      expect(mockReply).toHaveBeenCalledWith(["mcp"]);
    });

    it("应该正确处理MCP子命令补全", () => {
      setupAutoCompletion();

      const completeCallback = (mockOmelette.on as any).mock.calls.find(
        (call: any) => call[0] === "complete"
      )[1];

      const mockReply = vi.fn();

      // 测试MCP子命令补全
      completeCallback(undefined, {
        line: "xiaozhi mcp ",
        before: "mcp",
        reply: mockReply,
      });

      expect(mockReply).toHaveBeenCalledWith(["list", "server", "tool"]);
    });

    it("应该正确处理MCP服务器名称补全", () => {
      setupAutoCompletion();

      const completeCallback = (mockOmelette.on as any).mock.calls.find(
        (call: any) => call[0] === "complete"
      )[1];

      const mockReply = vi.fn();

      // 测试服务器名称补全
      completeCallback(undefined, {
        line: "xiaozhi mcp tool ",
        before: "tool",
        reply: mockReply,
      });

      expect(mockReply).toHaveBeenCalledWith(["calculator", "datetime"]);
    });

    it("应该正确处理工具名称补全", () => {
      setupAutoCompletion();

      const completeCallback = (mockOmelette.on as any).mock.calls.find(
        (call: any) => call[0] === "complete"
      )[1];

      const mockReply = vi.fn();

      // 测试工具名称补全
      completeCallback(undefined, {
        line: "xiaozhi mcp tool datetime ",
        before: "datetime",
        reply: mockReply,
      });

      expect(mockReply).toHaveBeenCalledWith([
        "get_current_time",
        "get_current_date",
      ]);
    });

    it("应该正确处理enable/disable补全", () => {
      setupAutoCompletion();

      const completeCallback = (mockOmelette.on as any).mock.calls.find(
        (call: any) => call[0] === "complete"
      )[1];

      const mockReply = vi.fn();

      // 测试enable/disable补全
      completeCallback(undefined, {
        line: "xiaozhi mcp tool datetime get_current_time ",
        before: "get_current_time",
        reply: mockReply,
      });

      expect(mockReply).toHaveBeenCalledWith(["enable", "disable"]);
    });

    it("应该正确处理部分匹配", () => {
      setupAutoCompletion();

      const completeCallback = (mockOmelette.on as any).mock.calls.find(
        (call: any) => call[0] === "complete"
      )[1];

      const mockReply = vi.fn();

      // 测试部分匹配
      completeCallback(undefined, {
        line: "xiaozhi mcp l",
        before: "l",
        reply: mockReply,
      });

      expect(mockReply).toHaveBeenCalledWith(["list"]);
    });

    it("应该处理配置不存在的情况", () => {
      (configManager.configExists as any).mockReturnValue(false);

      setupAutoCompletion();

      const completeCallback = (mockOmelette.on as any).mock.calls.find(
        (call: any) => call[0] === "complete"
      )[1];

      const mockReply = vi.fn();

      // 测试配置不存在时的服务器名称补全
      completeCallback(undefined, {
        line: "xiaozhi mcp tool ",
        before: "tool",
        reply: mockReply,
      });

      expect(mockReply).toHaveBeenCalledWith([]);
    });
  });

  describe("showCompletionHelp", () => {
    it("应该显示自动补全设置说明", () => {
      const mockConsoleLog = vi
        .spyOn(console, "log")
        .mockImplementation(() => {});

      showCompletionHelp();

      expect(mockConsoleLog).toHaveBeenCalledWith("🚀 xiaozhi 自动补全设置");
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining(
          "xiaozhi --completion >> ~/.xiaozhi-completion.zsh"
        )
      );
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining("source ~/.xiaozhi-completion.zsh")
      );
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining("xiaozhi m<Tab>")
      );

      mockConsoleLog.mockRestore();
    });
  });

  describe("自动补全脚本生成", () => {
    let originalArgv: string[];
    let mockConsoleLog: any;
    let mockProcessExit: any;

    beforeEach(() => {
      originalArgv = [...process.argv];
      mockConsoleLog = vi.spyOn(console, "log").mockImplementation(() => {});
      mockProcessExit = vi.spyOn(process, "exit").mockImplementation(() => {
        throw new Error("process.exit called");
      });
    });

    afterEach(() => {
      process.argv = originalArgv;
      mockConsoleLog.mockRestore();
      mockProcessExit.mockRestore();
    });

    it("应该在--completion参数时输出补全脚本", () => {
      process.argv = ["node", "xiaozhi", "--completion"];

      expect(() => setupAutoCompletion()).toThrow("process.exit called");
      expect(mockOmelette.setupShellInitFile).toHaveBeenCalledWith();
      expect(mockConsoleLog).toHaveBeenCalled();
      expect(mockProcessExit).toHaveBeenCalledWith(0);
    });

    it("应该在--completion-fish参数时输出Fish补全脚本", () => {
      process.argv = ["node", "xiaozhi", "--completion-fish"];

      expect(() => setupAutoCompletion()).toThrow("process.exit called");
      expect(mockOmelette.setupShellInitFile).toHaveBeenCalledWith("fish");
      expect(mockConsoleLog).toHaveBeenCalled();
      expect(mockProcessExit).toHaveBeenCalledWith(0);
    });

    it("应该正确处理--compzsh和--compbash参数", () => {
      process.argv = ["node", "xiaozhi", "--compzsh"];

      // 这些参数不应该导致退出，而是让omelette处理
      setupAutoCompletion();
      expect(mockOmelette.init).toHaveBeenCalled();
    });
  });
});

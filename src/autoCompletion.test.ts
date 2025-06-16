import { beforeEach, describe, expect, it, vi } from "vitest";
import { setupAutoCompletion } from "./autoCompletion.js";
import { configManager } from "./configManager.js";

// Mock configManager
vi.mock("./configManager.js", () => ({
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
});

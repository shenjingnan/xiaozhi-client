import { Command } from "commander";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CommandRegistry } from "./index.js";

// Mock ServiceCommandHandler
const mockServiceCommandHandler = {
  execute: vi.fn(),
  getCommandDefinition: vi.fn().mockReturnValue({
    name: "start",
    description: "启动服务",
    options: [
      { flags: "-d, --daemon", description: "后台运行模式" },
      { flags: "-p, --port <port>", description: "指定端口" },
    ],
  }),
};

vi.mock("./ServiceCommandHandler.js", () => ({
  ServiceCommandHandler: vi
    .fn()
    .mockImplementation(() => mockServiceCommandHandler),
}));

// Mock ErrorHandler
vi.mock("../utils/ErrorHandler.js", () => ({
  ErrorHandler: {
    handle: vi.fn(),
  },
}));

describe("CommandRegistry - 传统服务命令", () => {
  let commandRegistry: CommandRegistry;
  let program: Command;

  beforeEach(() => {
    commandRegistry = new CommandRegistry();
    program = new Command();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("registerLegacyServiceCommands 注册传统服务命令", () => {
    it("应注册传统服务命令并正确解析选项", async () => {
      // 注册命令
      commandRegistry.registerLegacyServiceCommands(program);

      // 模拟命令执行
      const startCommand = program.commands.find(
        (cmd) => cmd.name() === "start"
      );
      expect(startCommand).toBeDefined();

      // 验证选项是否正确注册
      const options = startCommand!.options;
      expect(options.some((opt) => opt.flags === "-d, --daemon")).toBe(true);
      expect(options.some((opt) => opt.flags === "-p, --port <port>")).toBe(
        true
      );
    });

    it("应正确解析并传递 daemon 选项给处理器", async () => {
      commandRegistry.registerLegacyServiceCommands(program);

      // 模拟带有 --daemon 选项的命令执行
      const mockCommand = {
        opts: vi.fn().mockReturnValue({
          daemon: true,
          port: undefined,
        }),
      };

      // 获取注册的 start 命令
      const startCommand = program.commands.find(
        (cmd) => cmd.name() === "start"
      );
      const actionFn = startCommand!._actionHandler;

      // 模拟命令执行
      await actionFn.call(startCommand, mockCommand);

      // 验证选项被正确解析和传递
      expect(mockCommand.opts).toHaveBeenCalled();
      expect(mockServiceCommandHandler.execute).toHaveBeenCalledWith([], {
        daemon: true,
        port: undefined,
      });
    });

    it("应正确解析并传递多个选项给处理器", async () => {
      commandRegistry.registerLegacyServiceCommands(program);

      const mockCommand = {
        opts: vi.fn().mockReturnValue({
          daemon: true,
          port: "3000",
          ui: true,
        }),
      };

      const startCommand = program.commands.find(
        (cmd) => cmd.name() === "start"
      );
      const actionFn = startCommand!._actionHandler;

      await actionFn.call(startCommand, mockCommand);

      expect(mockServiceCommandHandler.execute).toHaveBeenCalledWith([], {
        daemon: true,
        port: "3000",
        ui: true,
      });
    });

    it("应处理无选项的命令执行", async () => {
      commandRegistry.registerLegacyServiceCommands(program);

      const mockCommand = {
        opts: vi.fn().mockReturnValue({}),
      };

      const startCommand = program.commands.find(
        (cmd) => cmd.name() === "start"
      );
      const actionFn = startCommand!._actionHandler;

      await actionFn.call(startCommand, mockCommand);

      expect(mockServiceCommandHandler.execute).toHaveBeenCalledWith([], {});
    });

    it("应处理带位置参数的命令执行", async () => {
      commandRegistry.registerLegacyServiceCommands(program);

      const mockCommand = {
        opts: vi.fn().mockReturnValue({
          daemon: true,
        }),
      };

      const startCommand = program.commands.find(
        (cmd) => cmd.name() === "start"
      );
      const actionFn = startCommand!._actionHandler;

      // 模拟带有位置参数的命令执行
      await actionFn.call(startCommand, "arg1", "arg2", mockCommand);

      expect(mockServiceCommandHandler.execute).toHaveBeenCalledWith(
        ["arg1", "arg2"],
        {
          daemon: true,
        }
      );
    });

    it("应处理命令执行期间的错误", async () => {
      const { ErrorHandler } = await import("../utils/ErrorHandler.js");
      const mockError = new Error("Test error");
      mockServiceCommandHandler.execute.mockRejectedValue(mockError);

      commandRegistry.registerLegacyServiceCommands(program);

      const mockCommand = {
        opts: vi.fn().mockReturnValue({}),
      };

      const startCommand = program.commands.find(
        (cmd) => cmd.name() === "start"
      );
      const actionFn = startCommand!._actionHandler;

      await actionFn.call(startCommand, mockCommand);

      expect(ErrorHandler.handle).toHaveBeenCalledWith(mockError);
    });
  });

  describe("选项解析边界情况", () => {
    it("应正确处理布尔标志", async () => {
      commandRegistry.registerLegacyServiceCommands(program);

      const mockCommand = {
        opts: vi.fn().mockReturnValue({
          daemon: true,
          verbose: false,
          help: undefined,
        }),
      };

      const startCommand = program.commands.find(
        (cmd) => cmd.name() === "start"
      );
      const actionFn = startCommand!._actionHandler;

      await actionFn.call(startCommand, mockCommand);

      expect(mockServiceCommandHandler.execute).toHaveBeenCalledWith([], {
        daemon: true,
        verbose: false,
        help: undefined,
      });
    });

    it("应正确处理字符串选项", async () => {
      commandRegistry.registerLegacyServiceCommands(program);

      const mockCommand = {
        opts: vi.fn().mockReturnValue({
          port: "8080",
          config: "/path/to/config",
          mode: "production",
        }),
      };

      const startCommand = program.commands.find(
        (cmd) => cmd.name() === "start"
      );
      const actionFn = startCommand!._actionHandler;

      await actionFn.call(startCommand, mockCommand);

      expect(mockServiceCommandHandler.execute).toHaveBeenCalledWith([], {
        port: "8080",
        config: "/path/to/config",
        mode: "production",
      });
    });
  });
});

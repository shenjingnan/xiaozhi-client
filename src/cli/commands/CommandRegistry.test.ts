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

describe("CommandRegistry - Legacy Service Commands", () => {
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

  describe("registerLegacyServiceCommands", () => {
    it("should register legacy service commands with correct option parsing", async () => {
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

    it("should correctly parse and pass daemon option to handler", async () => {
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

    it("should correctly parse and pass multiple options to handler", async () => {
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

    it("should handle command execution with no options", async () => {
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

    it("should handle command execution with positional arguments", async () => {
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

    it("should handle errors during command execution", async () => {
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

  describe("option parsing edge cases", () => {
    it("should handle boolean flags correctly", async () => {
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

    it("should handle string options correctly", async () => {
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

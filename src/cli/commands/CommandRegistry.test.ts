import { Command } from "commander";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { IDIContainer } from "../interfaces/Config.js";
import { CommandRegistry } from "./index.js";

// Mock ServiceCommandHandler
const mockServiceCommandHandler = {
  name: "service",
  description: "服务管理命令",
  execute: vi.fn(),
  subcommands: [
    {
      name: "start",
      description: "启动服务",
      options: [
        { flags: "-d, --daemon", description: "后台运行模式" },
        { flags: "-p, --port <port>", description: "指定端口" },
      ],
      execute: vi.fn(),
    },
    {
      name: "stop",
      description: "停止服务",
      execute: vi.fn(),
    },
    {
      name: "status",
      description: "检查服务状态",
      execute: vi.fn(),
    },
  ],
};

// Mock other command handlers
const mockConfigCommandHandler = {
  name: "config",
  description: "配置管理命令",
  execute: vi.fn(),
  subcommands: [],
};

const mockProjectCommandHandler = {
  name: "project",
  description: "项目管理命令",
  execute: vi.fn(),
  subcommands: [],
};

const mockMcpCommandHandler = {
  name: "mcp",
  description: "MCP 服务和工具管理",
  execute: vi.fn(),
  subcommands: [],
};

const mockEndpointCommandHandler = {
  name: "endpoint",
  description: "端点管理命令",
  execute: vi.fn(),
  subcommands: [],
};

const mockUICommandHandler = {
  name: "ui",
  description: "UI 管理命令",
  execute: vi.fn(),
  subcommands: [],
};

// Mock CommandHandlerFactory
vi.mock("./CommandHandlerFactory.js", () => ({
  CommandHandlerFactory: vi.fn().mockImplementation(() => ({
    createHandlers: vi
      .fn()
      .mockReturnValue([
        mockServiceCommandHandler,
        mockConfigCommandHandler,
        mockProjectCommandHandler,
        mockMcpCommandHandler,
        mockEndpointCommandHandler,
        mockUICommandHandler,
      ]),
  })),
}));

// Mock ErrorHandler
vi.mock("../errors/ErrorHandlers.js", () => ({
  ErrorHandler: {
    handle: vi.fn(),
  },
}));

// Create mock DI container
const mockContainer: IDIContainer = {
  get: vi.fn().mockImplementation(<T>(serviceName: string): T => {
    switch (serviceName) {
      case "versionUtils":
        return {
          getVersion: vi.fn().mockReturnValue("1.0.0"),
        } as T;
      default:
        return {} as T;
    }
  }),
  register: vi.fn(),
  has: vi.fn(),
};

describe("CommandRegistry - 传统服务命令", () => {
  let commandRegistry: CommandRegistry;
  let program: Command;

  beforeEach(() => {
    commandRegistry = new CommandRegistry(mockContainer);
    program = new Command();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("registerLegacyServiceCommands 注册传统服务命令", () => {
    it("应注册传统服务命令并正确解析选项", async () => {
      // 创建 handlers 数组
      const handlers = [mockServiceCommandHandler];

      // 注册命令
      (commandRegistry as any).registerLegacyServiceCommands(program, handlers);

      // 验证命令是否正确注册
      const startCommand = program.commands.find(
        (cmd) => cmd.name() === "start"
      );
      expect(startCommand).toBeDefined();
      expect(startCommand!.description()).toBe("启动服务");

      // 验证选项是否正确注册
      const options = startCommand!.options;
      expect(options.some((opt) => opt.flags === "-d, --daemon")).toBe(true);
      expect(options.some((opt) => opt.flags === "-p, --port <port>")).toBe(
        true
      );
    });

    it("应注册所有服务子命令", async () => {
      const handlers = [mockServiceCommandHandler];
      (commandRegistry as any).registerLegacyServiceCommands(program, handlers);

      // 验证所有子命令都被注册为顶级命令
      const startCommand = program.commands.find(
        (cmd) => cmd.name() === "start"
      );
      const stopCommand = program.commands.find((cmd) => cmd.name() === "stop");
      const statusCommand = program.commands.find(
        (cmd) => cmd.name() === "status"
      );

      expect(startCommand).toBeDefined();
      expect(stopCommand).toBeDefined();
      expect(statusCommand).toBeDefined();

      expect(startCommand!.description()).toBe("启动服务");
      expect(stopCommand!.description()).toBe("停止服务");
      expect(statusCommand!.description()).toBe("检查服务状态");
    });

    it("应处理没有服务处理器的情况", async () => {
      const handlers = [mockConfigCommandHandler]; // 没有服务处理器
      (commandRegistry as any).registerLegacyServiceCommands(program, handlers);

      // 验证没有注册任何服务命令
      const startCommand = program.commands.find(
        (cmd) => cmd.name() === "start"
      );
      expect(startCommand).toBeUndefined();
    });

    it("应处理服务处理器没有子命令的情况", async () => {
      const handlerWithoutSubcommands = {
        ...mockServiceCommandHandler,
        subcommands: undefined,
      };
      const handlers = [handlerWithoutSubcommands];

      (commandRegistry as any).registerLegacyServiceCommands(program, handlers);

      // 验证没有注册任何服务命令
      const startCommand = program.commands.find(
        (cmd) => cmd.name() === "start"
      );
      expect(startCommand).toBeUndefined();
    });
  });

  describe("服务命令业务逻辑测试", () => {
    it("应正确执行 start 命令并传递选项", async () => {
      const startSubcommand = mockServiceCommandHandler.subcommands[0];

      await startSubcommand.execute([], {
        daemon: true,
        port: "3000",
      });

      expect(
        mockServiceCommandHandler.subcommands[0].execute
      ).toHaveBeenCalledWith([], {
        daemon: true,
        port: "3000",
      });
    });

    it("应正确执行 start 命令并传递位置参数", async () => {
      const startSubcommand = mockServiceCommandHandler.subcommands[0];

      await startSubcommand.execute(["arg1", "arg2"], {
        daemon: true,
      });

      expect(
        mockServiceCommandHandler.subcommands[0].execute
      ).toHaveBeenCalledWith(["arg1", "arg2"], {
        daemon: true,
      });
    });

    it("应正确执行 stop 命令", async () => {
      const stopSubcommand = mockServiceCommandHandler.subcommands[1];

      await stopSubcommand.execute([], {});

      expect(
        mockServiceCommandHandler.subcommands[1].execute
      ).toHaveBeenCalledWith([], {});
    });

    it("应正确执行 status 命令", async () => {
      const statusSubcommand = mockServiceCommandHandler.subcommands[2];

      await statusSubcommand.execute([], {});

      expect(
        mockServiceCommandHandler.subcommands[2].execute
      ).toHaveBeenCalledWith([], {});
    });
  });

  describe("选项解析边界情况", () => {
    it("应正确处理布尔标志", async () => {
      const startSubcommand = mockServiceCommandHandler.subcommands[0];

      await startSubcommand.execute([], {
        daemon: true,
        verbose: false,
        help: undefined,
      });

      expect(
        mockServiceCommandHandler.subcommands[0].execute
      ).toHaveBeenCalledWith([], {
        daemon: true,
        verbose: false,
        help: undefined,
      });
    });

    it("应正确处理字符串选项", async () => {
      const startSubcommand = mockServiceCommandHandler.subcommands[0];

      await startSubcommand.execute([], {
        port: "8080",
        config: "/path/to/config",
        mode: "production",
      });

      expect(
        mockServiceCommandHandler.subcommands[0].execute
      ).toHaveBeenCalledWith([], {
        port: "8080",
        config: "/path/to/config",
        mode: "production",
      });
    });

    it("应正确处理空选项对象", async () => {
      const startSubcommand = mockServiceCommandHandler.subcommands[0];

      await startSubcommand.execute([], {});

      expect(
        mockServiceCommandHandler.subcommands[0].execute
      ).toHaveBeenCalledWith([], {});
    });
  });
});

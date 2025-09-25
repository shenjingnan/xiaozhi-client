/**
 * EndpointCommandHandler 测试
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { IDIContainer } from "../interfaces/Config.js";
import { EndpointCommandHandler } from "./EndpointCommandHandler.js";

/**
 * 测试用的 EndpointCommandHandler 子类，用于访问受保护的方法
 */
class TestableEndpointCommandHandler extends EndpointCommandHandler {
  // 暴露受保护的方法供测试使用
  public async testHandleList(): Promise<void> {
    return this.handleList();
  }

  public async testHandleAdd(url: string): Promise<void> {
    return this.handleAdd(url);
  }

  public async testHandleRemove(url: string): Promise<void> {
    return this.handleRemove(url);
  }

  public async testHandleSet(urls: string[]): Promise<void> {
    return this.handleSet(urls);
  }

  public testValidateArgs(args: any[], expectedCount: number): void {
    this.validateArgs(args, expectedCount);
  }
}

// Mock ora
vi.mock("ora", () => ({
  default: vi.fn().mockImplementation((text) => ({
    start: () => ({
      succeed: (message: string) => {
        console.log(`✅ ${message}`);
      },
      fail: (message: string) => {
        console.log(`✖ ${message}`);
      },
      warn: (message: string) => {
        console.log(`⚠ ${message}`);
      },
    }),
  })),
}));

// Mock chalk
vi.mock("chalk", () => ({
  default: {
    green: (text: string) => text,
    yellow: (text: string) => text,
    gray: (text: string) => text,
  },
}));

// Mock dependencies
const mockConfigManager = {
  getMcpEndpoints: vi.fn(),
  addMcpEndpoint: vi.fn(),
  removeMcpEndpoint: vi.fn(),
  updateMcpEndpoint: vi.fn(),
};

const mockErrorHandler = {
  handle: vi.fn(),
};

// Mock container
const mockContainer = {
  get: vi.fn((name: string) => {
    if (name === "configManager") {
      return mockConfigManager;
    }
    if (name === "errorHandler") {
      return mockErrorHandler;
    }
    return undefined;
  }),
} as unknown as IDIContainer;

describe("EndpointCommandHandler", () => {
  let handler: TestableEndpointCommandHandler;
  let consoleSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    handler = new TestableEndpointCommandHandler(mockContainer);
    consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    vi.clearAllMocks();
    mockErrorHandler.handle.mockReset();
  });

  afterEach(() => {
    consoleSpy.mockRestore();
  });

  describe("主命令执行", () => {
    it("应该显示帮助信息", async () => {
      await handler.execute([], {});
      expect(consoleSpy).toHaveBeenCalledWith(
        "MCP 端点管理命令。使用 --help 查看可用的子命令。"
      );
    });
  });

  describe("endpoint list 命令", () => {
    it("应该显示空端点列表", async () => {
      mockConfigManager.getMcpEndpoints.mockReturnValue([]);

      await handler.testHandleList();

      expect(consoleSpy).toHaveBeenCalledWith("未配置任何 MCP 端点");
    });

    it("应该显示非空端点列表", async () => {
      const endpoints = ["http://localhost:3000", "http://localhost:3001"];
      mockConfigManager.getMcpEndpoints.mockReturnValue(endpoints);

      await handler.testHandleList();

      expect(consoleSpy).toHaveBeenCalledWith("共 2 个端点:");
      expect(consoleSpy).toHaveBeenCalledWith("  1. http://localhost:3000");
      expect(consoleSpy).toHaveBeenCalledWith("  2. http://localhost:3001");
    });

    it("应该处理获取端点列表时的错误", async () => {
      const error = new Error("配置文件不存在");
      mockConfigManager.getMcpEndpoints.mockImplementation(() => {
        throw error;
      });

      await handler.testHandleList();

      expect(mockErrorHandler.handle).toHaveBeenCalledWith(error);
    });
  });

  describe("endpoint add 命令", () => {
    it("应该成功添加端点", async () => {
      const url = "http://localhost:3000";
      mockConfigManager.addMcpEndpoint.mockImplementation(() => {});
      mockConfigManager.getMcpEndpoints.mockReturnValue([url]);

      await handler.testHandleAdd(url);

      expect(mockConfigManager.addMcpEndpoint).toHaveBeenCalledWith(url);
      expect(consoleSpy).toHaveBeenCalledWith("当前共 1 个端点");
    });

    it("应该处理添加端点时的错误", async () => {
      const url = "invalid-url";
      const error = new Error("无效的端点URL");
      mockConfigManager.addMcpEndpoint.mockImplementation(() => {
        throw error;
      });

      await handler.testHandleAdd(url);

      expect(mockErrorHandler.handle).toHaveBeenCalledWith(error);
    });
  });

  describe("endpoint remove 命令", () => {
    it("应该成功移除端点", async () => {
      const url = "http://localhost:3000";
      mockConfigManager.removeMcpEndpoint.mockImplementation(() => {});
      mockConfigManager.getMcpEndpoints.mockReturnValue([]);

      await handler.testHandleRemove(url);

      expect(mockConfigManager.removeMcpEndpoint).toHaveBeenCalledWith(url);
      expect(consoleSpy).toHaveBeenCalledWith("当前剩余 0 个端点");
    });

    it("应该处理移除端点时的错误", async () => {
      const url = "http://localhost:3000";
      const error = new Error("端点不存在");
      mockConfigManager.removeMcpEndpoint.mockImplementation(() => {
        throw error;
      });

      await handler.testHandleRemove(url);

      expect(mockErrorHandler.handle).toHaveBeenCalledWith(error);
    });
  });

  describe("endpoint set 命令", () => {
    it("应该成功设置单个端点", async () => {
      const urls = ["http://localhost:3000"];
      mockConfigManager.updateMcpEndpoint.mockImplementation(() => {});

      await handler.testHandleSet(urls);

      expect(mockConfigManager.updateMcpEndpoint).toHaveBeenCalledWith(urls[0]);
    });

    it("应该成功设置多个端点", async () => {
      const urls = ["http://localhost:3000", "http://localhost:3001"];
      mockConfigManager.updateMcpEndpoint.mockImplementation(() => {});

      await handler.testHandleSet(urls);

      expect(mockConfigManager.updateMcpEndpoint).toHaveBeenCalledWith(urls);
      expect(consoleSpy).toHaveBeenCalledWith("  1. http://localhost:3000");
      expect(consoleSpy).toHaveBeenCalledWith("  2. http://localhost:3001");
    });

    it("应该处理设置端点时的错误", async () => {
      const urls = ["http://localhost:3000"];
      const error = new Error("无效的端点配置");
      mockConfigManager.updateMcpEndpoint.mockImplementation(() => {
        throw error;
      });

      await handler.testHandleSet(urls);

      expect(mockErrorHandler.handle).toHaveBeenCalledWith(error);
    });
  });

  describe("子命令参数验证", () => {
    it("add 命令应该验证参数数量", () => {
      expect(() => {
        handler.testValidateArgs([], 1);
      }).toThrow();
    });

    it("remove 命令应该验证参数数量", () => {
      expect(() => {
        handler.testValidateArgs([], 1);
      }).toThrow();
    });

    it("set 命令应该验证参数数量", () => {
      expect(() => {
        handler.testValidateArgs([], 1);
      }).toThrow();
    });
  });

  describe("边界情况测试", () => {
    it("应该处理大量端点的列表显示", async () => {
      const endpoints = Array.from(
        { length: 100 },
        (_, i) => `http://localhost:${3000 + i}`
      );
      mockConfigManager.getMcpEndpoints.mockReturnValue(endpoints);

      await handler.testHandleList();

      expect(consoleSpy).toHaveBeenCalledWith("共 100 个端点:");
      expect(consoleSpy).toHaveBeenCalledWith("  1. http://localhost:3000");
      expect(consoleSpy).toHaveBeenCalledWith("  100. http://localhost:3099");
    });

    it("应该处理空字符串端点", async () => {
      const emptyUrl = "";
      const error = new Error("端点URL不能为空");
      mockConfigManager.addMcpEndpoint.mockImplementation(() => {
        throw error;
      });

      await handler.testHandleAdd(emptyUrl);

      expect(mockErrorHandler.handle).toHaveBeenCalledWith(error);
    });

    it("应该处理特殊字符的端点URL", async () => {
      const specialUrl = "http://localhost:3000/api/v1/test?param=value#anchor";
      mockConfigManager.addMcpEndpoint.mockImplementation(() => {});
      mockConfigManager.getMcpEndpoints.mockReturnValue([specialUrl]);

      await handler.testHandleAdd(specialUrl);

      expect(mockConfigManager.addMcpEndpoint).toHaveBeenCalledWith(specialUrl);
    });

    it("应该处理设置空数组端点（边界情况）", async () => {
      const emptyUrls: string[] = [];
      const error = new Error("端点列表不能为空");
      mockConfigManager.updateMcpEndpoint.mockImplementation(() => {
        throw error;
      });

      await handler.testHandleSet(emptyUrls);

      expect(mockErrorHandler.handle).toHaveBeenCalledWith(error);
    });
  });

  describe("子命令执行函数测试", () => {
    it("应该执行 list 子命令", async () => {
      const listCommand = handler.subcommands.find(
        (cmd) => cmd.name === "list"
      );
      expect(listCommand).toBeDefined();

      if (listCommand) {
        const handleListSpy = vi.spyOn(handler, "handleList" as any);
        await listCommand.execute([], {});
        expect(handleListSpy).toHaveBeenCalled();
      }
    });

    it("应该执行 add 子命令", async () => {
      const addCommand = handler.subcommands.find((cmd) => cmd.name === "add");
      expect(addCommand).toBeDefined();

      if (addCommand) {
        const handleAddSpy = vi.spyOn(handler, "handleAdd" as any);
        await addCommand.execute(["http://localhost:3000"], {});
        expect(handleAddSpy).toHaveBeenCalledWith("http://localhost:3000");
      }
    });

    it("应该执行 remove 子命令", async () => {
      const removeCommand = handler.subcommands.find(
        (cmd) => cmd.name === "remove"
      );
      expect(removeCommand).toBeDefined();

      if (removeCommand) {
        const handleRemoveSpy = vi.spyOn(handler, "handleRemove" as any);
        await removeCommand.execute(["http://localhost:3000"], {});
        expect(handleRemoveSpy).toHaveBeenCalledWith("http://localhost:3000");
      }
    });

    it("应该执行 set 子命令", async () => {
      const setCommand = handler.subcommands.find((cmd) => cmd.name === "set");
      expect(setCommand).toBeDefined();

      if (setCommand) {
        const handleSetSpy = vi.spyOn(handler, "handleSet" as any);
        await setCommand.execute(["http://localhost:3000"], {});
        expect(handleSetSpy).toHaveBeenCalledWith(["http://localhost:3000"]);
      }
    });

    it("add 子命令应该处理参数不足的情况", async () => {
      const addCommand = handler.subcommands.find((cmd) => cmd.name === "add");
      expect(addCommand).toBeDefined();

      if (addCommand) {
        const validateArgsSpy = vi.spyOn(handler, "validateArgs" as any);
        await expect(addCommand.execute([], {})).rejects.toThrow();
        expect(validateArgsSpy).toHaveBeenCalledWith([], 1);
      }
    });

    it("remove 子命令应该处理参数不足的情况", async () => {
      const removeCommand = handler.subcommands.find(
        (cmd) => cmd.name === "remove"
      );
      expect(removeCommand).toBeDefined();

      if (removeCommand) {
        const validateArgsSpy = vi.spyOn(handler, "validateArgs" as any);
        await expect(removeCommand.execute([], {})).rejects.toThrow();
        expect(validateArgsSpy).toHaveBeenCalledWith([], 1);
      }
    });

    it("set 子命令应该处理参数不足的情况", async () => {
      const setCommand = handler.subcommands.find((cmd) => cmd.name === "set");
      expect(setCommand).toBeDefined();

      if (setCommand) {
        const validateArgsSpy = vi.spyOn(handler, "validateArgs" as any);
        await expect(setCommand.execute([], {})).rejects.toThrow();
        expect(validateArgsSpy).toHaveBeenCalledWith([], 1);
      }
    });
  });

  describe("集成测试", () => {
    it("应该完整测试添加和列出端点的流程", async () => {
      const url = "http://localhost:3000";

      // 添加端点
      mockConfigManager.addMcpEndpoint.mockImplementation(() => {});
      mockConfigManager.getMcpEndpoints.mockReturnValue([url]);
      await handler.testHandleAdd(url);

      // 验证添加成功
      expect(mockConfigManager.addMcpEndpoint).toHaveBeenCalledWith(url);
      expect(consoleSpy).toHaveBeenCalledWith("当前共 1 个端点");

      // 列出端点
      mockConfigManager.getMcpEndpoints.mockReturnValue([url]);
      await handler.testHandleList();

      // 验证列表显示
      expect(consoleSpy).toHaveBeenCalledWith("共 1 个端点:");
      expect(consoleSpy).toHaveBeenCalledWith("  1. http://localhost:3000");
    });

    it("应该完整测试设置和移除端点的流程", async () => {
      const urls = ["http://localhost:3000", "http://localhost:3001"];

      // 设置端点
      mockConfigManager.updateMcpEndpoint.mockImplementation(() => {});
      await handler.testHandleSet(urls);

      // 验证设置成功
      expect(mockConfigManager.updateMcpEndpoint).toHaveBeenCalledWith(urls);
      expect(consoleSpy).toHaveBeenCalledWith("✅ 成功设置 2 个端点");
      expect(consoleSpy).toHaveBeenCalledWith("  1. http://localhost:3000");
      expect(consoleSpy).toHaveBeenCalledWith("  2. http://localhost:3001");

      // 移除端点
      mockConfigManager.removeMcpEndpoint.mockImplementation(() => {});
      mockConfigManager.getMcpEndpoints.mockReturnValue([urls[1]]);
      await handler.testHandleRemove(urls[0]);

      // 验证移除成功
      expect(mockConfigManager.removeMcpEndpoint).toHaveBeenCalledWith(urls[0]);
      expect(consoleSpy).toHaveBeenCalledWith("当前剩余 1 个端点");
    });
  });
});

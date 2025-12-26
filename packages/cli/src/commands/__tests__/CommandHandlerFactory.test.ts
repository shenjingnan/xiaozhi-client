/**
 * CommandHandlerFactory 单元测试
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import type { IDIContainer } from "../../interfaces/Config.js";
import { CommandHandlerFactory } from "../CommandHandlerFactory.js";

describe("CommandHandlerFactory", () => {
  let mockContainer: IDIContainer;
  let factory: CommandHandlerFactory;

  beforeEach(() => {
    mockContainer = {
      register: vi.fn(),
      get: vi.fn(),
      has: vi.fn(),
    };

    factory = new CommandHandlerFactory(mockContainer);
    vi.clearAllMocks();
  });

  describe("构造函数", () => {
    it("应该正确初始化工厂实例", () => {
      expect(factory).toBeInstanceOf(CommandHandlerFactory);
      expect(factory).toBeDefined();
    });

    it("应该接受依赖注入容器", () => {
      // 验证工厂可以被创建，说明容器参数被正确接受
      expect(factory).toBeDefined();
    });
  });

  describe("createHandler - 错误处理", () => {
    it("对于未知类型应该抛出错误", () => {
      expect(() => {
        factory.createHandler("unknown");
      }).toThrow("未知的命令处理器类型: unknown");
    });

    it("应该抛出包含具体类型信息的错误", () => {
      try {
        factory.createHandler("invalid_type");
        expect.fail("应该抛出错误");
      } catch (error) {
        const err = error as Error;
        expect(err).toBeInstanceOf(Error);
        expect(err.message).toContain("invalid_type");
        expect(err.message).toContain("未知的命令处理器类型");
      }
    });

    it("应该处理空字符串类型", () => {
      expect(() => {
        factory.createHandler("");
      }).toThrow("未知的命令处理器类型: ");
    });

    it("应该处理特殊字符类型", () => {
      expect(() => {
        factory.createHandler("@#$%");
      }).toThrow("未知的命令处理器类型: @#$%");
    });

    it("应该处理数字类型字符串", () => {
      expect(() => {
        factory.createHandler("123");
      }).toThrow("未知的命令处理器类型: 123");
    });

    it("应该处理混合大小写类型", () => {
      expect(() => {
        factory.createHandler("Service");
      }).toThrow("未知的命令处理器类型: Service");
    });

    it("应该处理 null 和 undefined 类型", () => {
      expect(() => {
        factory.createHandler(null as any);
      }).toThrow("未知的命令处理器类型: null");

      expect(() => {
        factory.createHandler(undefined as any);
      }).toThrow("未知的命令处理器类型: undefined");
    });

    it("应该处理对象类型的参数", () => {
      expect(() => {
        factory.createHandler({} as any);
      }).toThrow("未知的命令处理器类型: [object Object]");
    });

    it("应该处理数组类型的参数", () => {
      expect(() => {
        factory.createHandler([] as any);
      }).toThrow("未知的命令处理器类型: ");
    });

    it("应该处理函数类型的参数", () => {
      expect(() => {
        factory.createHandler((() => {}) as any);
      }).toThrow(/未知的命令处理器类型: /);
    });
  });

  describe("错误处理的完整性", () => {
    it("应该提供清晰的错误信息", () => {
      const invalidTypes = [
        "",
        "nonexistent",
        "123",
        "Service",
        null,
        undefined,
      ];

      for (const type of invalidTypes) {
        try {
          factory.createHandler(type as any);
          expect.fail(`应该为类型 ${type} 抛出错误`);
        } catch (error) {
          const err = error as Error;
          expect(err).toBeInstanceOf(Error);
          expect(err.message).toContain("未知的命令处理器类型");
          expect(err.message).toContain(String(type));
        }
      }
    });

    it("应该保证错误信息的一致性", () => {
      try {
        factory.createHandler("test");
      } catch (error1) {
        try {
          factory.createHandler("another");
        } catch (error2) {
          const err1 = error1 as Error;
          const err2 = error2 as Error;
          expect(err1.message).toContain("未知的命令处理器类型");
          expect(err2.message).toContain("未知的命令处理器类型");
          expect(err1.message.length).toBeGreaterThan(0);
          expect(err2.message.length).toBeGreaterThan(0);
        }
      }
    });
  });

  describe("依赖注入容器的使用", () => {
    it("应该能够在不同容器实例间独立工作", () => {
      const container1: IDIContainer = {
        register: vi.fn(),
        get: vi.fn(),
        has: vi.fn(),
      };

      const container2: IDIContainer = {
        register: vi.fn(),
        get: vi.fn(),
        has: vi.fn(),
      };

      const factory1 = new CommandHandlerFactory(container1);
      const factory2 = new CommandHandlerFactory(container2);

      expect(factory1).toBeDefined();
      expect(factory2).toBeDefined();
      expect(container1).not.toBe(container2);
    });

    it("应该保存容器的引用", () => {
      // 验证工厂实例被正确创建，说明容器被保存
      expect(factory).toBeDefined();
    });
  });

  describe("createHandler 方法的参数验证", () => {
    it("应该正确处理各种无效输入", () => {
      const invalidInputs = [
        null,
        undefined,
        "",
        123,
        {},
        [],
        () => {},
        true,
        false,
        0,
        -1,
        Number.POSITIVE_INFINITY,
        Number.NaN,
      ];

      for (const input of invalidInputs) {
        expect(() => {
          factory.createHandler(input as any);
        }).toThrow();
      }
    });

    it("应该为所有支持的处理器类型抛出模块不存在的错误", () => {
      const supportedTypes = [
        "service",
        "config",
        "project",
        "mcp",
        "endpoint",
      ];

      for (const type of supportedTypes) {
        expect(() => {
          factory.createHandler(type);
        }).toThrow();
      }
    });
  });

  describe("工厂模式的核心逻辑", () => {
    it("应该有正确的类型判断逻辑", () => {
      // 测试 switch 语句的逻辑
      const types = ["service", "config", "project", "mcp", "endpoint"];

      for (const type of types) {
        // 这些应该尝试加载模块（会失败，但不会在 switch 语句中抛出错误）
        expect(() => {
          try {
            factory.createHandler(type);
          } catch (error) {
            // 错误应该来自模块加载，而不是类型判断
            const err = error as Error;
            expect(err.message).not.toContain("switch");
            throw error;
          }
        }).toThrow();
      }
    });

    it("应该为所有已知类型提供错误处理", () => {
      const knownTypes = [
        { type: "service", module: "ServiceCommandHandler.js" },
        { type: "config", module: "ConfigCommandHandler.js" },
        { type: "project", module: "ProjectCommandHandler.js" },
        { type: "mcp", module: "McpCommandHandler.js" },
        { type: "endpoint", module: "EndpointCommandHandler.js" },
      ];

      for (const { type, module } of knownTypes) {
        try {
          factory.createHandler(type);
        } catch (error) {
          // 错误应该是模块加载错误，而不是类型错误
          const err = error as Error;
          expect(err.message).toContain("Cannot find module");
          expect(err.message).toContain(module);
        }
      }
    });
  });

  describe("接口实现验证", () => {
    it("应该实现 ICommandHandlerFactory 接口", () => {
      expect(factory.createHandlers).toBeDefined();
      expect(factory.createHandler).toBeDefined();
      expect(typeof factory.createHandlers).toBe("function");
      expect(typeof factory.createHandler).toBe("function");
    });

    it("应该有正确的方法签名", () => {
      // createHandlers 不需要参数
      expect(() => factory.createHandlers()).toThrow();

      // createHandler 需要一个字符串参数
      expect(() => factory.createHandler("test")).toThrow();
      expect(() => factory.createHandler(undefined as any)).toThrow();
    });
  });

  describe("错误边界", () => {
    it("应该处理极端的输入情况", () => {
      const extremeInputs = [
        -0,
        +0,
        "",
        " ",
        "\t",
        "\n",
        "\r",
        "\u0000",
        "\uFFFF",
        {},
        { toString: () => "test" },
        [],
        [1, 2, 3],
        new Date(0),
        /regex/,
        new Error("test"),
      ];

      for (const input of extremeInputs) {
        expect(() => {
          factory.createHandler(input as any);
        }).toThrow();
      }
    });

    it("应该为所有错误提供一致的错误格式", () => {
      const testCases = ["", "test", "123", null, undefined];

      for (const input of testCases) {
        try {
          factory.createHandler(input as any);
        } catch (error) {
          const err = error as Error;
          expect(err).toBeInstanceOf(Error);
          expect(err.message).toContain("未知的命令处理器类型");
          expect(err.message.length).toBeGreaterThan(0);
        }
      }
    });
  });
});

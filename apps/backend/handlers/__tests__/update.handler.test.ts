import { NPMManager } from "@/lib/npm";
import type { Context } from "hono";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { logger } from "../../Logger.js";
import { UpdateApiHandler } from "../update.handler.js";

// 模拟依赖
vi.mock("@/lib/npm");
vi.mock("../../Logger.js");
vi.mock("@/services/event-bus.service.js");

// Mock 类型定义
interface MockNPMManager {
  installVersion: ReturnType<typeof vi.fn>;
}

interface MockLogger {
  info: ReturnType<typeof vi.fn>;
  error: ReturnType<typeof vi.fn>;
  warn: ReturnType<typeof vi.fn>;
  debug: ReturnType<typeof vi.fn>;
}

interface MockEventBus {
  emitEvent: ReturnType<typeof vi.fn>;
  onEvent: ReturnType<typeof vi.fn>;
}

describe("UpdateApiHandler", () => {
  let updateApiHandler: UpdateApiHandler;
  let mockNPMManager: MockNPMManager;
  let mockLogger: MockLogger;
  let mockEventBus: MockEventBus;

  const createMockContext = (overrides = {}) => ({
    get: vi.fn((key: string) => {
      if (key === "logger") return mockLogger;
      return undefined;
    }),
    logger: mockLogger, // 向后兼容
    req: {
      json: vi.fn(),
    },
    json: vi.fn(),
    success: vi.fn((data?: unknown, message?: string, status = 200) => {
      const response = {
        success: true,
        data,
        message,
      };
      return new Response(JSON.stringify(response), {
        status,
        headers: { "Content-Type": "application/json" },
      });
    }),
    fail: vi.fn(
      (code: string, message: string, details?: unknown, statusCode = 400) => {
        const response = {
          success: false,
          error: {
            code,
            message,
            ...(details !== undefined && { details }),
          },
        };
        return new Response(JSON.stringify(response), {
          status: statusCode,
          headers: { "Content-Type": "application/json" },
        });
      }
    ),
    ...overrides,
  });

  beforeEach(async () => {
    // Reset all mocks
    vi.clearAllMocks();

    // 设置模拟 logger
    mockLogger = {
      info: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
      debug: vi.fn(),
    };
    Object.assign(logger, mockLogger);

    // 设置模拟 event bus
    mockEventBus = {
      emitEvent: vi.fn(),
      onEvent: vi.fn(),
    };
    const { getEventBus } = await import("@/services/event-bus.service.js");
    vi.mocked(getEventBus).mockReturnValue(
      mockEventBus as unknown as ReturnType<typeof getEventBus>
    );

    // 设置模拟 NPMManager
    mockNPMManager = {
      installVersion: vi.fn(),
    };
    vi.mocked(NPMManager).mockImplementation(
      () => mockNPMManager as unknown as NPMManager
    );

    // 创建处理器实例
    updateApiHandler = new UpdateApiHandler();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("performUpdate", () => {
    test("应该成功安装指定版本", async () => {
      // 准备
      const mockContext = createMockContext({
        req: {
          json: vi.fn().mockResolvedValue({ version: "1.7.9" }),
        },
      } as any);

      mockNPMManager.installVersion.mockResolvedValue(undefined);

      // 执行
      await updateApiHandler.performUpdate(mockContext as unknown as Context);

      // 断言
      expect(mockNPMManager.installVersion).toHaveBeenCalledWith("1.7.9");
      expect(mockContext.success).toHaveBeenCalledWith(
        {
          version: "1.7.9",
          message: "安装已启动，请查看实时日志",
        },
        "安装请求已接受"
      );
    });

    test("应该拒绝空的版本号", async () => {
      // 准备
      const mockContext = createMockContext({
        req: {
          json: vi.fn().mockResolvedValue({ version: "" }),
        },
      } as any);

      // 执行
      await updateApiHandler.performUpdate(mockContext as unknown as Context);

      // 断言
      expect(mockContext.fail).toHaveBeenCalledWith(
        "INVALID_VERSION",
        "请求参数格式错误",
        [
          {
            field: "version",
            message: "版本号不能为空",
          },
        ],
        400
      );
      expect(mockNPMManager.installVersion).not.toHaveBeenCalled();
    });

    test("应该拒绝缺少 version 字段的请求", async () => {
      // Arrange
      const mockContext = createMockContext({
        req: {
          json: vi.fn().mockResolvedValue({}),
        },
      } as any);

      // Act
      await updateApiHandler.performUpdate(mockContext as unknown as Context);

      // Assert
      expect(mockContext.fail).toHaveBeenCalledWith(
        "INVALID_VERSION",
        "请求参数格式错误",
        [
          {
            field: "version",
            message: "Invalid input: expected string, received undefined",
          },
        ],
        400
      );
      expect(mockNPMManager.installVersion).not.toHaveBeenCalled();
    });

    test("应该拒绝 version 字段为 null 的请求", async () => {
      // Arrange
      const mockContext = createMockContext({
        req: {
          json: vi.fn().mockResolvedValue({ version: null }),
        },
      } as any);

      // Act
      await updateApiHandler.performUpdate(mockContext as unknown as Context);

      // Assert
      expect(mockContext.fail).toHaveBeenCalledWith(
        "INVALID_VERSION",
        "请求参数格式错误",
        [
          {
            field: "version",
            message: "Invalid input: expected string, received null",
          },
        ],
        400
      );
      expect(mockNPMManager.installVersion).not.toHaveBeenCalled();
    });

    test("应该处理 npm 安装失败的情况", async () => {
      // Arrange
      const mockContext = createMockContext({
        req: {
          json: vi.fn().mockResolvedValue({ version: "1.7.9" }),
        },
      } as any);

      const installError = new Error("npm 安装失败");
      mockNPMManager.installVersion.mockRejectedValue(installError);

      // Act
      await updateApiHandler.performUpdate(mockContext as unknown as Context);

      // 等待一下，让异步错误处理执行
      await new Promise((resolve) => setTimeout(resolve, 10));

      // Assert
      expect(mockLogger.error).toHaveBeenCalledWith(
        "安装过程失败:",
        installError
      );
      // 由于安装是异步的，响应应该仍然是成功的
      expect(mockContext.success).toHaveBeenCalledWith(
        {
          version: "1.7.9",
          message: "安装已启动，请查看实时日志",
        },
        "安装请求已接受"
      );
    });

    test("应该处理 JSON 解析错误", async () => {
      // Arrange
      const jsonError = new Error("Invalid JSON");
      const mockContext = createMockContext({
        req: {
          json: vi.fn().mockRejectedValue(jsonError),
        },
      } as any);

      // Act
      await updateApiHandler.performUpdate(mockContext as unknown as Context);

      // Assert
      expect(mockLogger.error).toHaveBeenCalledWith(
        "处理安装请求失败:",
        expect.any(Error)
      );
      expect(mockContext.fail).toHaveBeenCalledWith(
        "REQUEST_FAILED",
        "请求体格式错误: Invalid JSON",
        undefined,
        500
      );
    });

    test("应该处理非 Error 类型的错误", async () => {
      // Arrange
      const mockContext = createMockContext({
        req: {
          json: vi.fn().mockResolvedValue({ version: "1.7.9" }),
        },
      } as any);

      const installError = "String error";
      mockNPMManager.installVersion.mockRejectedValue(installError);

      // Act
      await updateApiHandler.performUpdate(mockContext as unknown as Context);

      // 等待一下，让异步错误处理执行
      await new Promise((resolve) => setTimeout(resolve, 10));

      // Assert
      expect(mockLogger.error).toHaveBeenCalledWith(
        "安装过程失败:",
        installError
      );
      // 由于安装是异步的，响应应该仍然是成功的
      expect(mockContext.success).toHaveBeenCalledWith(
        {
          version: "1.7.9",
          message: "安装已启动，请查看实时日志",
        },
        "安装请求已接受"
      );
    });

    test("应该拒绝相同版本的并发安装请求", async () => {
      // Arrange
      const firstContext = createMockContext({
        req: {
          json: vi.fn().mockResolvedValue({ version: "1.7.9" }),
        },
      } as any);

      const secondContext = createMockContext({
        req: {
          json: vi.fn().mockResolvedValue({ version: "1.7.9" }),
        },
      } as any);

      // 模拟安装过程需要一些时间
      let resolveInstall: (value: undefined) => void;
      mockNPMManager.installVersion.mockReturnValue(
        new Promise<void>((resolve) => {
          resolveInstall = resolve;
        })
      );

      // Act - 第一个请求
      const firstResponse = await updateApiHandler.performUpdate(
        firstContext as unknown as Context
      );

      // Assert - 第一个请求应该成功
      expect(firstContext.success).toHaveBeenCalledWith(
        {
          version: "1.7.9",
          message: "安装已启动，请查看实时日志",
        },
        "安装请求已接受"
      );

      // Act - 第二个请求（相同版本）
      const secondResponse = await updateApiHandler.performUpdate(
        secondContext as unknown as Context
      );

      // Assert - 第二个请求应该被拒绝
      expect(secondContext.fail).toHaveBeenCalledWith(
        "INSTALL_IN_PROGRESS",
        "已有安装进程正在进行，请等待完成后再试",
        undefined,
        409
      );

      // 清理：完成安装过程
      resolveInstall!();
      await new Promise((resolve) => setTimeout(resolve, 10));
    });

    test("应该允许不同版本的并发安装请求", async () => {
      // Arrange
      const firstContext = createMockContext({
        req: {
          json: vi.fn().mockResolvedValue({ version: "1.7.9" }),
        },
      } as any);

      const secondContext = createMockContext({
        req: {
          json: vi.fn().mockResolvedValue({ version: "1.8.0" }),
        },
      } as any);

      let resolveFirstInstall: (value: undefined) => void;
      let resolveSecondInstall: (value: undefined) => void;
      mockNPMManager.installVersion
        .mockReturnValueOnce(
          new Promise<void>((resolve) => {
            resolveFirstInstall = resolve;
          })
        )
        .mockReturnValueOnce(
          new Promise<void>((resolve) => {
            resolveSecondInstall = resolve;
          })
        );

      // Act - 两个不同版本的请求
      const firstResponse = await updateApiHandler.performUpdate(
        firstContext as unknown as Context
      );
      const secondResponse = await updateApiHandler.performUpdate(
        secondContext as unknown as Context
      );

      // Assert - 两个请求都应该成功
      expect(firstContext.success).toHaveBeenCalledWith(
        {
          version: "1.7.9",
          message: "安装已启动，请查看实时日志",
        },
        "安装请求已接受"
      );
      expect(secondContext.success).toHaveBeenCalledWith(
        {
          version: "1.8.0",
          message: "安装已启动，请查看实时日志",
        },
        "安装请求已接受"
      );

      // 清理：完成安装过程
      resolveFirstInstall!();
      resolveSecondInstall!();
      await new Promise((resolve) => setTimeout(resolve, 10));
    });

    test("安装完成后应该清除活跃安装状态", async () => {
      // Arrange
      const firstContext = createMockContext({
        req: {
          json: vi.fn().mockResolvedValue({ version: "1.7.9" }),
        },
      } as any);

      const secondContext = createMockContext({
        req: {
          json: vi.fn().mockResolvedValue({ version: "1.7.9" }),
        },
      } as any);

      // Act - 第一个请求
      mockNPMManager.installVersion.mockResolvedValue(undefined);
      await updateApiHandler.performUpdate(firstContext as unknown as Context);

      // 等待安装完成
      await new Promise((resolve) => setTimeout(resolve, 10));

      // Act - 第二个请求（相同版本，但第一个已完成）
      mockNPMManager.installVersion.mockResolvedValue(undefined);
      await updateApiHandler.performUpdate(secondContext as unknown as Context);

      // Assert - 第二个请求应该成功（因为第一个已完成）
      expect(secondContext.success).toHaveBeenCalledWith(
        {
          version: "1.7.9",
          message: "安装已启动，请查看实时日志",
        },
        "安装请求已接受"
      );
    });

    test("安装失败时应该清除活跃安装状态", async () => {
      // Arrange
      const firstContext = createMockContext({
        req: {
          json: vi.fn().mockResolvedValue({ version: "1.7.9" }),
        },
      } as any);

      const secondContext = createMockContext({
        req: {
          json: vi.fn().mockResolvedValue({ version: "1.7.9" }),
        },
      } as any);

      // Act - 第一个请求（会失败）
      mockNPMManager.installVersion.mockRejectedValue(new Error("安装失败"));
      await updateApiHandler.performUpdate(firstContext as unknown as Context);

      // 等待安装失败处理完成
      await new Promise((resolve) => setTimeout(resolve, 10));

      // Act - 第二个请求（相同版本，但第一个已失败）
      mockNPMManager.installVersion.mockResolvedValue(undefined);
      await updateApiHandler.performUpdate(secondContext as unknown as Context);

      // Assert - 第二个请求应该成功（因为第一个已失败并清除状态）
      expect(secondContext.success).toHaveBeenCalledWith(
        {
          version: "1.7.9",
          message: "安装已启动，请查看实时日志",
        },
        "安装请求已接受"
      );
    });
  });
});

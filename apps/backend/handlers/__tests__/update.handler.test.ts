import { NPMManager } from "@/lib/npm";
import type { Context } from "hono";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { logger } from "../../Logger.js";
import { UpdateHandler } from "../update.handler.js";

// Mock dependencies
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

describe("UpdateHandler", () => {
  let updateApiHandler: UpdateHandler;
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

    // Setup mock logger
    mockLogger = {
      info: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
      debug: vi.fn(),
    };
    Object.assign(logger, mockLogger);

    // Setup mock event bus
    mockEventBus = {
      emitEvent: vi.fn(),
      onEvent: vi.fn(),
    };
    const { getEventBus } = await import("@/services/event-bus.service.js");
    vi.mocked(getEventBus).mockReturnValue(
      mockEventBus as unknown as ReturnType<typeof getEventBus>
    );

    // Setup mock NPMManager
    mockNPMManager = {
      installVersion: vi.fn(),
    };
    vi.mocked(NPMManager).mockImplementation(
      () => mockNPMManager as unknown as NPMManager
    );

    // Create handler instance
    updateApiHandler = new UpdateHandler();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("performUpdate", () => {
    test("应该成功安装指定版本", async () => {
      // Arrange
      const mockContext = createMockContext({
        req: {
          json: vi.fn().mockResolvedValue({ version: "1.7.9" }),
        },
      } as any);

      mockNPMManager.installVersion.mockResolvedValue(undefined);

      // Act
      await updateApiHandler.performUpdate(mockContext as unknown as Context);

      // Assert
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
      // Arrange
      const mockContext = createMockContext({
        req: {
          json: vi.fn().mockResolvedValue({ version: "" }),
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
            message: "Required",
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
            message: "Expected string, received null",
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
  });
});

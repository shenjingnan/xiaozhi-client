import { NPMManager } from "@/lib/npm";
import { InstallLogStream } from "@/lib/npm/install-log-stream.js";
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
      expect(mockNPMManager.installVersion).toHaveBeenCalledWith(
        "1.7.9",
        expect.stringMatching(/^install-/)
      );
      expect(mockContext.success).toHaveBeenCalledWith(
        expect.objectContaining({
          version: "1.7.9",
          installId: expect.stringMatching(/^install-/),
          message: "安装已启动，请通过 SSE 日志流查看进度",
        }),
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
        expect.objectContaining({
          version: "1.7.9",
          installId: expect.stringMatching(/^install-/),
          message: "安装已启动，请通过 SSE 日志流查看进度",
        }),
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
        expect.objectContaining({
          version: "1.7.9",
          installId: expect.stringMatching(/^install-/),
          message: "安装已启动，请通过 SSE 日志流查看进度",
        }),
        "安装请求已接受"
      );
    });
  });

  // ==================== SSE 日志流集成测试 ====================

  describe("UpdateApiHandler - SSE 日志流集成", () => {
    let updateApiHandler: UpdateApiHandler;
    let logStream: InstallLogStream;

    beforeEach(() => {
      vi.clearAllMocks();

      // 使用真实的 InstallLogStream 实例
      logStream = new InstallLogStream();

      // 创建处理器实例（注入真实 logStream）
      updateApiHandler = new UpdateApiHandler(logStream);

      // 设置模拟 logger
      mockLogger = {
        info: vi.fn(),
        error: vi.fn(),
        warn: vi.fn(),
        debug: vi.fn(),
      };
      Object.assign(logger, mockLogger);
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    describe("getInstallLogs", () => {
      it("缺少 installId 参数时应返回 400 错误", async () => {
        const mockContext = createMockContext({
          req: { query: vi.fn().mockReturnValue(undefined) },
        } as any);

        const response = await updateApiHandler.getInstallLogs(
          mockContext as unknown as Context
        );

        const body = await response.json();
        expect(response.status).toBe(400);
        expect(body.error.code).toBe("MISSING_INSTALL_ID");
      });

      it("installId 对应的会话不存在时应返回 404", async () => {
        const mockContext = createMockContext({
          req: { query: vi.fn().mockReturnValue("non-existent") },
        } as any);

        const response = await updateApiHandler.getInstallLogs(
          mockContext as unknown as Context
        );

        const body = await response.json();
        expect(response.status).toBe(404);
        expect(body.error.code).toBe("INSTALL_NOT_FOUND");
      });

      it("会话存在时应返回 text/event-stream 类型的 Response", async () => {
        // 先创建一个安装会话
        logStream.startInstall({
          version: "1.0.0",
          installId: "test-sse-id",
          timestamp: Date.now(),
        });

        const mockContext = createMockContext({
          req: { query: vi.fn().mockReturnValue("test-sse-id") },
        } as any);

        const response = await updateApiHandler.getInstallLogs(
          mockContext as unknown as Context
        );

        expect(response.status).toBe(200);
        expect(response.headers.get("Content-Type")).toBe("text/event-stream");
        expect(response.headers.get("Cache-Control")).toContain("no-cache");
        expect(response.headers.get("X-Accel-Buffering")).toBe("no");
      });
    });

    describe("getLogStream", () => {
      it("应返回注入的 InstallLogStream 实例", () => {
        expect(updateApiHandler.getLogStream()).toBe(logStream);
      });
    });

    describe("performUpdate 与 getInstallLogs 协作", () => {
      it("performUpdate 应将生成的 installId 传递给 NPMManager", async () => {
        const mockContext = createMockContext({
          req: {
            json: vi.fn().mockResolvedValue({ version: "1.7.9" }),
          },
        } as any);

        mockNPMManager.installVersion.mockResolvedValue(undefined);

        await updateApiHandler.performUpdate(mockContext as unknown as Context);

        // 验证 installVersion 被调用且接收到了正确的 installId
        expect(mockNPMManager.installVersion).toHaveBeenCalledWith(
          "1.7.9",
          expect.stringMatching(/^install-/)
        );

        // 验证响应包含 installId（前端可用它来连接 SSE）
        const successCall = mockContext.success.mock.calls[0][0] as {
          installId: string;
        };
        expect(successCall.installId).toMatch(/^install-/);
      });
    });
  });
});

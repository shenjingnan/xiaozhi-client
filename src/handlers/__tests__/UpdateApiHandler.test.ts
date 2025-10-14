import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { logger } from "../../Logger.js";
import { NPMManager } from "../../services/NPMManager.js";
import { UpdateApiHandler } from "../UpdateApiHandler.js";

// Mock dependencies
vi.mock("../../services/NPMManager.js");
vi.mock("../../Logger.js");

describe("UpdateApiHandler", () => {
  let updateApiHandler: UpdateApiHandler;
  let mockNPMManager: any;
  let mockLogger: any;

  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks();

    // Setup mock logger
    mockLogger = {
      info: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
      debug: vi.fn(),
    };
    (logger.withTag as any).mockReturnValue(mockLogger);

    // Setup mock NPMManager
    mockNPMManager = {
      installVersion: vi.fn(),
    };
    (NPMManager as any).mockImplementation(() => mockNPMManager);

    // Create handler instance
    updateApiHandler = new UpdateApiHandler();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("performUpdate", () => {
    test("应该成功安装指定版本", async () => {
      // Arrange
      const mockContext = {
        req: {
          json: vi.fn().mockResolvedValue({ version: "1.7.9" }),
        },
        json: vi.fn(),
      };

      mockNPMManager.installVersion.mockResolvedValue(undefined);

      // Act
      await updateApiHandler.performUpdate(mockContext as any);

      // Assert
      expect(mockNPMManager.installVersion).toHaveBeenCalledWith("1.7.9");
      expect(mockLogger.info).toHaveBeenCalledWith(
        "开始安装 xiaozhi-client@1.7.9"
      );
      expect(mockContext.json).toHaveBeenCalledWith({
        success: true,
        data: {
          version: "1.7.9",
          message: "成功安装 xiaozhi-client@1.7.9",
        },
        message: "安装完成",
      });
    });

    test("应该拒绝空的版本号", async () => {
      // Arrange
      const mockContext = {
        req: {
          json: vi.fn().mockResolvedValue({ version: "" }),
        },
        json: vi.fn(),
      };

      // Act
      await updateApiHandler.performUpdate(mockContext as any);

      // Assert
      expect(mockContext.json).toHaveBeenCalledWith(
        {
          success: false,
          error: {
            code: "INVALID_VERSION",
            message: "请求参数格式错误",
            details: [
              {
                field: "version",
                message: "版本号不能为空",
              },
            ],
          },
        },
        400
      );
      expect(mockNPMManager.installVersion).not.toHaveBeenCalled();
    });

    test("应该拒绝缺少 version 字段的请求", async () => {
      // Arrange
      const mockContext = {
        req: {
          json: vi.fn().mockResolvedValue({}),
        },
        json: vi.fn(),
      };

      // Act
      await updateApiHandler.performUpdate(mockContext as any);

      // Assert
      expect(mockContext.json).toHaveBeenCalledWith(
        {
          success: false,
          error: {
            code: "INVALID_VERSION",
            message: "请求参数格式错误",
            details: [
              {
                field: "version",
                message: "Required",
              },
            ],
          },
        },
        400
      );
      expect(mockNPMManager.installVersion).not.toHaveBeenCalled();
    });

    test("应该拒绝 version 字段为 null 的请求", async () => {
      // Arrange
      const mockContext = {
        req: {
          json: vi.fn().mockResolvedValue({ version: null }),
        },
        json: vi.fn(),
      };

      // Act
      await updateApiHandler.performUpdate(mockContext as any);

      // Assert
      expect(mockContext.json).toHaveBeenCalledWith(
        {
          success: false,
          error: {
            code: "INVALID_VERSION",
            message: "请求参数格式错误",
            details: [
              {
                field: "version",
                message: "Expected string, received null",
              },
            ],
          },
        },
        400
      );
      expect(mockNPMManager.installVersion).not.toHaveBeenCalled();
    });

    test("应该处理 npm 安装失败的情况", async () => {
      // Arrange
      const mockContext = {
        req: {
          json: vi.fn().mockResolvedValue({ version: "1.7.9" }),
        },
        json: vi.fn(),
      };

      const installError = new Error("npm 安装失败");
      mockNPMManager.installVersion.mockRejectedValue(installError);

      // Act
      await updateApiHandler.performUpdate(mockContext as any);

      // Assert
      expect(mockLogger.error).toHaveBeenCalledWith("安装失败:", installError);
      expect(mockContext.json).toHaveBeenCalledWith(
        {
          success: false,
          error: {
            code: "INSTALL_FAILED",
            message: "npm 安装失败",
          },
        },
        500
      );
    });

    test("应该处理 JSON 解析错误", async () => {
      // Arrange
      const jsonError = new Error("Invalid JSON");
      const mockContext = {
        req: {
          json: vi.fn().mockRejectedValue(jsonError),
        },
        json: vi.fn(),
      };

      // Act
      await updateApiHandler.performUpdate(mockContext as any);

      // Assert
      expect(mockLogger.error).toHaveBeenCalledWith("安装失败:", jsonError);
      expect(mockContext.json).toHaveBeenCalledWith(
        {
          success: false,
          error: {
            code: "INSTALL_FAILED",
            message: "Invalid JSON",
          },
        },
        500
      );
    });

    test("应该处理非 Error 类型的错误", async () => {
      // Arrange
      const mockContext = {
        req: {
          json: vi.fn().mockResolvedValue({ version: "1.7.9" }),
        },
        json: vi.fn(),
      };

      const installError = "String error";
      mockNPMManager.installVersion.mockRejectedValue(installError);

      // Act
      await updateApiHandler.performUpdate(mockContext as any);

      // Assert
      expect(mockLogger.error).toHaveBeenCalledWith("安装失败:", installError);
      expect(mockContext.json).toHaveBeenCalledWith(
        {
          success: false,
          error: {
            code: "INSTALL_FAILED",
            message: "安装失败",
          },
        },
        500
      );
    });
  });
});

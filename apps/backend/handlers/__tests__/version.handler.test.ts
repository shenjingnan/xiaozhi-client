import { NPMManager } from "@/lib/npm";
import type { AppContext } from "@/types/hono.context.js";
import type { Context } from "hono";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { logger } from "../../Logger.js";
import type { VersionInfo } from "@xiaozhi-client/version";
import { VersionUtils } from "@xiaozhi-client/version";
import { VersionApiHandler } from "../version.handler.js";

// 模拟依赖
vi.mock("@xiaozhi-client/version");
vi.mock("@/lib/npm");
vi.mock("../../Logger.js");

// Mock 类型定义
interface MockNPMManager {
  getAvailableVersions: ReturnType<typeof vi.fn>;
  checkForLatestVersion: ReturnType<typeof vi.fn>;
}

interface MockLogger {
  info: ReturnType<typeof vi.fn>;
  error: ReturnType<typeof vi.fn>;
  warn: ReturnType<typeof vi.fn>;
  debug: ReturnType<typeof vi.fn>;
}

describe("VersionApiHandler 版本 API 处理器", () => {
  let handler: VersionApiHandler;
  let mockNPMManager: MockNPMManager;
  let mockLogger: MockLogger;

  const createMockContext = (overrides = {}) => ({
    get: vi.fn((key: string) => {
      if (key === "logger") return mockLogger;
      return undefined;
    }),
    req: {
      query: vi.fn((key: string) => {
        if (key === "type") return "stable";
        return undefined;
      }),
      json: vi.fn(),
    },
    success: vi.fn((data?: unknown, message?: string, status = 200) => {
      const response: {
        success: true;
        data?: unknown;
        message?: string;
      } = { success: true };
      if (data !== undefined) {
        response.data = data;
      }
      if (message) {
        response.message = message;
      }
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
          },
        };
        if (details !== undefined) {
          (
            response.error as {
              code: string;
              message: string;
              details: unknown;
            }
          ).details = details;
        }
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

    // 设置模拟 NPMManager
    mockNPMManager = {
      getAvailableVersions: vi.fn().mockResolvedValue(["1.0.0", "1.1.0", "2.0.0"]),
      checkForLatestVersion: vi
        .fn()
        .mockResolvedValue({
          currentVersion: "1.0.0",
          latestVersion: "2.0.0",
          hasUpdate: true,
        }),
    };
    vi.mocked(NPMManager).mockImplementation(
      () => mockNPMManager as unknown as NPMManager
    );

    // 设置模拟 VersionUtils
    vi.mocked(VersionUtils.getVersionInfo).mockReturnValue({
      version: "1.0.0",
      name: "xiaozhi-client",
    });
    vi.mocked(VersionUtils.getVersion).mockReturnValue("1.0.0");
    vi.mocked(VersionUtils.clearCache).mockReturnValue(undefined);

    // 创建处理器实例
    handler = new VersionApiHandler();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("getVersion 获取完整版本信息", () => {
    it("应该成功返回完整版本信息", async () => {
      const versionInfo: VersionInfo = {
        version: "1.10.7",
        name: "xiaozhi-client",
        description: "小智客户端",
        author: "shenjingnan",
      };
      vi.mocked(VersionUtils.getVersionInfo).mockReturnValue(versionInfo);

      const mockContext = createMockContext() as unknown as Context<AppContext>;
      const response = await handler.getVersion(mockContext);
      const responseData = await response.json();

      expect(VersionUtils.getVersionInfo).toHaveBeenCalled();
      expect(mockLogger.debug).toHaveBeenCalledWith("处理获取版本信息请求");
      expect(mockLogger.debug).toHaveBeenCalledWith("获取版本信息成功:", versionInfo);
      expect(responseData).toEqual({
        success: true,
        data: versionInfo,
      });
      expect(response.status).toBe(200);
    });

    it("应该处理获取版本信息时的错误", async () => {
      const error = new Error("无法读取版本信息");
      vi.mocked(VersionUtils.getVersionInfo).mockImplementation(() => {
        throw error;
      });

      const mockContext = createMockContext() as unknown as Context<AppContext>;
      const response = await handler.getVersion(mockContext);
      const responseData = await response.json();

      expect(mockLogger.error).toHaveBeenCalledWith("获取版本信息失败:", error);
      expect(responseData).toEqual({
        success: false,
        error: {
          code: "VERSION_READ_ERROR",
          message: "无法读取版本信息",
        },
      });
      expect(response.status).toBe(500);
    });

    it("应该处理非 Error 类型的异常", async () => {
      vi.mocked(VersionUtils.getVersionInfo).mockImplementation(() => {
        throw "字符串错误";
      });

      const mockContext = createMockContext() as unknown as Context<AppContext>;
      const response = await handler.getVersion(mockContext);
      const responseData = await response.json();

      expect(responseData).toEqual({
        success: false,
        error: {
          code: "VERSION_READ_ERROR",
          message: "字符串错误",
        },
      });
      expect(response.status).toBe(500);
    });

    it("应该处理包含特殊字符的版本信息", async () => {
      const versionInfo: VersionInfo = {
        version: "1.0.0-beta.1+build.123",
        name: "测试应用-中文",
        description: "包含特殊字符: &<>\"'",
      };
      vi.mocked(VersionUtils.getVersionInfo).mockReturnValue(versionInfo);

      const mockContext = createMockContext() as unknown as Context<AppContext>;
      const response = await handler.getVersion(mockContext);
      const responseData = await response.json();

      expect(responseData.success).toBe(true);
      expect(responseData.data).toEqual(versionInfo);
    });
  });

  describe("getVersionSimple 获取简化版本信息", () => {
    it("应该成功返回简化版本信息", async () => {
      const version = "1.10.7";
      vi.mocked(VersionUtils.getVersion).mockReturnValue(version);

      const mockContext = createMockContext() as unknown as Context<AppContext>;
      const response = await handler.getVersionSimple(mockContext);
      const responseData = await response.json();

      expect(VersionUtils.getVersion).toHaveBeenCalled();
      expect(mockLogger.debug).toHaveBeenCalledWith("处理获取版本号请求");
      expect(mockLogger.debug).toHaveBeenCalledWith(`获取版本号成功: ${version}`);
      expect(responseData).toEqual({
        success: true,
        data: { version },
      });
      expect(response.status).toBe(200);
    });

    it("应该处理获取版本号时的错误", async () => {
      const error = new Error("无法读取版本号");
      vi.mocked(VersionUtils.getVersion).mockImplementation(() => {
        throw error;
      });

      const mockContext = createMockContext() as unknown as Context<AppContext>;
      const response = await handler.getVersionSimple(mockContext);
      const responseData = await response.json();

      expect(mockLogger.error).toHaveBeenCalledWith("获取版本号失败:", error);
      expect(responseData).toEqual({
        success: false,
        error: {
          code: "VERSION_READ_ERROR",
          message: "无法读取版本号",
        },
      });
      expect(response.status).toBe(500);
    });

    it("应该处理非 Error 类型的异常", async () => {
      vi.mocked(VersionUtils.getVersion).mockImplementation(() => {
        throw null;
      });

      const mockContext = createMockContext() as unknown as Context<AppContext>;
      const response = await handler.getVersionSimple(mockContext);
      const responseData = await response.json();

      expect(responseData).toEqual({
        success: false,
        error: {
          code: "VERSION_READ_ERROR",
          message: "null",
        },
      });
      expect(response.status).toBe(500);
    });

    it("应该处理带预发布标识符的版本号", async () => {
      const version = "1.10.8-rc.0";
      vi.mocked(VersionUtils.getVersion).mockReturnValue(version);

      const mockContext = createMockContext() as unknown as Context<AppContext>;
      const response = await handler.getVersionSimple(mockContext);
      const responseData = await response.json();

      expect(responseData.success).toBe(true);
      expect(responseData.data.version).toBe(version);
    });
  });

  describe("clearVersionCache 清除版本缓存", () => {
    it("应该成功清除版本缓存", async () => {
      vi.mocked(VersionUtils.clearCache).mockReturnValue(undefined);

      const mockContext = createMockContext() as unknown as Context<AppContext>;
      const response = await handler.clearVersionCache(mockContext);
      const responseData = await response.json();

      expect(VersionUtils.clearCache).toHaveBeenCalled();
      expect(mockLogger.debug).toHaveBeenCalledWith("处理清除版本缓存请求");
      expect(mockLogger.info).toHaveBeenCalledWith("版本缓存已清除");
      expect(responseData).toEqual({
        success: true,
        message: "版本缓存已清除",
      });
      expect(response.status).toBe(200);
    });

    it("应该处理清除缓存时的错误", async () => {
      const error = new Error("清除缓存失败");
      vi.mocked(VersionUtils.clearCache).mockImplementation(() => {
        throw error;
      });

      const mockContext = createMockContext() as unknown as Context<AppContext>;
      const response = await handler.clearVersionCache(mockContext);
      const responseData = await response.json();

      expect(mockLogger.error).toHaveBeenCalledWith("清除版本缓存失败:", error);
      expect(responseData).toEqual({
        success: false,
        error: {
          code: "CACHE_CLEAR_ERROR",
          message: "清除缓存失败",
        },
      });
      expect(response.status).toBe(500);
    });

    it("应该处理非 Error 类型的异常", async () => {
      vi.mocked(VersionUtils.clearCache).mockImplementation(() => {
        throw undefined;
      });

      const mockContext = createMockContext() as unknown as Context<AppContext>;
      const response = await handler.clearVersionCache(mockContext);
      const responseData = await response.json();

      expect(responseData).toEqual({
        success: false,
        error: {
          code: "CACHE_CLEAR_ERROR",
          message: "undefined",
        },
      });
      expect(response.status).toBe(500);
    });
  });

  describe("getAvailableVersions 获取可用版本列表", () => {
    it("应该成功返回 stable 版本列表", async () => {
      const versions = ["1.0.0", "1.1.0", "2.0.0", "2.1.0"];
      mockNPMManager.getAvailableVersions = vi.fn().mockResolvedValue(versions);
      vi.mocked(NPMManager).mockImplementation(
        () => mockNPMManager as unknown as NPMManager
      );

      const mockContext = createMockContext() as unknown as Context<AppContext>;
      const response = await handler.getAvailableVersions(mockContext);
      const responseData = await response.json();

      expect(mockNPMManager.getAvailableVersions).toHaveBeenCalledWith("stable");
      expect(mockLogger.debug).toHaveBeenCalledWith("处理获取可用版本列表请求");
      expect(mockLogger.debug).toHaveBeenCalledWith(`获取到 ${versions.length} 个可用版本 (类型: stable)`);
      expect(responseData).toEqual({
        success: true,
        data: {
          versions,
          type: "stable",
          total: versions.length,
        },
      });
      expect(response.status).toBe(200);
    });

    it("应该成功返回 rc 版本列表", async () => {
      const versions = ["2.0.0-rc.1", "2.0.0-rc.2", "2.1.0-rc.0"];
      mockNPMManager.getAvailableVersions = vi.fn().mockResolvedValue(versions);
      vi.mocked(NPMManager).mockImplementation(
        () => mockNPMManager as unknown as NPMManager
      );

      const mockContext = createMockContext({
        req: {
          query: vi.fn((key: string) => {
            if (key === "type") return "rc";
            return undefined;
          }),
        },
      }) as unknown as Context<AppContext>;
      const response = await handler.getAvailableVersions(mockContext);
      const responseData = await response.json();

      expect(mockNPMManager.getAvailableVersions).toHaveBeenCalledWith("rc");
      expect(responseData.data.type).toBe("rc");
      expect(responseData.success).toBe(true);
    });

    it("应该成功返回 beta 版本列表", async () => {
      const versions = ["2.0.0-beta.1", "2.0.0-beta.2"];
      mockNPMManager.getAvailableVersions = vi.fn().mockResolvedValue(versions);
      vi.mocked(NPMManager).mockImplementation(
        () => mockNPMManager as unknown as NPMManager
      );

      const mockContext = createMockContext({
        req: {
          query: vi.fn((key: string) => {
            if (key === "type") return "beta";
            return undefined;
          }),
        },
      }) as unknown as Context<AppContext>;
      const response = await handler.getAvailableVersions(mockContext);
      const responseData = await response.json();

      expect(mockNPMManager.getAvailableVersions).toHaveBeenCalledWith("beta");
      expect(responseData.data.type).toBe("beta");
      expect(responseData.success).toBe(true);
    });

    it("应该成功返回 all 版本列表", async () => {
      const versions = ["1.0.0", "1.1.0", "2.0.0-rc.1", "2.0.0-beta.1"];
      mockNPMManager.getAvailableVersions = vi.fn().mockResolvedValue(versions);
      vi.mocked(NPMManager).mockImplementation(
        () => mockNPMManager as unknown as NPMManager
      );

      const mockContext = createMockContext({
        req: {
          query: vi.fn((key: string) => {
            if (key === "type") return "all";
            return undefined;
          }),
        },
      }) as unknown as Context<AppContext>;
      const response = await handler.getAvailableVersions(mockContext);
      const responseData = await response.json();

      expect(mockNPMManager.getAvailableVersions).toHaveBeenCalledWith("all");
      expect(responseData.data.type).toBe("all");
      expect(responseData.success).toBe(true);
    });

    it("应该拒绝无效的版本类型参数", async () => {
      const mockContext = createMockContext({
        req: {
          query: vi.fn((key: string) => {
            if (key === "type") return "invalid";
            return undefined;
          }),
        },
      }) as unknown as Context<AppContext>;

      const response = await handler.getAvailableVersions(mockContext);
      const responseData = await response.json();

      expect(responseData).toEqual({
        success: false,
        error: {
          code: "INVALID_VERSION_TYPE",
          message: "无效的版本类型: invalid。支持的类型: stable, rc, beta, all",
        },
      });
      expect(response.status).toBe(400);
    });

    it("应该处理获取可用版本列表时的错误", async () => {
      const error = new Error("网络请求失败");
      mockNPMManager.getAvailableVersions = vi.fn().mockRejectedValue(error);
      vi.mocked(NPMManager).mockImplementation(
        () => mockNPMManager as unknown as NPMManager
      );

      const mockContext = createMockContext() as unknown as Context<AppContext>;
      const response = await handler.getAvailableVersions(mockContext);
      const responseData = await response.json();

      expect(mockLogger.error).toHaveBeenCalledWith("获取可用版本列表失败:", error);
      expect(responseData).toEqual({
        success: false,
        error: {
          code: "VERSIONS_FETCH_ERROR",
          message: "网络请求失败",
        },
      });
      expect(response.status).toBe(500);
    });

    it("应该处理非 Error 类型的异常", async () => {
      mockNPMManager.getAvailableVersions = vi.fn().mockRejectedValue("字符串错误");
      vi.mocked(NPMManager).mockImplementation(
        () => mockNPMManager as unknown as NPMManager
      );

      const mockContext = createMockContext() as unknown as Context<AppContext>;
      const response = await handler.getAvailableVersions(mockContext);
      const responseData = await response.json();

      expect(responseData).toEqual({
        success: false,
        error: {
          code: "VERSIONS_FETCH_ERROR",
          message: "字符串错误",
        },
      });
      expect(response.status).toBe(500);
    });

    it("应该处理空版本列表", async () => {
      const versions: string[] = [];
      mockNPMManager.getAvailableVersions = vi.fn().mockResolvedValue(versions);
      vi.mocked(NPMManager).mockImplementation(
        () => mockNPMManager as unknown as NPMManager
      );

      const mockContext = createMockContext() as unknown as Context<AppContext>;
      const response = await handler.getAvailableVersions(mockContext);
      const responseData = await response.json();

      expect(responseData.success).toBe(true);
      expect(responseData.data.versions).toEqual([]);
      expect(responseData.data.total).toBe(0);
    });

    it("应该处理默认类型参数（stable）", async () => {
      const versions = ["1.0.0", "2.0.0"];
      mockNPMManager.getAvailableVersions = vi.fn().mockResolvedValue(versions);
      vi.mocked(NPMManager).mockImplementation(
        () => mockNPMManager as unknown as NPMManager
      );

      const mockContext = createMockContext({
        req: {
          query: vi.fn(() => undefined),
        },
      }) as unknown as Context<AppContext>;
      const response = await handler.getAvailableVersions(mockContext);
      const responseData = await response.json();

      expect(mockNPMManager.getAvailableVersions).toHaveBeenCalledWith("stable");
      expect(responseData.success).toBe(true);
    });
  });

  describe("checkLatestVersion 检查最新版本", () => {
    it("应该成功返回版本检查结果（有更新）", async () => {
      const result = {
        currentVersion: "1.0.0",
        latestVersion: "2.0.0",
        hasUpdate: true,
      };
      mockNPMManager.checkForLatestVersion = vi.fn().mockResolvedValue(result);
      vi.mocked(NPMManager).mockImplementation(
        () => mockNPMManager as unknown as NPMManager
      );

      const mockContext = createMockContext() as unknown as Context<AppContext>;
      const response = await handler.checkLatestVersion(mockContext);
      const responseData = await response.json();

      expect(mockNPMManager.checkForLatestVersion).toHaveBeenCalled();
      expect(mockLogger.debug).toHaveBeenCalledWith("处理检查最新版本请求");
      expect(mockLogger.debug).toHaveBeenCalledWith("版本检查结果:", result);
      expect(responseData).toEqual({
        success: true,
        data: result,
      });
      expect(response.status).toBe(200);
    });

    it("应该成功返回版本检查结果（无更新）", async () => {
      const result = {
        currentVersion: "2.0.0",
        latestVersion: "2.0.0",
        hasUpdate: false,
      };
      mockNPMManager.checkForLatestVersion = vi.fn().mockResolvedValue(result);
      vi.mocked(NPMManager).mockImplementation(
        () => mockNPMManager as unknown as NPMManager
      );

      const mockContext = createMockContext() as unknown as Context<AppContext>;
      const response = await handler.checkLatestVersion(mockContext);
      const responseData = await response.json();

      expect(responseData).toEqual({
        success: true,
        data: result,
      });
    });

    it("应该返回部分信息和错误消息（当有错误时）", async () => {
      const result = {
        currentVersion: "1.0.0",
        latestVersion: null,
        hasUpdate: false,
        error: "无法获取可用版本列表",
      };
      mockNPMManager.checkForLatestVersion = vi.fn().mockResolvedValue(result);
      vi.mocked(NPMManager).mockImplementation(
        () => mockNPMManager as unknown as NPMManager
      );

      const mockContext = createMockContext() as unknown as Context<AppContext>;
      const response = await handler.checkLatestVersion(mockContext);
      const responseData = await response.json();

      expect(responseData).toEqual({
        success: true,
        data: result,
      });
    });

    it("应该处理检查最新版本时的错误", async () => {
      const error = new Error("网络连接失败");
      mockNPMManager.checkForLatestVersion = vi.fn().mockRejectedValue(error);
      vi.mocked(NPMManager).mockImplementation(
        () => mockNPMManager as unknown as NPMManager
      );

      const mockContext = createMockContext() as unknown as Context<AppContext>;
      const response = await handler.checkLatestVersion(mockContext);
      const responseData = await response.json();

      expect(mockLogger.error).toHaveBeenCalledWith("检查最新版本失败:", error);
      expect(responseData).toEqual({
        success: false,
        error: {
          code: "LATEST_VERSION_CHECK_ERROR",
          message: "网络连接失败",
        },
      });
      expect(response.status).toBe(500);
    });

    it("应该处理非 Error 类型的异常", async () => {
      mockNPMManager.checkForLatestVersion = vi.fn().mockRejectedValue(null);
      vi.mocked(NPMManager).mockImplementation(
        () => mockNPMManager as unknown as NPMManager
      );

      const mockContext = createMockContext() as unknown as Context<AppContext>;
      const response = await handler.checkLatestVersion(mockContext);
      const responseData = await response.json();

      expect(responseData).toEqual({
        success: false,
        error: {
          code: "LATEST_VERSION_CHECK_ERROR",
          message: "null",
        },
      });
      expect(response.status).toBe(500);
    });

    it("应该处理无法获取当前版本的情况", async () => {
      const result = {
        currentVersion: "unknown",
        latestVersion: null,
        hasUpdate: false,
        error: "无法获取当前版本信息",
      };
      mockNPMManager.checkForLatestVersion = vi.fn().mockResolvedValue(result);
      vi.mocked(NPMManager).mockImplementation(
        () => mockNPMManager as unknown as NPMManager
      );

      const mockContext = createMockContext() as unknown as Context<AppContext>;
      const response = await handler.checkLatestVersion(mockContext);
      const responseData = await response.json();

      expect(responseData.success).toBe(true);
      expect(responseData.data.currentVersion).toBe("unknown");
      expect(responseData.data.error).toBe("无法获取当前版本信息");
    });

    it("应该处理 latestVersion 为 null 的情况", async () => {
      const result = {
        currentVersion: "1.0.0",
        latestVersion: null,
        hasUpdate: false,
        error: "无法获取可用版本列表",
      };
      mockNPMManager.checkForLatestVersion = vi.fn().mockResolvedValue(result);
      vi.mocked(NPMManager).mockImplementation(
        () => mockNPMManager as unknown as NPMManager
      );

      const mockContext = createMockContext() as unknown as Context<AppContext>;
      const response = await handler.checkLatestVersion(mockContext);
      const responseData = await response.json();

      expect(responseData.success).toBe(true);
      expect(responseData.data.latestVersion).toBeNull();
    });
  });

  describe("边界条件测试", () => {
    it("应该处理版本信息中的 null 值", async () => {
      const versionInfo: VersionInfo = {
        version: "1.0.0",
        name: null,
        description: null,
        author: null as unknown as string,
      };
      vi.mocked(VersionUtils.getVersionInfo).mockReturnValue(versionInfo);

      const mockContext = createMockContext() as unknown as Context<AppContext>;
      const response = await handler.getVersion(mockContext);
      const responseData = await response.json();

      expect(responseData.success).toBe(true);
      expect(responseData.data).toEqual(versionInfo);
    });

    it("应该处理包含 unicode 字符的版本号", async () => {
      const version = "1.0.0-🎉.1";
      vi.mocked(VersionUtils.getVersion).mockReturnValue(version);

      const mockContext = createMockContext() as unknown as Context<AppContext>;
      const response = await handler.getVersionSimple(mockContext);
      const responseData = await response.json();

      expect(responseData.success).toBe(true);
      expect(responseData.data.version).toBe(version);
    });

    it("应该处理大量版本列表", async () => {
      const versions = Array.from(
        { length: 1000 },
        (_, i) => `${Math.floor(i / 100)}.${i % 100}.0`
      );
      mockNPMManager.getAvailableVersions = vi.fn().mockResolvedValue(versions);
      vi.mocked(NPMManager).mockImplementation(
        () => mockNPMManager as unknown as NPMManager
      );

      const mockContext = createMockContext() as unknown as Context<AppContext>;
      const response = await handler.getAvailableVersions(mockContext);
      const responseData = await response.json();

      expect(responseData.success).toBe(true);
      expect(responseData.data.versions).toHaveLength(1000);
      expect(responseData.data.total).toBe(1000);
    });
  });

  describe("响应格式验证", () => {
    it("成功响应应该包含正确的结构", async () => {
      const versionInfo = { version: "1.0.0" };
      vi.mocked(VersionUtils.getVersionInfo).mockReturnValue(versionInfo);

      const mockContext = createMockContext() as unknown as Context<AppContext>;
      const response = await handler.getVersion(mockContext);
      const responseData = await response.json();

      expect(responseData).toHaveProperty("success", true);
      expect(responseData).toHaveProperty("data", versionInfo);
      expect(responseData).not.toHaveProperty("error");
    });

    it("错误响应应该包含正确的结构", async () => {
      const error = new Error("测试错误");
      vi.mocked(VersionUtils.getVersionInfo).mockImplementation(() => {
        throw error;
      });

      const mockContext = createMockContext() as unknown as Context<AppContext>;
      const response = await handler.getVersion(mockContext);
      const responseData = await response.json();

      expect(responseData).toHaveProperty("success", false);
      expect(responseData).toHaveProperty("error");
      expect(responseData.error).toHaveProperty("code");
      expect(responseData.error).toHaveProperty("message");
    });

    it("成功响应可以包含消息", async () => {
      const mockContext = createMockContext() as unknown as Context<AppContext>;
      const response = await handler.clearVersionCache(mockContext);
      const responseData = await response.json();

      expect(responseData).toHaveProperty("success", true);
      expect(responseData).toHaveProperty("message", "版本缓存已清除");
      // data 为 undefined 时不会添加 data 字段
      expect(responseData).not.toHaveProperty("data");
    });
  });

  describe("HTTP 状态码验证", () => {
    it("成功操作应该返回 200 状态码", async () => {
      vi.mocked(VersionUtils.getVersionInfo).mockReturnValue({ version: "1.0.0" });

      const mockContext = createMockContext() as unknown as Context<AppContext>;
      const response = await handler.getVersion(mockContext);

      expect(response.status).toBe(200);
    });

    it("客户端错误应该返回 400 状态码", async () => {
      const mockContext = createMockContext({
        req: {
          query: vi.fn((key: string) => {
            if (key === "type") return "invalid";
            return undefined;
          }),
        },
      }) as unknown as Context<AppContext>;

      const response = await handler.getAvailableVersions(mockContext);

      expect(response.status).toBe(400);
    });

    it("服务器错误应该返回 500 状态码", async () => {
      const error = new Error("服务器内部错误");
      vi.mocked(VersionUtils.getVersionInfo).mockImplementation(() => {
        throw error;
      });

      const mockContext = createMockContext() as unknown as Context<AppContext>;
      const response = await handler.getVersion(mockContext);

      expect(response.status).toBe(500);
    });
  });

  describe("日志记录验证", () => {
    it("应该记录所有重要操作的日志", async () => {
      const versionInfo = { version: "1.0.0" };
      vi.mocked(VersionUtils.getVersionInfo).mockReturnValue(versionInfo);

      const mockContext = createMockContext() as unknown as Context<AppContext>;
      await handler.getVersion(mockContext);

      expect(mockLogger.debug).toHaveBeenCalledWith("处理获取版本信息请求");
      expect(mockLogger.debug).toHaveBeenCalledWith("获取版本信息成功:", versionInfo);
    });

    it("应该记录错误日志", async () => {
      const error = new Error("测试错误");
      vi.mocked(VersionUtils.getVersionInfo).mockImplementation(() => {
        throw error;
      });

      const mockContext = createMockContext() as unknown as Context<AppContext>;
      await handler.getVersion(mockContext);

      expect(mockLogger.error).toHaveBeenCalledWith("获取版本信息失败:", error);
    });

    it("应该记录信息级别的日志", async () => {
      const mockContext = createMockContext() as unknown as Context<AppContext>;
      await handler.clearVersionCache(mockContext);

      expect(mockLogger.info).toHaveBeenCalledWith("版本缓存已清除");
    });
  });

  describe("并发和性能测试", () => {
    it("应该能够处理并发的版本查询请求", async () => {
      const versionInfo = { version: "1.0.0" };
      vi.mocked(VersionUtils.getVersionInfo).mockReturnValue(versionInfo);

      const mockContext = createMockContext() as unknown as Context<AppContext>;
      const promises = Array.from({ length: 10 }, () =>
        handler.getVersion(mockContext)
      );

      const responses = await Promise.all(promises);

      expect(responses).toHaveLength(10);
      for (const response of responses) {
        const data = await response.json();
        expect(data.success).toBe(true);
        expect(data.data).toEqual(versionInfo);
      }
      expect(VersionUtils.getVersionInfo).toHaveBeenCalledTimes(10);
    });

    it("应该能够处理并发的版本检查请求", async () => {
      const result = {
        currentVersion: "1.0.0",
        latestVersion: "2.0.0",
        hasUpdate: true,
      };
      mockNPMManager.checkForLatestVersion = vi.fn().mockResolvedValue(result);
      vi.mocked(NPMManager).mockImplementation(
        () => mockNPMManager as unknown as NPMManager
      );

      const mockContext = createMockContext() as unknown as Context<AppContext>;
      const promises = Array.from({ length: 5 }, () =>
        handler.checkLatestVersion(mockContext)
      );

      const responses = await Promise.all(promises);

      expect(responses).toHaveLength(5);
      for (const response of responses) {
        const data = await response.json();
        expect(data.success).toBe(true);
      }
      expect(mockNPMManager.checkForLatestVersion).toHaveBeenCalledTimes(5);
    });

    it("应该在高频请求下保持性能", async () => {
      vi.mocked(VersionUtils.getVersion).mockReturnValue("1.0.0");

      const mockContext = createMockContext() as unknown as Context<AppContext>;
      const startTime = Date.now();
      const promises = Array.from({ length: 100 }, () =>
        handler.getVersionSimple(mockContext)
      );

      await Promise.all(promises);
      const endTime = Date.now();

      expect(endTime - startTime).toBeLessThan(1000);
      expect(VersionUtils.getVersion).toHaveBeenCalledTimes(100);
    });
  });

  describe("集成测试", () => {
    it("应该正确处理完整的版本管理工作流", async () => {
      // 1. 获取完整版本信息
      const versionInfo: VersionInfo = {
        version: "1.0.0",
        name: "xiaozhi-client",
      };
      vi.mocked(VersionUtils.getVersionInfo).mockReturnValue(versionInfo);

      let mockContext = createMockContext() as unknown as Context<AppContext>;
      let response = await handler.getVersion(mockContext);
      let data = await response.json();
      expect(data.success).toBe(true);
      expect(data.data).toEqual(versionInfo);

      // 2. 获取简化版本信息
      const version = "1.0.0";
      vi.mocked(VersionUtils.getVersion).mockReturnValue(version);

      response = await handler.getVersionSimple(mockContext);
      data = await response.json();
      expect(data.success).toBe(true);
      expect(data.data.version).toBe(version);

      // 3. 检查最新版本
      const checkResult = {
        currentVersion: "1.0.0",
        latestVersion: "2.0.0",
        hasUpdate: true,
      };
      mockNPMManager.checkForLatestVersion = vi.fn().mockResolvedValue(checkResult);
      mockNPMManager.getAvailableVersions = vi.fn().mockResolvedValue(["1.0.0", "2.0.0"]);
      vi.mocked(NPMManager).mockImplementation(
        () => mockNPMManager as unknown as NPMManager
      );

      response = await handler.checkLatestVersion(mockContext);
      data = await response.json();
      expect(data.success).toBe(true);
      expect(data.data.hasUpdate).toBe(true);

      // 4. 获取可用版本列表
      response = await handler.getAvailableVersions(mockContext);
      data = await response.json();
      expect(data.success).toBe(true);

      // 5. 清除缓存
      response = await handler.clearVersionCache(mockContext);
      data = await response.json();
      expect(data.success).toBe(true);

      // 验证所有调用
      expect(VersionUtils.getVersionInfo).toHaveBeenCalled();
      expect(VersionUtils.getVersion).toHaveBeenCalled();
      expect(mockNPMManager.checkForLatestVersion).toHaveBeenCalled();
      expect(mockNPMManager.getAvailableVersions).toHaveBeenCalled();
      expect(VersionUtils.clearCache).toHaveBeenCalled();
    });

    it("应该正确处理混合成功和失败的操作", async () => {
      // 成功的操作
      vi.mocked(VersionUtils.getVersionInfo).mockReturnValue({ version: "1.0.0" });
      const mockContext = createMockContext() as unknown as Context<AppContext>;
      let response = await handler.getVersion(mockContext);
      let data = await response.json();
      expect(data.success).toBe(true);

      // 失败的操作
      vi.mocked(VersionUtils.getVersion).mockImplementation(() => {
        throw new Error("版本获取失败");
      });
      response = await handler.getVersionSimple(mockContext);
      data = await response.json();
      expect(data.error).toBeDefined();

      // 再次成功的操作
      vi.mocked(VersionUtils.clearCache).mockReturnValue(undefined);
      response = await handler.clearVersionCache(mockContext);
      data = await response.json();
      expect(data.success).toBe(true);
    });
  });

  describe("数据类型和格式验证", () => {
    it("应该处理各种类型的版本信息", async () => {
      const testCases: VersionInfo[] = [
        { version: "1.0.0" },
        { version: "1.0.0-alpha" },
        { version: "1.0.0-beta.1" },
        { version: "1.0.0-rc.1+build.123" },
        { version: "2.0.0" },
      ];

      const mockContext = createMockContext() as unknown as Context<AppContext>;
      for (const versionInfo of testCases) {
        vi.mocked(VersionUtils.getVersionInfo).mockReturnValue(versionInfo);

        const response = await handler.getVersion(mockContext);
        const data = await response.json();

        expect(data.success).toBe(true);
        expect(data.data).toEqual(versionInfo);
      }
    });

    it("应该正确验证版本类型参数", async () => {
      const validTypes = ["stable", "rc", "beta", "all"];
      mockNPMManager.getAvailableVersions = vi.fn().mockResolvedValue([]);
      vi.mocked(NPMManager).mockImplementation(
        () => mockNPMManager as unknown as NPMManager
      );

      for (const type of validTypes) {
        const mockContext = createMockContext({
          req: {
            query: vi.fn((key: string) => {
              if (key === "type") return type;
              return undefined;
            }),
          },
        }) as unknown as Context<AppContext>;

        const response = await handler.getAvailableVersions(mockContext);
        const data = await response.json();

        expect(data.success).toBe(true);
        expect(data.data.type).toBe(type);
      }
    });

    it("应该处理版本检查结果的多种格式", async () => {
      const testCases = [
        {
          currentVersion: "1.0.0",
          latestVersion: "2.0.0",
          hasUpdate: true,
        },
        {
          currentVersion: "2.0.0",
          latestVersion: "2.0.0",
          hasUpdate: false,
        },
        {
          currentVersion: "1.0.0",
          latestVersion: null,
          hasUpdate: false,
          error: "无法获取可用版本列表",
        },
      ];

      const mockContext = createMockContext() as unknown as Context<AppContext>;
      for (const result of testCases) {
        mockNPMManager.checkForLatestVersion = vi.fn().mockResolvedValue(result);
        vi.mocked(NPMManager).mockImplementation(
          () => mockNPMManager as unknown as NPMManager
        );

        const response = await handler.checkLatestVersion(mockContext);
        const data = await response.json();

        expect(data.success).toBe(true);
        expect(data.data).toMatchObject(result);
      }
    });
  });

  describe("错误恢复和容错性", () => {
    it("应该在错误后继续工作", async () => {
      // 第一次调用失败
      vi.mocked(VersionUtils.getVersionInfo)
        .mockImplementationOnce(() => {
          throw new Error("临时错误");
        })
        .mockReturnValueOnce({ version: "1.0.0" });

      const mockContext = createMockContext() as unknown as Context<AppContext>;
      // 第一次请求失败
      const response1 = await handler.getVersion(mockContext);
      const data1 = await response1.json();
      expect(data1.error).toBeDefined();

      // 第二次请求成功
      const response2 = await handler.getVersion(mockContext);
      const data2 = await response2.json();
      expect(data2.success).toBe(true);
      expect(data2.data.version).toBe("1.0.0");
    });

    it("应该正确处理 NPMManager 抛出的异常", async () => {
      const error = new Error("NPM 服务不可用");
      mockNPMManager.getAvailableVersions = vi.fn().mockRejectedValue(error);
      vi.mocked(NPMManager).mockImplementation(
        () => mockNPMManager as unknown as NPMManager
      );

      const mockContext = createMockContext() as unknown as Context<AppContext>;
      const response = await handler.getAvailableVersions(mockContext);
      const data = await response.json();

      expect(data.error).toBeDefined();
      expect(data.error.code).toBe("VERSIONS_FETCH_ERROR");
    });

    it("应该正确处理 VersionUtils 抛出的异常", async () => {
      const error = new Error("版本工具错误");
      vi.mocked(VersionUtils.getVersionInfo).mockImplementation(() => {
        throw error;
      });

      const mockContext = createMockContext() as unknown as Context<AppContext>;
      const response = await handler.getVersion(mockContext);
      const data = await response.json();

      expect(data.error).toBeDefined();
      expect(data.error.code).toBe("VERSION_READ_ERROR");
    });
  });
});

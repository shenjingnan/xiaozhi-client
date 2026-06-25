import type { VersionInfo } from "@xiaozhi-client/version";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { VersionApiHandler } from "../version.handler.js";

// 模拟依赖项
vi.mock("../../Logger.js", () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
}));

vi.mock("@xiaozhi-client/version", () => ({
  VersionUtils: {
    getVersion: vi.fn(),
    getVersionInfo: vi.fn(),
    clearCache: vi.fn(),
  },
}));

vi.mock("@/lib/npm/index.js", () => ({
  NPMManager: vi.fn(),
}));

describe("VersionApiHandler 版本 API 处理器", () => {
  let versionApiHandler: VersionApiHandler;
  let mockVersionUtils: any;
  let mockNPMManager: any;
  let mockContext: any;
  let mockLogger: any;

  beforeEach(async () => {
    vi.clearAllMocks();

    // 模拟 Logger
    mockLogger = {
      debug: vi.fn(),
      info: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
    };
    const { logger } = await import("../../Logger.js");
    Object.assign(logger, mockLogger);

    // 模拟 VersionUtils
    mockVersionUtils = {
      getVersion: vi.fn().mockReturnValue("1.0.0"),
      getVersionInfo: vi.fn().mockReturnValue({
        version: "1.0.0",
        name: "xiaozhi-client",
        description: "MCP 客户端",
        author: "test",
      }),
      clearCache: vi.fn(),
    };
    const { VersionUtils } = await import("@xiaozhi-client/version");
    Object.assign(VersionUtils, mockVersionUtils);

    // 模拟 NPMManager
    mockNPMManager = {
      getAvailableVersions: vi.fn().mockResolvedValue(["1.0.0", "0.9.0"]),
      checkForLatestVersion: vi.fn().mockResolvedValue({
        currentVersion: "1.0.0",
        latestVersion: "1.1.0",
        hasUpdate: true,
      }),
    };
    const { NPMManager } = await import("@/lib/npm/index.js");
    (NPMManager as any).mockImplementation(() => mockNPMManager);

    // 模拟 Hono 上下文
    mockContext = {
      get: vi.fn((key: string) => {
        if (key === "logger") return mockLogger;
        return undefined;
      }),
      success: vi
        .fn()
        .mockImplementation((data: unknown, message?: string, status = 200) => {
          const response: {
            success: true;
            data?: unknown;
            message?: string;
          } = {
            success: true,
            message,
          };
          if (data !== undefined) {
            response.data = data;
          }
          return new Response(JSON.stringify(response), {
            status,
            headers: { "Content-Type": "application/json" },
          });
        }),
      fail: vi
        .fn()
        .mockImplementation(
          (code: string, message: string, details?: any, status = 400) => {
            return new Response(
              JSON.stringify({
                success: false,
                error: {
                  code,
                  message,
                  ...(details !== undefined && { details }),
                },
              }),
              {
                status,
                headers: { "Content-Type": "application/json" },
              }
            );
          }
        ),
      req: {
        json: vi.fn(),
        query: vi.fn(),
      },
      logger: mockLogger,
    };

    versionApiHandler = new VersionApiHandler();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("构造函数", () => {
    it("应该使用正确的依赖项初始化", () => {
      expect(versionApiHandler).toBeInstanceOf(VersionApiHandler);
      expect(mockLogger.debug).not.toHaveBeenCalled();
    });
  });

  describe("getVersion 获取版本信息", () => {
    it("应该成功返回版本信息", async () => {
      const mockVersionInfo: VersionInfo = {
        version: "1.0.0",
        name: "xiaozhi-client",
        description: "MCP 客户端",
        author: "test",
      };
      mockVersionUtils.getVersionInfo.mockReturnValue(mockVersionInfo);

      const response = await versionApiHandler.getVersion(mockContext);
      const responseData = await response.json();

      expect(mockVersionUtils.getVersionInfo).toHaveBeenCalledTimes(1);
      expect(mockLogger.debug).toHaveBeenCalledWith("处理获取版本信息请求");
      expect(mockLogger.debug).toHaveBeenCalledWith(
        "获取版本信息成功:",
        mockVersionInfo
      );
      expect(responseData).toEqual({
        success: true,
        data: mockVersionInfo,
      });
      expect(response.status).toBe(200);
    });

    it("应该处理 VersionUtils 抛出异常", async () => {
      const error = new Error("版本信息获取失败");
      mockVersionUtils.getVersionInfo.mockImplementation(() => {
        throw error;
      });

      const response = await versionApiHandler.getVersion(mockContext);
      const responseData = await response.json();

      expect(mockLogger.error).toHaveBeenCalledWith("获取版本信息失败:", error);
      expect(responseData).toEqual({
        success: false,
        error: {
          code: "VERSION_READ_ERROR",
          message: "版本信息获取失败",
        },
      });
      expect(response.status).toBe(500);
    });

    it("应该处理非 Error 类型的异常", async () => {
      mockVersionUtils.getVersionInfo.mockImplementation(() => {
        throw "字符串错误";
      });

      const response = await versionApiHandler.getVersion(mockContext);
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
  });

  describe("getVersionSimple 获取版本号", () => {
    it("应该成功返回版本号", async () => {
      mockVersionUtils.getVersion.mockReturnValue("1.0.0");

      const response = await versionApiHandler.getVersionSimple(mockContext);
      const responseData = await response.json();

      expect(mockVersionUtils.getVersion).toHaveBeenCalledTimes(1);
      expect(mockLogger.debug).toHaveBeenCalledWith("处理获取版本号请求");
      expect(mockLogger.debug).toHaveBeenCalledWith("获取版本号成功: 1.0.0");
      expect(responseData).toEqual({
        success: true,
        data: { version: "1.0.0" },
      });
      expect(response.status).toBe(200);
    });

    it("应该处理获取版本号时的错误", async () => {
      const error = new Error("版本号获取失败");
      mockVersionUtils.getVersion.mockImplementation(() => {
        throw error;
      });

      const response = await versionApiHandler.getVersionSimple(mockContext);
      const responseData = await response.json();

      expect(mockLogger.error).toHaveBeenCalledWith("获取版本号失败:", error);
      expect(responseData).toEqual({
        success: false,
        error: {
          code: "VERSION_READ_ERROR",
          message: "版本号获取失败",
        },
      });
      expect(response.status).toBe(500);
    });

    it("应该处理非 Error 类型的异常", async () => {
      mockVersionUtils.getVersion.mockImplementation(() => {
        throw "字符串错误";
      });

      const response = await versionApiHandler.getVersionSimple(mockContext);
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
  });

  describe("clearVersionCache 清除版本缓存", () => {
    it("应该成功清除版本缓存", async () => {
      const response = await versionApiHandler.clearVersionCache(mockContext);
      const responseData = await response.json();

      expect(mockVersionUtils.clearCache).toHaveBeenCalledTimes(1);
      expect(mockLogger.debug).toHaveBeenCalledWith("处理清除版本缓存请求");
      expect(mockLogger.info).toHaveBeenCalledWith("版本缓存已清除");
      expect(responseData).toEqual({
        success: true,
        message: "版本缓存已清除",
      });
      expect(response.status).toBe(200);
    });

    it("应该处理清除缓存时的错误", async () => {
      const error = new Error("缓存清除失败");
      mockVersionUtils.clearCache.mockImplementation(() => {
        throw error;
      });

      const response = await versionApiHandler.clearVersionCache(mockContext);
      const responseData = await response.json();

      expect(mockLogger.error).toHaveBeenCalledWith("清除版本缓存失败:", error);
      expect(responseData).toEqual({
        success: false,
        error: {
          code: "CACHE_CLEAR_ERROR",
          message: "缓存清除失败",
        },
      });
      expect(response.status).toBe(500);
    });

    it("应该处理非 Error 类型的异常", async () => {
      mockVersionUtils.clearCache.mockImplementation(() => {
        throw "字符串错误";
      });

      const response = await versionApiHandler.clearVersionCache(mockContext);
      const responseData = await response.json();

      expect(responseData).toEqual({
        success: false,
        error: {
          code: "CACHE_CLEAR_ERROR",
          message: "字符串错误",
        },
      });
      expect(response.status).toBe(500);
    });
  });

  describe("getAvailableVersions 获取可用版本列表", () => {
    it("应该成功获取 stable 版本列表", async () => {
      const mockVersions = ["1.1.0", "1.0.0", "0.9.0"];
      mockNPMManager.getAvailableVersions.mockResolvedValue(mockVersions);
      mockContext.req.query.mockReturnValue("stable");

      const response =
        await versionApiHandler.getAvailableVersions(mockContext);
      const responseData = await response.json();

      expect(mockLogger.debug).toHaveBeenCalledWith("处理获取可用版本列表请求");
      expect(mockNPMManager.getAvailableVersions).toHaveBeenCalledWith(
        "stable"
      );
      expect(mockLogger.debug).toHaveBeenCalledWith(
        "获取到 3 个可用版本 (类型: stable)"
      );
      expect(responseData).toEqual({
        success: true,
        data: {
          versions: mockVersions,
          type: "stable",
          total: 3,
        },
      });
      expect(response.status).toBe(200);
    });

    it("应该成功获取 rc 版本列表", async () => {
      const mockVersions = ["1.1.0-rc.1", "1.0.0-rc.2"];
      mockNPMManager.getAvailableVersions.mockResolvedValue(mockVersions);
      mockContext.req.query.mockReturnValue("rc");

      const response =
        await versionApiHandler.getAvailableVersions(mockContext);
      const responseData = await response.json();

      expect(mockNPMManager.getAvailableVersions).toHaveBeenCalledWith("rc");
      expect(responseData).toEqual({
        success: true,
        data: {
          versions: mockVersions,
          type: "rc",
          total: 2,
        },
      });
      expect(response.status).toBe(200);
    });

    it("应该成功获取 beta 版本列表", async () => {
      const mockVersions = ["1.1.0-beta.1", "1.0.0-beta.2"];
      mockNPMManager.getAvailableVersions.mockResolvedValue(mockVersions);
      mockContext.req.query.mockReturnValue("beta");

      const response =
        await versionApiHandler.getAvailableVersions(mockContext);
      const responseData = await response.json();

      expect(mockNPMManager.getAvailableVersions).toHaveBeenCalledWith("beta");
      expect(responseData).toEqual({
        success: true,
        data: {
          versions: mockVersions,
          type: "beta",
          total: 2,
        },
      });
      expect(response.status).toBe(200);
    });

    it("应该成功获取所有版本列表", async () => {
      const mockVersions = ["1.1.0", "1.1.0-rc.1", "1.0.0-beta.1", "1.0.0"];
      mockNPMManager.getAvailableVersions.mockResolvedValue(mockVersions);
      mockContext.req.query.mockReturnValue("all");

      const response =
        await versionApiHandler.getAvailableVersions(mockContext);
      const responseData = await response.json();

      expect(mockNPMManager.getAvailableVersions).toHaveBeenCalledWith("all");
      expect(responseData).toEqual({
        success: true,
        data: {
          versions: mockVersions,
          type: "all",
          total: 4,
        },
      });
      expect(response.status).toBe(200);
    });

    it("应该默认获取 stable 版本列表（无参数）", async () => {
      const mockVersions = ["1.1.0", "1.0.0"];
      mockNPMManager.getAvailableVersions.mockResolvedValue(mockVersions);
      mockContext.req.query.mockReturnValue(undefined);

      const response =
        await versionApiHandler.getAvailableVersions(mockContext);
      const responseData = await response.json();

      expect(mockNPMManager.getAvailableVersions).toHaveBeenCalledWith(
        "stable"
      );
      expect(responseData.data.type).toBe("stable");
    });

    it("应该拒绝无效的版本类型参数", async () => {
      mockContext.req.query.mockReturnValue("invalid");

      const response =
        await versionApiHandler.getAvailableVersions(mockContext);
      const responseData = await response.json();

      expect(mockNPMManager.getAvailableVersions).not.toHaveBeenCalled();
      expect(responseData).toEqual({
        success: false,
        error: {
          code: "INVALID_VERSION_TYPE",
          message: "无效的版本类型: invalid。支持的类型: stable, rc, beta, all",
        },
      });
      expect(response.status).toBe(400);
    });

    it("应该处理 NPMManager 抛出异常", async () => {
      const error = new Error("NPM 服务不可用");
      mockNPMManager.getAvailableVersions.mockRejectedValue(error);
      mockContext.req.query.mockReturnValue("stable");

      const response =
        await versionApiHandler.getAvailableVersions(mockContext);
      const responseData = await response.json();

      expect(mockLogger.error).toHaveBeenCalledWith(
        "获取可用版本列表失败:",
        error
      );
      expect(responseData).toEqual({
        success: false,
        error: {
          code: "VERSIONS_FETCH_ERROR",
          message: "NPM 服务不可用",
        },
      });
      expect(response.status).toBe(500);
    });

    it("应该处理空版本列表", async () => {
      mockNPMManager.getAvailableVersions.mockResolvedValue([]);
      mockContext.req.query.mockReturnValue("stable");

      const response =
        await versionApiHandler.getAvailableVersions(mockContext);
      const responseData = await response.json();

      expect(responseData).toEqual({
        success: true,
        data: {
          versions: [],
          type: "stable",
          total: 0,
        },
      });
      expect(response.status).toBe(200);
    });

    it("应该处理非 Error 类型的异常", async () => {
      mockNPMManager.getAvailableVersions.mockRejectedValue("字符串错误");
      mockContext.req.query.mockReturnValue("stable");

      const response =
        await versionApiHandler.getAvailableVersions(mockContext);
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
  });

  describe("checkLatestVersion 检查最新版本", () => {
    it("应该成功检查版本并有更新", async () => {
      mockNPMManager.checkForLatestVersion.mockResolvedValue({
        currentVersion: "1.0.0",
        latestVersion: "1.1.0",
        hasUpdate: true,
      });

      const response = await versionApiHandler.checkLatestVersion(mockContext);
      const responseData = await response.json();

      expect(mockLogger.debug).toHaveBeenCalledWith("处理检查最新版本请求");
      expect(mockNPMManager.checkForLatestVersion).toHaveBeenCalledTimes(1);
      expect(mockLogger.debug).toHaveBeenCalledWith("版本检查结果:", {
        currentVersion: "1.0.0",
        latestVersion: "1.1.0",
        hasUpdate: true,
      });
      expect(responseData).toEqual({
        success: true,
        data: {
          currentVersion: "1.0.0",
          latestVersion: "1.1.0",
          hasUpdate: true,
        },
      });
      expect(response.status).toBe(200);
    });

    it("应该成功检查版本但无更新", async () => {
      mockNPMManager.checkForLatestVersion.mockResolvedValue({
        currentVersion: "1.1.0",
        latestVersion: "1.1.0",
        hasUpdate: false,
      });

      const response = await versionApiHandler.checkLatestVersion(mockContext);
      const responseData = await response.json();

      expect(responseData).toEqual({
        success: true,
        data: {
          currentVersion: "1.1.0",
          latestVersion: "1.1.0",
          hasUpdate: false,
        },
      });
      expect(response.status).toBe(200);
    });

    it("应该返回部分信息当有错误时", async () => {
      mockNPMManager.checkForLatestVersion.mockResolvedValue({
        currentVersion: "unknown",
        latestVersion: null,
        hasUpdate: false,
        error: "无法获取当前版本信息",
      });

      const response = await versionApiHandler.checkLatestVersion(mockContext);
      const responseData = await response.json();

      expect(responseData).toEqual({
        success: true,
        data: {
          currentVersion: "unknown",
          latestVersion: null,
          hasUpdate: false,
          error: "无法获取当前版本信息",
        },
      });
      expect(response.status).toBe(200);
    });

    it("应该处理 NPMManager 抛出异常", async () => {
      const error = new Error("版本检查失败");
      mockNPMManager.checkForLatestVersion.mockRejectedValue(error);

      const response = await versionApiHandler.checkLatestVersion(mockContext);
      const responseData = await response.json();

      expect(mockLogger.error).toHaveBeenCalledWith("检查最新版本失败:", error);
      expect(responseData).toEqual({
        success: false,
        error: {
          code: "LATEST_VERSION_CHECK_ERROR",
          message: "版本检查失败",
        },
      });
      expect(response.status).toBe(500);
    });

    it("应该处理非 Error 类型的异常", async () => {
      mockNPMManager.checkForLatestVersion.mockRejectedValue("字符串错误");

      const response = await versionApiHandler.checkLatestVersion(mockContext);
      const responseData = await response.json();

      expect(responseData).toEqual({
        success: false,
        error: {
          code: "LATEST_VERSION_CHECK_ERROR",
          message: "字符串错误",
        },
      });
      expect(response.status).toBe(500);
    });

    it("应该处理无法获取可用版本列表的情况", async () => {
      mockNPMManager.checkForLatestVersion.mockResolvedValue({
        currentVersion: "1.0.0",
        latestVersion: null,
        hasUpdate: false,
        error: "无法获取可用版本列表",
      });

      const response = await versionApiHandler.checkLatestVersion(mockContext);
      const responseData = await response.json();

      expect(responseData).toEqual({
        success: true,
        data: {
          currentVersion: "1.0.0",
          latestVersion: null,
          hasUpdate: false,
          error: "无法获取可用版本列表",
        },
      });
      expect(response.status).toBe(200);
    });
  });

  describe("响应格式验证", () => {
    it("成功响应应该包含正确的结构", async () => {
      const mockVersionInfo = { version: "1.0.0" };
      mockVersionUtils.getVersionInfo.mockReturnValue(mockVersionInfo);

      const response = await versionApiHandler.getVersion(mockContext);
      const responseData = await response.json();

      expect(responseData).toHaveProperty("success", true);
      expect(responseData).toHaveProperty("data", mockVersionInfo);
      expect(responseData).not.toHaveProperty("error");
    });

    it("错误响应应该包含正确的结构", async () => {
      const error = new Error("测试错误");
      mockVersionUtils.getVersionInfo.mockImplementation(() => {
        throw error;
      });

      const response = await versionApiHandler.getVersion(mockContext);
      const responseData = await response.json();

      expect(responseData).toHaveProperty("success", false);
      expect(responseData).toHaveProperty("error");
      expect(responseData.error).toHaveProperty("code");
      expect(responseData.error).toHaveProperty("message");
    });

    it("成功响应可以包含消息", async () => {
      const response = await versionApiHandler.clearVersionCache(mockContext);
      const responseData = await response.json();

      expect(responseData).toHaveProperty("success", true);
      expect(responseData).toHaveProperty("message", "版本缓存已清除");
      expect(responseData).not.toHaveProperty("data");
    });
  });

  describe("边界条件测试", () => {
    it("应该处理空的版本信息", async () => {
      mockVersionUtils.getVersionInfo.mockReturnValue({ version: "unknown" });

      const response = await versionApiHandler.getVersion(mockContext);
      const responseData = await response.json();

      expect(responseData.success).toBe(true);
      expect(responseData.data).toEqual({ version: "unknown" });
    });

    it("应该处理大量版本列表", async () => {
      const largeVersionList = Array.from(
        { length: 1000 },
        (_, i) => `1.${Math.floor(i / 100)}.${i % 100}`
      );
      mockNPMManager.getAvailableVersions.mockResolvedValue(largeVersionList);
      mockContext.req.query.mockReturnValue("stable");

      const response =
        await versionApiHandler.getAvailableVersions(mockContext);
      const responseData = await response.json();

      expect(responseData.success).toBe(true);
      expect(responseData.data.versions).toHaveLength(1000);
      expect(responseData.data.total).toBe(1000);
    });

    it("应该处理版本信息包含特殊值", async () => {
      const specialVersionInfo: VersionInfo = {
        version: "1.0.0-beta.1+build.123",
        name: "test-app",
        description: "测试应用",
      };
      mockVersionUtils.getVersionInfo.mockReturnValue(specialVersionInfo);

      const response = await versionApiHandler.getVersion(mockContext);
      const responseData = await response.json();

      expect(responseData.success).toBe(true);
      expect(responseData.data).toEqual(specialVersionInfo);
    });
  });

  describe("并发和性能测试", () => {
    it("应该能够处理并发的版本查询请求", async () => {
      mockVersionUtils.getVersion.mockReturnValue("1.0.0");

      const promises = Array.from({ length: 10 }, () =>
        versionApiHandler.getVersionSimple(mockContext)
      );

      const responses = await Promise.all(promises);

      expect(responses).toHaveLength(10);
      for (const response of responses) {
        const data = await response.json();
        expect(data.success).toBe(true);
        expect(data.data.version).toBe("1.0.0");
      }
      expect(mockVersionUtils.getVersion).toHaveBeenCalledTimes(10);
    });

    it("应该能够处理并发的版本检查请求", async () => {
      mockNPMManager.checkForLatestVersion.mockResolvedValue({
        currentVersion: "1.0.0",
        latestVersion: "1.1.0",
        hasUpdate: true,
      });

      const promises = Array.from({ length: 5 }, () =>
        versionApiHandler.checkLatestVersion(mockContext)
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
      mockVersionUtils.getVersion.mockReturnValue("1.0.0");

      const startTime = Date.now();
      const promises = Array.from({ length: 100 }, () =>
        versionApiHandler.getVersionSimple(mockContext)
      );

      await Promise.all(promises);
      const endTime = Date.now();

      expect(endTime - startTime).toBeLessThan(1000);
      expect(mockVersionUtils.getVersion).toHaveBeenCalledTimes(100);
    });
  });

  describe("错误处理和恢复", () => {
    it("应该在 VersionUtils 抛出异常后继续工作", async () => {
      // 第一次调用失败
      mockVersionUtils.getVersionInfo
        .mockImplementationOnce(() => {
          throw new Error("临时错误");
        })
        .mockReturnValueOnce({ version: "1.0.0", recovered: true });

      // 第一次请求失败
      const response1 = await versionApiHandler.getVersion(mockContext);
      const data1 = await response1.json();
      expect(data1.error).toBeDefined();

      // 第二次请求成功
      const response2 = await versionApiHandler.getVersion(mockContext);
      const data2 = await response2.json();
      expect(data2.success).toBe(true);
      expect(data2.data).toEqual({ version: "1.0.0", recovered: true });
    });

    it("应该正确处理 NPMManager 实例化失败", async () => {
      const { NPMManager } = await import("@/lib/npm/index.js");
      (NPMManager as any).mockImplementation(() => {
        throw new Error("实例化失败");
      });

      const response =
        await versionApiHandler.getAvailableVersions(mockContext);
      const responseData = await response.json();

      expect(responseData.error).toBeDefined();
      expect(response.status).toBe(500);
    });
  });

  describe("日志记录验证", () => {
    it("应该记录所有重要操作的日志", async () => {
      mockVersionUtils.getVersionInfo.mockReturnValue({ version: "1.0.0" });

      await versionApiHandler.getVersion(mockContext);

      expect(mockLogger.debug).toHaveBeenCalledWith("处理获取版本信息请求");
      expect(mockLogger.debug).toHaveBeenCalledWith("获取版本信息成功:", {
        version: "1.0.0",
      });
    });

    it("应该记录错误日志", async () => {
      const error = new Error("测试错误");
      mockVersionUtils.getVersionInfo.mockImplementation(() => {
        throw error;
      });

      await versionApiHandler.getVersion(mockContext);

      expect(mockLogger.error).toHaveBeenCalledWith("获取版本信息失败:", error);
    });

    it("应该记录信息级别的日志", async () => {
      await versionApiHandler.clearVersionCache(mockContext);

      expect(mockLogger.info).toHaveBeenCalledWith("版本缓存已清除");
    });
  });

  describe("HTTP 状态码验证", () => {
    it("成功操作应该返回 200 状态码", async () => {
      mockVersionUtils.getVersion.mockReturnValue("1.0.0");

      const response = await versionApiHandler.getVersionSimple(mockContext);

      expect(response.status).toBe(200);
    });

    it("客户端错误应该返回 400 状态码", async () => {
      mockContext.req.query.mockReturnValue("invalid_type");

      const response =
        await versionApiHandler.getAvailableVersions(mockContext);

      expect(response.status).toBe(400);
    });

    it("服务器错误应该返回 500 状态码", async () => {
      const error = new Error("服务器内部错误");
      mockVersionUtils.getVersion.mockImplementation(() => {
        throw error;
      });

      const response = await versionApiHandler.getVersionSimple(mockContext);

      expect(response.status).toBe(500);
    });
  });

  describe("集成测试", () => {
    it("应该正确处理完整的版本管理工作流", async () => {
      // 1. 获取版本信息
      const mockVersionInfo = { version: "1.0.0", name: "xiaozhi-client" };
      mockVersionUtils.getVersionInfo.mockReturnValue(mockVersionInfo);

      let response = await versionApiHandler.getVersion(mockContext);
      let data = await response.json();
      expect(data.success).toBe(true);
      expect(data.data).toEqual(mockVersionInfo);

      // 2. 获取简化版本号
      mockVersionUtils.getVersion.mockReturnValue("1.0.0");

      response = await versionApiHandler.getVersionSimple(mockContext);
      data = await response.json();
      expect(data.success).toBe(true);
      expect(data.data.version).toBe("1.0.0");

      // 3. 检查最新版本
      mockNPMManager.checkForLatestVersion.mockResolvedValue({
        currentVersion: "1.0.0",
        latestVersion: "1.1.0",
        hasUpdate: true,
      });

      response = await versionApiHandler.checkLatestVersion(mockContext);
      data = await response.json();
      expect(data.success).toBe(true);
      expect(data.data.hasUpdate).toBe(true);

      // 4. 获取可用版本列表
      mockNPMManager.getAvailableVersions.mockResolvedValue(["1.1.0", "1.0.0"]);
      mockContext.req.query.mockReturnValue("stable");

      response = await versionApiHandler.getAvailableVersions(mockContext);
      data = await response.json();
      expect(data.success).toBe(true);
      expect(data.data.versions).toHaveLength(2);

      // 5. 清除缓存
      response = await versionApiHandler.clearVersionCache(mockContext);
      data = await response.json();
      expect(data.success).toBe(true);
      expect(mockVersionUtils.clearCache).toHaveBeenCalled();
    });

    it("应该正确处理混合成功和失败的操作", async () => {
      // 成功的操作
      mockVersionUtils.getVersion.mockReturnValue("1.0.0");
      let response = await versionApiHandler.getVersionSimple(mockContext);
      let data = await response.json();
      expect(data.success).toBe(true);

      // 失败的操作
      mockNPMManager.checkForLatestVersion.mockRejectedValue(
        new Error("服务不可用")
      );
      response = await versionApiHandler.checkLatestVersion(mockContext);
      data = await response.json();
      expect(data.error).toBeDefined();

      // 再次成功的操作
      mockVersionUtils.getVersionInfo.mockReturnValue({ version: "1.0.0" });
      response = await versionApiHandler.getVersion(mockContext);
      data = await response.json();
      expect(data.success).toBe(true);
    });
  });
});

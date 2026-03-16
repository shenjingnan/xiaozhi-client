/**
 * VersionApiHandler 单元测试
 * 测试版本 API 处理器的各种功能
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { VersionApiHandler } from "../version.handler.js";

// 模拟 Logger
vi.mock("../../Logger.js", () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
}));

// 模拟 VersionUtils
vi.mock("@xiaozhi-client/version", () => ({
  VersionUtils: {
    getVersionInfo: vi.fn(),
    getVersion: vi.fn(),
    clearCache: vi.fn(),
  },
}));

// 模拟 NPMManager
vi.mock("@/lib/npm/index.js", () => ({
  NPMManager: vi.fn().mockImplementation(function () {
    return {
      getAvailableVersions: vi.fn(),
      checkForLatestVersion: vi.fn(),
    };
  }),
}));

describe("VersionApiHandler", () => {
  let handler: VersionApiHandler;
  let mockLogger: any;
  let mockContext: any;
  let mockVersionUtils: any;
  let mockNPMManager: any;

  beforeEach(async () => {
    vi.clearAllMocks();

    // 设置模拟 Logger
    mockLogger = {
      debug: vi.fn(),
      info: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
    };
    const { logger } = await import("../../Logger.js");
    Object.assign(logger, mockLogger);

    // 设置模拟 VersionUtils
    const { VersionUtils } = await import("@xiaozhi-client/version");
    mockVersionUtils = VersionUtils;
    mockVersionUtils.getVersionInfo.mockReturnValue({
      version: "1.0.0",
      name: "xiaozhi-client",
    });
    mockVersionUtils.getVersion.mockReturnValue("1.0.0");
    mockVersionUtils.clearCache.mockReturnValue(undefined);

    // 设置模拟 NPMManager
    const { NPMManager } = await import("@/lib/npm/index.js");
    mockNPMManager = new NPMManager() as any;

    // 重置并设置 mock 函数
    mockNPMManager.getAvailableVersions = vi.fn().mockResolvedValue([
      "1.0.0",
      "1.0.1",
      "1.1.0",
    ]);
    mockNPMManager.checkForLatestVersion = vi.fn().mockResolvedValue({
      currentVersion: "1.0.0",
      latestVersion: "1.0.1",
      hasUpdate: true,
    });

    // 确保每次 new NPMManager() 都返回同一个 mock 实例
    (NPMManager as any).mockImplementation(() => mockNPMManager);
    (NPMManager as any).mockClear();

    // 设置模拟 Context
    mockContext = {
      get: vi.fn((key: string) => {
        if (key === "logger") return mockLogger;
        return undefined;
      }),
      // 添加 c.success 方法
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
      // 添加 c.fail 方法
      fail: vi
        .fn()
        .mockImplementation(
          (code: string, message: string, details?: unknown, status = 400) => {
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
        query: vi.fn(),
        json: vi.fn(),
      },
      logger: mockLogger, // 向后兼容
    };

    handler = new VersionApiHandler();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("构造函数", () => {
    it("应该正确初始化处理器", () => {
      expect(handler).toBeInstanceOf(VersionApiHandler);
      expect(mockLogger).toBeDefined();
    });
  });

  describe("getVersion 获取完整版本信息", () => {
    it("应该成功返回完整的版本信息", async () => {
      const versionInfo = {
        version: "1.0.0",
        name: "xiaozhi-client",
        description: "小智客户端",
      };
      mockVersionUtils.getVersionInfo.mockReturnValue(versionInfo);

      const response = await handler.getVersion(mockContext);
      const responseData = await response.json();

      expect(mockVersionUtils.getVersionInfo).toHaveBeenCalledTimes(1);
      expect(mockLogger.debug).toHaveBeenCalledWith("处理获取版本信息请求");
      expect(mockLogger.debug).toHaveBeenCalledWith(
        "获取版本信息成功:",
        versionInfo
      );
      expect(responseData).toEqual({
        success: true,
        data: versionInfo,
      });
      expect(response.status).toBe(200);
    });

    it("应该处理获取版本信息时的错误", async () => {
      const error = new Error("无法读取版本信息");
      mockVersionUtils.getVersionInfo.mockImplementation(() => {
        throw error;
      });

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
      mockVersionUtils.getVersionInfo.mockImplementation(() => {
        throw "字符串错误";
      });

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
  });

  describe("getVersionSimple 获取简化版本号", () => {
    it("应该成功返回简化版本号", async () => {
      const version = "2.0.0";
      mockVersionUtils.getVersion.mockReturnValue(version);

      const response = await handler.getVersionSimple(mockContext);
      const responseData = await response.json();

      expect(mockVersionUtils.getVersion).toHaveBeenCalledTimes(1);
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
      mockVersionUtils.getVersion.mockImplementation(() => {
        throw error;
      });

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
  });

  describe("clearVersionCache 清除版本缓存", () => {
    it("应该成功清除版本缓存", async () => {
      const response = await handler.clearVersionCache(mockContext);
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
      const error = new Error("清除缓存失败");
      mockVersionUtils.clearCache.mockImplementation(() => {
        throw error;
      });

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
  });

  describe("getAvailableVersions 获取可用版本列表", () => {
    it("应该成功返回 stable 类型版本列表", async () => {
      const versions = ["1.0.0", "1.0.1", "1.1.0"];
      mockContext.req.query.mockReturnValue("stable");
      mockNPMManager.getAvailableVersions.mockResolvedValue(versions);

      const response = await handler.getAvailableVersions(mockContext);
      const responseData = await response.json();

      expect(mockNPMManager.getAvailableVersions).toHaveBeenCalledWith("stable");
      expect(responseData).toEqual({
        success: true,
        data: {
          versions,
          type: "stable",
          total: 3,
        },
      });
      expect(response.status).toBe(200);
    });

    it("应该成功返回 rc 类型版本列表", async () => {
      const versions = ["1.0.0-rc.1", "1.0.0-rc.2"];
      mockContext.req.query.mockReturnValue("rc");
      mockNPMManager.getAvailableVersions.mockResolvedValue(versions);

      const response = await handler.getAvailableVersions(mockContext);
      const responseData = await response.json();

      expect(responseData).toEqual({
        success: true,
        data: {
          versions,
          type: "rc",
          total: 2,
        },
      });
    });

    it("应该成功返回 beta 类型版本列表", async () => {
      const versions = ["1.0.0-beta.1", "1.0.0-beta.2"];
      mockContext.req.query.mockReturnValue("beta");
      mockNPMManager.getAvailableVersions.mockResolvedValue(versions);

      const response = await handler.getAvailableVersions(mockContext);
      const responseData = await response.json();

      expect(responseData).toEqual({
        success: true,
        data: {
          versions,
          type: "beta",
          total: 2,
        },
      });
    });

    it("应该成功返回 all 类型版本列表", async () => {
      const versions = ["1.0.0", "1.0.0-rc.1", "1.0.0-beta.1"];
      mockContext.req.query.mockReturnValue("all");
      mockNPMManager.getAvailableVersions.mockResolvedValue(versions);

      const response = await handler.getAvailableVersions(mockContext);
      const responseData = await response.json();

      expect(responseData).toEqual({
        success: true,
        data: {
          versions,
          type: "all",
          total: 3,
        },
      });
    });

    it("应该默认返回 stable 类型版本列表", async () => {
      const versions = ["1.0.0", "1.0.1"];
      mockContext.req.query.mockReturnValue(undefined);
      mockNPMManager.getAvailableVersions.mockResolvedValue(versions);

      const response = await handler.getAvailableVersions(mockContext);
      const responseData = await response.json();

      expect(responseData.data.type).toBe("stable");
    });

    it("应该拒绝无效的版本类型", async () => {
      mockContext.req.query.mockReturnValue("invalid");

      const response = await handler.getAvailableVersions(mockContext);
      const responseData = await response.json();

      expect(mockNPMManager.getAvailableVersions).not.toHaveBeenCalled();
      expect(responseData).toEqual({
        success: false,
        error: {
          code: "INVALID_VERSION_TYPE",
          message:
            "无效的版本类型: invalid。支持的类型: stable, rc, beta, all",
        },
      });
      expect(response.status).toBe(400);
    });

    it("应该处理获取版本列表时的错误", async () => {
      mockContext.req.query.mockReturnValue("stable");
      const error = new Error("无法获取版本列表");
      mockNPMManager.getAvailableVersions.mockRejectedValue(error);

      const response = await handler.getAvailableVersions(mockContext);
      const responseData = await response.json();

      expect(mockLogger.error).toHaveBeenCalledWith("获取可用版本列表失败:", error);
      expect(responseData).toEqual({
        success: false,
        error: {
          code: "VERSIONS_FETCH_ERROR",
          message: "无法获取版本列表",
        },
      });
      expect(response.status).toBe(500);
    });

    it("应该处理空版本列表", async () => {
      mockContext.req.query.mockReturnValue("stable");
      mockNPMManager.getAvailableVersions.mockResolvedValue([]);

      const response = await handler.getAvailableVersions(mockContext);
      const responseData = await response.json();

      expect(responseData.data.total).toBe(0);
      expect(responseData.data.versions).toEqual([]);
    });
  });

  describe("checkLatestVersion 检查最新版本", () => {
    it("应该成功返回有更新的版本检查结果", async () => {
      const error = new Error("无法获取版本列表");
      mockNPMManager.getAvailableVersions.mockRejectedValue(error);

      const response = await handler.getAvailableVersions(mockContext);
      const responseData = await response.json();

      expect(mockLogger.error).toHaveBeenCalledWith("获取可用版本列表失败:", error);
      expect(responseData).toEqual({
        success: false,
        error: {
          code: "VERSIONS_FETCH_ERROR",
          message: "无法获取版本列表",
        },
      });
      expect(response.status).toBe(500);
    });

    it("应该处理空版本列表", async () => {
      mockContext.req.query = vi.fn((key: string) => {
        if (key === "type") return "stable";
        return undefined;
      });
      mockNPMManager.getAvailableVersions.mockResolvedValue([]);

      const response = await handler.getAvailableVersions(mockContext);
      const responseData = await response.json();

      expect(responseData.data.total).toBe(0);
      expect(responseData.data.versions).toEqual([]);
    });
  });

  describe("checkLatestVersion 检查最新版本", () => {
    it("应该成功返回有更新的版本检查结果", async () => {
      const result = {
        currentVersion: "1.0.0",
        latestVersion: "1.0.1",
        hasUpdate: true,
      };
      mockNPMManager.checkForLatestVersion.mockResolvedValue(result);

      const response = await handler.checkLatestVersion(mockContext);
      const responseData = await response.json();

      expect(mockNPMManager.checkForLatestVersion).toHaveBeenCalledTimes(1);
      expect(responseData).toEqual({
        success: true,
        data: result,
      });
      expect(response.status).toBe(200);
    });

    it("应该成功返回没有更新的版本检查结果", async () => {
      const result = {
        currentVersion: "1.0.1",
        latestVersion: "1.0.1",
        hasUpdate: false,
      };
      mockNPMManager.checkForLatestVersion.mockResolvedValue(result);

      const response = await handler.checkLatestVersion(mockContext);
      const responseData = await response.json();

      expect(responseData).toEqual({
        success: true,
        data: result,
      });
    });

    it("应该处理有错误但仍返回部分信息的情况", async () => {
      const result = {
        currentVersion: "1.0.0",
        latestVersion: null,
        hasUpdate: false,
        error: "无法获取可用版本列表",
      };
      mockNPMManager.checkForLatestVersion.mockResolvedValue(result);

      const response = await handler.checkLatestVersion(mockContext);
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
    });

    it("应该处理版本检查时的错误", async () => {
      const error = new Error("版本检查失败");
      mockNPMManager.checkForLatestVersion.mockRejectedValue(error);

      const response = await handler.checkLatestVersion(mockContext);
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
      mockNPMManager.checkForLatestVersion.mockRejectedValue("网络错误");

      const response = await handler.checkLatestVersion(mockContext);
      const responseData = await response.json();

      expect(responseData).toEqual({
        success: false,
        error: {
          code: "LATEST_VERSION_CHECK_ERROR",
          message: "网络错误",
        },
      });
    });
  });

  describe("响应格式验证", () => {
    it("成功响应应该包含正确的结构", async () => {
      const versionInfo = { version: "1.0.0" };
      mockVersionUtils.getVersionInfo.mockReturnValue(versionInfo);

      const response = await handler.getVersion(mockContext);
      const responseData = await response.json();

      expect(responseData).toHaveProperty("success", true);
      expect(responseData).toHaveProperty("data", versionInfo);
      expect(responseData).not.toHaveProperty("error");
    });

    it("错误响应应该包含正确的结构", async () => {
      const error = new Error("测试错误");
      mockVersionUtils.getVersionInfo.mockImplementation(() => {
        throw error;
      });

      const response = await handler.getVersion(mockContext);
      const responseData = await response.json();

      expect(responseData).toHaveProperty("success", false);
      expect(responseData).toHaveProperty("error");
      expect(responseData.error).toHaveProperty("code");
      expect(responseData.error).toHaveProperty("message");
    });

    it("成功响应可以包含消息", async () => {
      const response = await handler.clearVersionCache(mockContext);
      const responseData = await response.json();

      expect(responseData).toHaveProperty("success", true);
      expect(responseData).toHaveProperty("message", "版本缓存已清除");
      // data 为 undefined 时不会添加 data 字段
      expect(responseData).not.toHaveProperty("data");
    });
  });

  describe("边界条件测试", () => {
    it("应该处理空的版本信息", async () => {
      mockVersionUtils.getVersionInfo.mockReturnValue({});

      const response = await handler.getVersion(mockContext);
      const responseData = await response.json();

      expect(responseData.success).toBe(true);
      expect(responseData.data).toEqual({});
    });

    it("应该处理大量版本列表", async () => {
      const largeVersionList = Array.from(
        { length: 100 },
        (_, i) => `1.${i}.0`
      );
      mockContext.req.query = vi.fn((key: string) => {
        if (key === "type") return "all";
        return undefined;
      });
      mockNPMManager.getAvailableVersions.mockResolvedValue(largeVersionList);

      const response = await handler.getAvailableVersions(mockContext);
      const responseData = await response.json();

      expect(responseData.success).toBe(true);
      expect(responseData.data.total).toBe(100);
      expect(responseData.data.versions).toHaveLength(100);
    });

    it("应该处理版本类型参数的各种边界情况", async () => {
      const edgeCases = [
        { type: "", valid: true }, // 空字符串是 falsy，默认为 stable
        { type: null, valid: true }, // null 是 falsy，默认为 stable
        { type: undefined, valid: true }, // undefined 是 falsy，默认为 stable
        { type: false, valid: true }, // false 是 falsy，默认为 stable
        { type: 0, valid: true }, // 0 是 falsy，默认为 stable
        { type: "STABLE", valid: false }, // 大小写敏感
        { type: " Stable", valid: false },
        { type: "invalid", valid: false },
      ];

      for (const testCase of edgeCases) {
        mockContext.req.query = vi.fn((key: string) => {
          if (key === "type") return testCase.type;
          return undefined;
        });

        const response = await handler.getAvailableVersions(mockContext);
        const responseData = await response.json();

        if (testCase.valid) {
          expect(responseData.success).toBe(true);
        } else {
          expect(responseData.success).toBe(false);
          expect(responseData.error.code).toBe("INVALID_VERSION_TYPE");
        }
      }
    });
  });

  describe("日志记录验证", () => {
    it("应该记录所有重要操作的日志", async () => {
      mockVersionUtils.getVersionInfo.mockReturnValue({ version: "1.0.0" });

      await handler.getVersion(mockContext);

      expect(mockLogger.debug).toHaveBeenCalledWith("处理获取版本信息请求");
      expect(mockLogger.debug).toHaveBeenCalledWith(
        "获取版本信息成功:",
        { version: "1.0.0" }
      );
    });

    it("应该记录错误日志", async () => {
      const error = new Error("测试错误");
      mockVersionUtils.getVersionInfo.mockImplementation(() => {
        throw error;
      });

      await handler.getVersion(mockContext);

      expect(mockLogger.error).toHaveBeenCalledWith("获取版本信息失败:", error);
    });

    it("应该记录信息级别的日志", async () => {
      await handler.clearVersionCache(mockContext);

      expect(mockLogger.info).toHaveBeenCalledWith("版本缓存已清除");
    });

    it("应该在获取可用版本时记录调试日志", async () => {
      mockContext.req.query = vi.fn((key: string) => {
        if (key === "type") return "stable";
        return undefined;
      });
      const versions = ["1.0.0", "1.0.1"];
      mockNPMManager.getAvailableVersions.mockResolvedValue(versions);

      await handler.getAvailableVersions(mockContext);

      expect(mockLogger.debug).toHaveBeenCalledWith("处理获取可用版本列表请求");
      expect(mockLogger.debug).toHaveBeenCalledWith(
        `获取到 ${versions.length} 个可用版本 (类型: stable)`
      );
    });
  });

  describe("HTTP 状态码验证", () => {
    it("成功操作应该返回 200 状态码", async () => {
      mockVersionUtils.getVersionInfo.mockReturnValue({ version: "1.0.0" });

      const response = await handler.getVersion(mockContext);

      expect(response.status).toBe(200);
    });

    it("客户端错误（无效类型）应该返回 400 状态码", async () => {
      mockContext.req.query = vi.fn((key: string) => {
        if (key === "type") return "invalid";
        return undefined;
      });

      const response = await handler.getAvailableVersions(mockContext);

      expect(response.status).toBe(400);
    });

    it("服务器错误应该返回 500 状态码", async () => {
      const error = new Error("服务器内部错误");
      mockVersionUtils.getVersionInfo.mockImplementation(() => {
        throw error;
      });

      const response = await handler.getVersion(mockContext);

      expect(response.status).toBe(500);
    });
  });

  describe("并发和性能测试", () => {
    it("应该能够处理并发的版本查询请求", async () => {
      const versionInfo = { version: "1.0.0" };
      mockVersionUtils.getVersionInfo.mockReturnValue(versionInfo);

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
      expect(mockVersionUtils.getVersionInfo).toHaveBeenCalledTimes(10);
    });

    it("应该能够处理并发的可用版本查询", async () => {
      const versions = ["1.0.0", "1.0.1"];
      mockContext.req.query = vi.fn((key: string) => {
        if (key === "type") return "stable";
        return undefined;
      });
      mockNPMManager.getAvailableVersions.mockResolvedValue(versions);

      const promises = Array.from({ length: 5 }, () =>
        handler.getAvailableVersions(mockContext)
      );

      const responses = await Promise.all(promises);

      expect(responses).toHaveLength(5);
      for (const response of responses) {
        const data = await response.json();
        expect(data.success).toBe(true);
      }
      expect(mockNPMManager.getAvailableVersions).toHaveBeenCalledTimes(5);
    });
  });

  describe("错误处理和恢复", () => {
    it("应该在 VersionUtils 抛出异常后继续工作", async () => {
      // 第一次调用失败
      mockVersionUtils.getVersionInfo
        .mockImplementationOnce(() => {
          throw new Error("临时错误");
        })
        .mockReturnValueOnce({ version: "1.0.0" });

      // 第一次请求失败
      const response1 = await handler.getVersion(mockContext);
      const data1 = await response1.json();
      expect(data1.error).toBeDefined();

      // 第二次请求成功
      const response2 = await handler.getVersion(mockContext);
      const data2 = await response2.json();
      expect(data2.success).toBe(true);
      expect(data2.data).toEqual({ version: "1.0.0" });
    });

    it("应该处理 NPMManager 抛出的异常", async () => {
      mockContext.req.query = vi.fn((key: string) => {
        if (key === "type") return "stable";
        return undefined;
      });
      const error = new Error("NPM 服务不可用");
      mockNPMManager.getAvailableVersions.mockRejectedValue(error);

      const response = await handler.getAvailableVersions(mockContext);
      const responseData = await response.json();

      expect(responseData.error).toBeDefined();
      expect(responseData.error.code).toBe("VERSIONS_FETCH_ERROR");
      expect(response.status).toBe(500);
    });
  });

  describe("数据类型和格式验证", () => {
    it("应该处理包含各种字段的版本信息", async () => {
      const complexVersionInfo = {
        version: "1.0.0",
        name: "xiaozhi-client",
        description: "小智客户端",
        author: "xiaozhi",
      };
      mockVersionUtils.getVersionInfo.mockReturnValue(complexVersionInfo);

      const response = await handler.getVersion(mockContext);
      const responseData = await response.json();

      expect(responseData.success).toBe(true);
      expect(responseData.data).toEqual(complexVersionInfo);
    });

    it("应该正确验证版本类型参数", async () => {
      const validTypes = ["stable", "rc", "beta", "all"];

      for (const type of validTypes) {
        mockContext.req.query = vi.fn((key: string) => {
          if (key === "type") return type;
          return undefined;
        });
        mockNPMManager.getAvailableVersions.mockResolvedValue([type]);

        const response = await handler.getAvailableVersions(mockContext);
        const responseData = await response.json();

        expect(responseData.success).toBe(true);
        expect(responseData.data.type).toBe(type);
      }
    });
  });

  describe("集成测试", () => {
    it("应该正确处理完整的版本管理工作流", async () => {
      // 1. 获取版本信息
      const versionInfo = { version: "1.0.0", name: "xiaozhi-client" };
      mockVersionUtils.getVersionInfo.mockReturnValue(versionInfo);

      let response = await handler.getVersion(mockContext);
      let data = await response.json();
      expect(data.success).toBe(true);
      expect(data.data).toEqual(versionInfo);

      // 2. 获取简化版本号
      mockVersionUtils.getVersion.mockReturnValue("1.0.0");

      response = await handler.getVersionSimple(mockContext);
      data = await response.json();
      expect(data.success).toBe(true);
      expect(data.data.version).toBe("1.0.0");

      // 3. 清除缓存
      response = await handler.clearVersionCache(mockContext);
      data = await response.json();
      expect(data.success).toBe(true);

      // 4. 获取可用版本
      mockContext.req.query = vi.fn((key: string) => {
        if (key === "type") return "stable";
        return undefined;
      });
      const versions = ["1.0.0", "1.0.1"];
      mockNPMManager.getAvailableVersions.mockResolvedValue(versions);

      response = await handler.getAvailableVersions(mockContext);
      data = await response.json();
      expect(data.success).toBe(true);
      expect(data.data.versions).toEqual(versions);

      // 5. 检查最新版本
      const checkResult = {
        currentVersion: "1.0.0",
        latestVersion: "1.0.1",
        hasUpdate: true,
      };
      mockNPMManager.checkForLatestVersion.mockResolvedValue(checkResult);

      response = await handler.checkLatestVersion(mockContext);
      data = await response.json();
      expect(data.success).toBe(true);
      expect(data.data).toEqual(checkResult);

      // 验证所有调用
      expect(mockVersionUtils.getVersionInfo).toHaveBeenCalled();
      expect(mockVersionUtils.getVersion).toHaveBeenCalled();
      expect(mockVersionUtils.clearCache).toHaveBeenCalled();
      expect(mockNPMManager.getAvailableVersions).toHaveBeenCalledWith("stable");
      expect(mockNPMManager.checkForLatestVersion).toHaveBeenCalled();
    });

    it("应该正确处理混合成功和失败的操作", async () => {
      // 成功的操作
      mockVersionUtils.getVersionInfo.mockReturnValue({ version: "1.0.0" });
      let response = await handler.getVersion(mockContext);
      let data = await response.json();
      expect(data.success).toBe(true);

      // 失败的操作 - 无效的版本类型
      mockContext.req.query = vi.fn((key: string) => {
        if (key === "type") return "invalid";
        return undefined;
      });
      response = await handler.getAvailableVersions(mockContext);
      data = await response.json();
      expect(data.error).toBeDefined();

      // 再次成功的操作
      mockVersionUtils.getVersion.mockReturnValue("1.0.0");
      response = await handler.getVersionSimple(mockContext);
      data = await response.json();
      expect(data.success).toBe(true);
    });
  });
});

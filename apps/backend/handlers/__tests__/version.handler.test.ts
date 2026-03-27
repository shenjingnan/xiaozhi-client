/**
 * 版本 API 处理器测试
 * 测试版本信息查询、可用版本列表获取、版本检查等功能的正确性
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { VersionApiHandler } from "../version.handler.js";

// 模拟 Logger
vi.mock("../../Logger.js", () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

// 模拟 VersionUtils
vi.mock("@xiaozhi-client/version", () => {
  const mockVersionInfo = {
    version: "2.2.0",
    name: "xiaozhi-client",
    description: "小智 AI 客户端",
    author: "xiaozhi",
  };

  return {
    VersionUtils: {
      getVersion: vi.fn(() => mockVersionInfo.version),
      getVersionInfo: vi.fn(() => mockVersionInfo),
      clearCache: vi.fn(),
      compareVersions: vi.fn(),
      isValidVersion: vi.fn(),
    },
    VERSION: "2.2.0",
    APP_NAME: "xiaozhi-client",
  };
});

// 模拟 NPMManager
const mockNPMManager = {
  getAvailableVersions: vi.fn(),
  checkForLatestVersion: vi.fn(),
  getCurrentVersion: vi.fn(),
  installVersion: vi.fn(),
};

vi.mock("@/lib/npm", () => ({
  NPMManager: vi.fn(() => mockNPMManager),
}));

describe("VersionApiHandler 版本 API 处理器", () => {
  let handler: VersionApiHandler;
  let mockContext: any;
  let mockLogger: any;
  let mockVersionUtils: any;
  const mockVersionInfo = {
    version: "2.2.0",
    name: "xiaozhi-client",
    description: "小智 AI 客户端",
    author: "xiaozhi",
  };

  beforeEach(async () => {
    vi.clearAllMocks();

    // 设置 mock logger
    const { logger } = await import("../../Logger.js");
    mockLogger = {
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    };
    Object.assign(logger, mockLogger);

    // 获取 VersionUtils mock
    const { VersionUtils } = await import("@xiaozhi-client/version");
    mockVersionUtils = VersionUtils;

    // 重置 VersionUtils mock
    mockVersionUtils.getVersion.mockReturnValue(mockVersionInfo.version);
    mockVersionUtils.getVersionInfo.mockReturnValue(mockVersionInfo);
    mockVersionUtils.clearCache.mockReturnValue(undefined);

    // 重置 NPMManager mock
    mockNPMManager.getAvailableVersions.mockResolvedValue([
      "2.2.0",
      "2.1.0",
      "2.0.0",
    ]);
    mockNPMManager.checkForLatestVersion.mockResolvedValue({
      currentVersion: "2.2.0",
      latestVersion: "2.2.0",
      hasUpdate: false,
    });

    // 创建模拟 Context
    mockContext = {
      get: vi.fn((key: string) => {
        if (key === "logger") return mockLogger;
        return undefined;
      }),
      json: vi.fn((data, status) => {
        return new Response(JSON.stringify(data), {
          status: status || 200,
          headers: { "Content-Type": "application/json" },
        });
      }),
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
        (code: string, message: string, details?: unknown, status = 400) => {
          const response = {
            success: false,
            error: { code, message },
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
            status,
            headers: { "Content-Type": "application/json" },
          });
        }
      ),
      req: {
        query: vi.fn((key: string) => {
          if (key === "type") return "stable";
          return undefined;
        }),
        param: vi.fn(),
        json: vi.fn(),
      },
    };

    handler = new VersionApiHandler();
  });

  describe("getVersion 获取完整版本信息", () => {
    it("应该成功返回完整版本信息", async () => {
      const response = await handler.getVersion(mockContext);
      const responseData = await response.json();

      expect(mockVersionUtils.getVersionInfo).toHaveBeenCalled();
      expect(responseData).toEqual({
        success: true,
        data: mockVersionInfo,
      });
      expect(response.status).toBe(200);
    });

    it("应该记录调试日志", async () => {
      await handler.getVersion(mockContext);

      expect(mockLogger.debug).toHaveBeenCalledWith("处理获取版本信息请求");
      expect(mockLogger.debug).toHaveBeenCalledWith(
        "获取版本信息成功:",
        mockVersionInfo
      );
    });

    it("应该处理获取版本信息时的错误", async () => {
      const error = new Error("版本信息获取失败");
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
          message: "版本信息获取失败",
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
    });
  });

  describe("getVersionSimple 获取简化版本号", () => {
    it("应该成功返回简化版本号", async () => {
      const response = await handler.getVersionSimple(mockContext);
      const responseData = await response.json();

      expect(mockVersionUtils.getVersion).toHaveBeenCalled();
      expect(responseData).toEqual({
        success: true,
        data: { version: mockVersionInfo.version },
      });
      expect(response.status).toBe(200);
    });

    it("应该记录调试日志", async () => {
      await handler.getVersionSimple(mockContext);

      expect(mockLogger.debug).toHaveBeenCalledWith("处理获取版本号请求");
      expect(mockLogger.debug).toHaveBeenCalledWith(
        `获取版本号成功: ${mockVersionInfo.version}`
      );
    });

    it("应该处理获取版本号时的错误", async () => {
      const error = new Error("版本号获取失败");
      mockVersionUtils.getVersion.mockImplementation(() => {
        throw error;
      });

      const response = await handler.getVersionSimple(mockContext);
      const responseData = await response.json();

      expect(responseData).toEqual({
        success: false,
        error: {
          code: "VERSION_READ_ERROR",
          message: "版本号获取失败",
        },
      });
    });
  });

  describe("clearVersionCache 清除版本缓存", () => {
    it("应该成功清除版本缓存", async () => {
      const response = await handler.clearVersionCache(mockContext);
      const responseData = await response.json();

      expect(mockVersionUtils.clearCache).toHaveBeenCalled();
      expect(mockLogger.info).toHaveBeenCalledWith("版本缓存已清除");
      expect(responseData).toEqual({
        success: true,
        message: "版本缓存已清除",
      });
      expect(response.status).toBe(200);
    });

    it("应该记录调试日志", async () => {
      await handler.clearVersionCache(mockContext);

      expect(mockLogger.debug).toHaveBeenCalledWith("处理清除版本缓存请求");
    });

    it("应该处理清除缓存时的错误", async () => {
      const error = new Error("清除缓存失败");
      mockVersionUtils.clearCache.mockImplementation(() => {
        throw error;
      });

      const response = await handler.clearVersionCache(mockContext);
      const responseData = await response.json();

      expect(responseData).toEqual({
        success: false,
        error: {
          code: "CACHE_CLEAR_ERROR",
          message: "清除缓存失败",
        },
      });
    });
  });

  describe("getAvailableVersions 获取可用版本列表", () => {
    const mockVersions = ["2.2.0", "2.1.0", "2.0.0", "1.9.0"];

    it("应该成功返回 stable 版本列表", async () => {
      mockContext.req.query = vi.fn((key: string) => {
        if (key === "type") return "stable";
        return undefined;
      });
      mockNPMManager.getAvailableVersions.mockResolvedValue(mockVersions);

      const response = await handler.getAvailableVersions(mockContext);
      const responseData = await response.json();

      expect(mockNPMManager.getAvailableVersions).toHaveBeenCalledWith(
        "stable"
      );
      expect(responseData).toEqual({
        success: true,
        data: {
          versions: mockVersions,
          type: "stable",
          total: mockVersions.length,
        },
      });
      expect(response.status).toBe(200);
    });

    it("应该成功返回 rc 版本列表", async () => {
      mockContext.req.query = vi.fn((key: string) => {
        if (key === "type") return "rc";
        return undefined;
      });
      const rcVersions = ["2.3.0-rc.1", "2.3.0-rc.0"];
      mockNPMManager.getAvailableVersions.mockResolvedValue(rcVersions);

      const response = await handler.getAvailableVersions(mockContext);
      const responseData = await response.json();

      expect(responseData.data.type).toBe("rc");
      expect(responseData.data.versions).toEqual(rcVersions);
    });

    it("应该成功返回 beta 版本列表", async () => {
      mockContext.req.query = vi.fn((key: string) => {
        if (key === "type") return "beta";
        return undefined;
      });
      const betaVersions = ["2.3.0-beta.2", "2.3.0-beta.1"];
      mockNPMManager.getAvailableVersions.mockResolvedValue(betaVersions);

      const response = await handler.getAvailableVersions(mockContext);
      const responseData = await response.json();

      expect(responseData.data.type).toBe("beta");
      expect(responseData.data.versions).toEqual(betaVersions);
    });

    it("应该成功返回 all 版本列表", async () => {
      mockContext.req.query = vi.fn((key: string) => {
        if (key === "type") return "all";
        return undefined;
      });
      const allVersions = ["2.2.0", "2.2.0-rc.1", "2.2.0-beta.1", "2.1.0"];
      mockNPMManager.getAvailableVersions.mockResolvedValue(allVersions);

      const response = await handler.getAvailableVersions(mockContext);
      const responseData = await response.json();

      expect(responseData.data.type).toBe("all");
      expect(responseData.data.versions).toEqual(allVersions);
    });

    it("应该默认使用 stable 类型", async () => {
      mockContext.req.query = vi.fn(() => undefined);
      mockNPMManager.getAvailableVersions.mockResolvedValue(mockVersions);

      const response = await handler.getAvailableVersions(mockContext);
      const responseData = await response.json();

      expect(responseData.data.type).toBe("stable");
    });

    it("应该返回 400 错误当版本类型无效时", async () => {
      mockContext.req.query = vi.fn((key: string) => {
        if (key === "type") return "invalid";
        return undefined;
      });

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

    it("应该处理获取版本列表时的错误", async () => {
      const error = new Error("网络错误");
      mockNPMManager.getAvailableVersions.mockRejectedValue(error);

      const response = await handler.getAvailableVersions(mockContext);
      const responseData = await response.json();

      expect(responseData).toEqual({
        success: false,
        error: {
          code: "VERSIONS_FETCH_ERROR",
          message: "网络错误",
        },
      });
      expect(response.status).toBe(500);
    });

    it("应该处理空版本列表", async () => {
      mockNPMManager.getAvailableVersions.mockResolvedValue([]);

      const response = await handler.getAvailableVersions(mockContext);
      const responseData = await response.json();

      expect(responseData.data.versions).toEqual([]);
      expect(responseData.data.total).toBe(0);
    });

    it("应该记录调试日志", async () => {
      mockNPMManager.getAvailableVersions.mockResolvedValue(mockVersions);

      await handler.getAvailableVersions(mockContext);

      expect(mockLogger.debug).toHaveBeenCalledWith("处理获取可用版本列表请求");
      expect(mockLogger.debug).toHaveBeenCalledWith(
        `获取到 ${mockVersions.length} 个可用版本 (类型: stable)`
      );
    });
  });

  describe("checkLatestVersion 检查最新版本", () => {
    it("应该成功返回版本检查结果（无更新）", async () => {
      const checkResult = {
        currentVersion: "2.2.0",
        latestVersion: "2.2.0",
        hasUpdate: false,
      };
      mockNPMManager.checkForLatestVersion.mockResolvedValue(checkResult);

      const response = await handler.checkLatestVersion(mockContext);
      const responseData = await response.json();

      expect(mockNPMManager.checkForLatestVersion).toHaveBeenCalled();
      expect(responseData).toEqual({
        success: true,
        data: checkResult,
      });
      expect(response.status).toBe(200);
    });

    it("应该成功返回版本检查结果（有更新）", async () => {
      const checkResult = {
        currentVersion: "2.1.0",
        latestVersion: "2.2.0",
        hasUpdate: true,
      };
      mockNPMManager.checkForLatestVersion.mockResolvedValue(checkResult);

      const response = await handler.checkLatestVersion(mockContext);
      const responseData = await response.json();

      expect(responseData.data.hasUpdate).toBe(true);
      expect(responseData.data.currentVersion).toBe("2.1.0");
      expect(responseData.data.latestVersion).toBe("2.2.0");
    });

    it("应该处理有错误但返回部分信息的情况", async () => {
      const checkResult = {
        currentVersion: "2.2.0",
        latestVersion: null,
        hasUpdate: false,
        error: "无法获取可用版本列表",
      };
      mockNPMManager.checkForLatestVersion.mockResolvedValue(checkResult);

      const response = await handler.checkLatestVersion(mockContext);
      const responseData = await response.json();

      expect(responseData).toEqual({
        success: true,
        data: checkResult,
      });
    });

    it("应该处理版本检查时的错误", async () => {
      const error = new Error("检查更新失败");
      mockNPMManager.checkForLatestVersion.mockRejectedValue(error);

      const response = await handler.checkLatestVersion(mockContext);
      const responseData = await response.json();

      expect(responseData).toEqual({
        success: false,
        error: {
          code: "LATEST_VERSION_CHECK_ERROR",
          message: "检查更新失败",
        },
      });
      expect(response.status).toBe(500);
    });

    it("应该记录调试日志", async () => {
      const checkResult = {
        currentVersion: "2.2.0",
        latestVersion: "2.2.0",
        hasUpdate: false,
      };
      mockNPMManager.checkForLatestVersion.mockResolvedValue(checkResult);

      await handler.checkLatestVersion(mockContext);

      expect(mockLogger.debug).toHaveBeenCalledWith("处理检查最新版本请求");
      expect(mockLogger.debug).toHaveBeenCalledWith(
        "版本检查结果:",
        checkResult
      );
    });
  });

  describe("边界条件测试", () => {
    it("应该处理 null 版本信息", async () => {
      mockVersionUtils.getVersionInfo.mockReturnValue(null);

      const response = await handler.getVersion(mockContext);
      const responseData = await response.json();

      expect(responseData.success).toBe(true);
      expect(responseData.data).toBeNull();
    });

    it("应该处理 undefined 版本信息", async () => {
      mockVersionUtils.getVersionInfo.mockReturnValue(undefined);

      const response = await handler.getVersion(mockContext);
      const responseData = await response.json();

      expect(responseData.success).toBe(true);
      expect(responseData.data).toBeUndefined();
    });

    it("应该处理空的版本列表", async () => {
      mockNPMManager.getAvailableVersions.mockResolvedValue([]);

      const response = await handler.getAvailableVersions(mockContext);
      const responseData = await response.json();

      expect(responseData.data.versions).toEqual([]);
      expect(responseData.data.total).toBe(0);
    });

    it("应该处理大量版本列表", async () => {
      const largeVersions = Array.from({ length: 100 }, (_, i) => {
        const major = 2;
        const minor = 100 - i;
        return `${major}.${minor}.0`;
      });
      mockNPMManager.getAvailableVersions.mockResolvedValue(largeVersions);

      const response = await handler.getAvailableVersions(mockContext);
      const responseData = await response.json();

      expect(responseData.data.versions).toHaveLength(100);
      expect(responseData.data.total).toBe(100);
    });
  });

  describe("集成测试", () => {
    it("应该正确处理完整的版本检查流程", async () => {
      // 1. 获取版本信息
      let response = await handler.getVersion(mockContext);
      let data = await response.json();
      expect(data.success).toBe(true);
      expect(data.data.version).toBe("2.2.0");

      // 2. 获取简化版本号
      response = await handler.getVersionSimple(mockContext);
      data = await response.json();
      expect(data.success).toBe(true);
      expect(data.data.version).toBe("2.2.0");

      // 3. 获取可用版本列表
      response = await handler.getAvailableVersions(mockContext);
      data = await response.json();
      expect(data.success).toBe(true);
      expect(data.data.versions).toBeDefined();

      // 4. 检查最新版本
      response = await handler.checkLatestVersion(mockContext);
      data = await response.json();
      expect(data.success).toBe(true);
      expect(data.data.hasUpdate).toBeDefined();

      // 5. 清除版本缓存
      response = await handler.clearVersionCache(mockContext);
      data = await response.json();
      expect(data.success).toBe(true);
    });

    it("应该正确处理所有版本类型的请求", async () => {
      const versionTypes = ["stable", "rc", "beta", "all"] as const;

      for (const type of versionTypes) {
        mockContext.req.query = vi.fn((key: string) => {
          if (key === "type") return type;
          return undefined;
        });
        mockNPMManager.getAvailableVersions.mockResolvedValue([
          `test-${type}-1.0.0`,
        ]);

        const response = await handler.getAvailableVersions(mockContext);
        const responseData = await response.json();

        expect(responseData.success).toBe(true);
        expect(responseData.data.type).toBe(type);
      }
    });
  });

  describe("并发和性能测试", () => {
    it("应该能够处理并发的版本查询请求", async () => {
      const promises = Array.from({ length: 10 }, () =>
        handler.getVersion(mockContext)
      );

      const responses = await Promise.all(promises);

      expect(responses).toHaveLength(10);
      for (const response of responses) {
        const data = await response.json();
        expect(data.success).toBe(true);
      }
      expect(mockVersionUtils.getVersionInfo).toHaveBeenCalledTimes(10);
    });

    it("应该能够处理并发的版本检查请求", async () => {
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
  });

  describe("HTTP 状态码验证", () => {
    it("成功操作应该返回 200 状态码", async () => {
      const response = await handler.getVersion(mockContext);
      expect(response.status).toBe(200);
    });

    it("客户端错误应该返回 400 状态码", async () => {
      mockContext.req.query = vi.fn((key: string) => {
        if (key === "type") return "invalid";
        return undefined;
      });

      const response = await handler.getAvailableVersions(mockContext);
      expect(response.status).toBe(400);
    });

    it("服务器错误应该返回 500 状态码", async () => {
      mockVersionUtils.getVersion.mockImplementation(() => {
        throw new Error("服务器内部错误");
      });

      const response = await handler.getVersionSimple(mockContext);
      expect(response.status).toBe(500);
    });
  });

  describe("数据类型和格式验证", () => {
    it("版本信息应该包含正确的字段", async () => {
      const response = await handler.getVersion(mockContext);
      const responseData = await response.json();

      expect(responseData.data).toHaveProperty("version");
      expect(typeof responseData.data.version).toBe("string");
    });

    it("可用版本响应应该包含正确的结构", async () => {
      const response = await handler.getAvailableVersions(mockContext);
      const responseData = await response.json();

      expect(responseData.data).toHaveProperty("versions");
      expect(responseData.data).toHaveProperty("type");
      expect(responseData.data).toHaveProperty("total");
      expect(Array.isArray(responseData.data.versions)).toBe(true);
      expect(typeof responseData.data.type).toBe("string");
      expect(typeof responseData.data.total).toBe("number");
    });

    it("版本检查响应应该包含正确的字段", async () => {
      const response = await handler.checkLatestVersion(mockContext);
      const responseData = await response.json();

      expect(responseData.data).toHaveProperty("currentVersion");
      expect(responseData.data).toHaveProperty("latestVersion");
      expect(responseData.data).toHaveProperty("hasUpdate");
      expect(typeof responseData.data.currentVersion).toBe("string");
      expect(typeof responseData.data.hasUpdate).toBe("boolean");
    });
  });
});

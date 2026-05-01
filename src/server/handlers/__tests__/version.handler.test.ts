import { beforeEach, describe, expect, it, vi } from "vitest";
import type { VersionInfo } from "../../../utils/version.js";
import { VersionUtils } from "../../../utils/version.js";
import { NPMManager } from "../../lib/npm/manager.js";
import { VersionApiHandler } from "../version.handler.js";

// 模拟依赖
vi.mock("../../../utils/version.js", () => ({
  VersionUtils: {
    getVersionInfo: vi.fn(),
    getVersion: vi.fn(),
    clearCache: vi.fn(),
  },
}));

vi.mock("../../lib/npm/manager.js", () => ({
  NPMManager: vi.fn(),
}));

describe("VersionApiHandler 版本 API 处理器", () => {
  let versionApiHandler: VersionApiHandler;
  let mockContext: any;
  let mockLogger: any;
  let mockNPMManager: any;

  beforeEach(async () => {
    // 重置所有模拟
    vi.clearAllMocks();

    // 设置模拟 logger
    mockLogger = {
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    };

    // 设置模拟 Context
    mockContext = {
      get: vi.fn((key: string) => {
        if (key === "logger") return mockLogger;
        return undefined;
      }),
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
        (code: string, message: string, details?: unknown, status = 400) => {
          const response = {
            success: false,
            error: {
              code,
              message,
              ...(details !== undefined && { details }),
            },
          };
          return new Response(JSON.stringify(response), {
            status,
            headers: { "Content-Type": "application/json" },
          });
        }
      ),
      req: {
        query: vi.fn(),
        json: vi.fn(),
      },
    } as any;

    // 设置模拟 NPMManager
    mockNPMManager = {
      getAvailableVersions: vi.fn(),
      checkForLatestVersion: vi.fn(),
    };

    // 配置 NPMManager 构造函数返回模拟实例
    vi.mocked(NPMManager).mockImplementation(() => mockNPMManager);

    // 创建处理器实例
    versionApiHandler = new VersionApiHandler();
  });

  describe("构造函数", () => {
    it("应该正确初始化处理器", () => {
      expect(versionApiHandler).toBeInstanceOf(VersionApiHandler);
    });
  });

  describe("getVersion 获取版本信息", () => {
    it("应该成功返回完整版本信息", async () => {
      const mockVersionInfo: VersionInfo = {
        version: "1.10.7",
        name: "xiaozhi-client",
        description: "MCP 客户端",
        author: "测试作者",
      };
      vi.mocked(VersionUtils.getVersionInfo).mockReturnValue(mockVersionInfo);

      const response = await versionApiHandler.getVersion(mockContext);
      const responseData = await response.json();

      expect(VersionUtils.getVersionInfo).toHaveBeenCalled();
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

    it("应该处理获取版本信息时的错误", async () => {
      const error = new Error("版本信息读取失败");
      vi.mocked(VersionUtils.getVersionInfo).mockImplementation(() => {
        throw error;
      });

      const response = await versionApiHandler.getVersion(mockContext);
      const responseData = await response.json();

      expect(mockLogger.error).toHaveBeenCalledWith("获取版本信息失败:", error);
      expect(responseData).toEqual({
        success: false,
        error: {
          code: "VERSION_READ_ERROR",
          message: "版本信息读取失败",
        },
      });
      expect(response.status).toBe(500);
    });

    it("应该处理非 Error 类型的异常", async () => {
      vi.mocked(VersionUtils.getVersionInfo).mockImplementation(() => {
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

    it("应该处理只有 version 字段的最小版本信息", async () => {
      const mockVersionInfo: VersionInfo = {
        version: "1.0.0",
      };
      vi.mocked(VersionUtils.getVersionInfo).mockReturnValue(mockVersionInfo);

      const response = await versionApiHandler.getVersion(mockContext);
      const responseData = await response.json();

      expect(responseData).toEqual({
        success: true,
        data: mockVersionInfo,
      });
    });
  });

  describe("getVersionSimple 获取版本号", () => {
    it("应该成功返回版本号", async () => {
      vi.mocked(VersionUtils.getVersion).mockReturnValue("1.10.7");

      const response = await versionApiHandler.getVersionSimple(mockContext);
      const responseData = await response.json();

      expect(VersionUtils.getVersion).toHaveBeenCalled();
      expect(mockLogger.debug).toHaveBeenCalledWith("处理获取版本号请求");
      expect(mockLogger.debug).toHaveBeenCalledWith("获取版本号成功: 1.10.7");
      expect(responseData).toEqual({
        success: true,
        data: { version: "1.10.7" },
      });
      expect(response.status).toBe(200);
    });

    it("应该处理获取版本号时的错误", async () => {
      const error = new Error("版本号获取失败");
      vi.mocked(VersionUtils.getVersion).mockImplementation(() => {
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

    it("应该处理 unknown 版本号", async () => {
      vi.mocked(VersionUtils.getVersion).mockReturnValue("unknown");

      const response = await versionApiHandler.getVersionSimple(mockContext);
      const responseData = await response.json();

      expect(responseData).toEqual({
        success: true,
        data: { version: "unknown" },
      });
    });
  });

  describe("clearVersionCache 清除版本缓存", () => {
    it("应该成功清除版本缓存", async () => {
      vi.mocked(VersionUtils.clearCache).mockImplementation(() => {});

      const response = await versionApiHandler.clearVersionCache(mockContext);
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
      const error = new Error("缓存清除失败");
      vi.mocked(VersionUtils.clearCache).mockImplementation(() => {
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
  });

  describe("getAvailableVersions 获取可用版本列表", () => {
    it("应该成功返回稳定版本列表", async () => {
      const mockVersions = ["1.10.7", "1.10.6", "1.10.5"];
      mockNPMManager.getAvailableVersions.mockResolvedValue(mockVersions);
      mockContext.req.query.mockReturnValue("stable");

      const response =
        await versionApiHandler.getAvailableVersions(mockContext);
      const responseData = await response.json();

      expect(NPMManager).toHaveBeenCalled();
      expect(mockNPMManager.getAvailableVersions).toHaveBeenCalledWith(
        "stable"
      );
      expect(mockLogger.debug).toHaveBeenCalledWith("处理获取可用版本列表请求");
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

    it("应该成功返回 RC 版本列表", async () => {
      const mockVersions = ["1.10.8-rc.0", "1.10.8-rc.1"];
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
    });

    it("应该成功返回 Beta 版本列表", async () => {
      const mockVersions = ["1.10.8-beta.0"];
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
          total: 1,
        },
      });
    });

    it("应该成功返回所有版本列表", async () => {
      const mockVersions = ["1.10.7", "1.10.8-rc.0", "1.10.8-beta.0", "1.10.6"];
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
    });

    it("应该处理默认类型参数（稳定版本）", async () => {
      const mockVersions = ["1.10.7"];
      mockNPMManager.getAvailableVersions.mockResolvedValue(mockVersions);
      mockContext.req.query.mockReturnValue(undefined);

      const response =
        await versionApiHandler.getAvailableVersions(mockContext);
      const responseData = await response.json();

      expect(mockNPMManager.getAvailableVersions).toHaveBeenCalledWith(
        "stable"
      );
      expect(responseData).toEqual({
        success: true,
        data: {
          versions: mockVersions,
          type: "stable",
          total: 1,
        },
      });
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
    });

    it("应该处理获取版本列表时的错误", async () => {
      const error = new Error("NPM 查询失败");
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
          message: "NPM 查询失败",
        },
      });
      expect(response.status).toBe(500);
    });
  });

  describe("checkLatestVersion 检查最新版本", () => {
    it("应该成功检查最新版本并返回有更新", async () => {
      mockNPMManager.checkForLatestVersion.mockResolvedValue({
        currentVersion: "1.10.6",
        latestVersion: "1.10.7",
        hasUpdate: true,
      });

      const response = await versionApiHandler.checkLatestVersion(mockContext);
      const responseData = await response.json();

      expect(NPMManager).toHaveBeenCalled();
      expect(mockNPMManager.checkForLatestVersion).toHaveBeenCalled();
      expect(mockLogger.debug).toHaveBeenCalledWith("处理检查最新版本请求");
      expect(mockLogger.debug).toHaveBeenCalledWith("版本检查结果:", {
        currentVersion: "1.10.6",
        latestVersion: "1.10.7",
        hasUpdate: true,
      });
      expect(responseData).toEqual({
        success: true,
        data: {
          currentVersion: "1.10.6",
          latestVersion: "1.10.7",
          hasUpdate: true,
        },
      });
      expect(response.status).toBe(200);
    });

    it("应该成功检查最新版本并返回无更新", async () => {
      mockNPMManager.checkForLatestVersion.mockResolvedValue({
        currentVersion: "1.10.7",
        latestVersion: "1.10.7",
        hasUpdate: false,
      });

      const response = await versionApiHandler.checkLatestVersion(mockContext);
      const responseData = await response.json();

      expect(responseData).toEqual({
        success: true,
        data: {
          currentVersion: "1.10.7",
          latestVersion: "1.10.7",
          hasUpdate: false,
        },
      });
    });

    it("应该处理检查结果包含错误信息的情况", async () => {
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
    });

    it("应该处理获取版本列表失败的情况", async () => {
      mockNPMManager.checkForLatestVersion.mockResolvedValue({
        currentVersion: "1.10.7",
        latestVersion: null,
        hasUpdate: false,
        error: "无法获取可用版本列表",
      });

      const response = await versionApiHandler.checkLatestVersion(mockContext);
      const responseData = await response.json();

      expect(responseData).toEqual({
        success: true,
        data: {
          currentVersion: "1.10.7",
          latestVersion: null,
          hasUpdate: false,
          error: "无法获取可用版本列表",
        },
      });
    });

    it("应该处理检查最新版本时的异常错误", async () => {
      const error = new Error("版本检查服务不可用");
      mockNPMManager.checkForLatestVersion.mockRejectedValue(error);

      const response = await versionApiHandler.checkLatestVersion(mockContext);
      const responseData = await response.json();

      expect(mockLogger.error).toHaveBeenCalledWith("检查最新版本失败:", error);
      expect(responseData).toEqual({
        success: false,
        error: {
          code: "LATEST_VERSION_CHECK_ERROR",
          message: "版本检查服务不可用",
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
  });

  describe("响应格式验证", () => {
    it("成功响应应该包含正确的结构", async () => {
      vi.mocked(VersionUtils.getVersionInfo).mockReturnValue({
        version: "1.0.0",
      });

      const response = await versionApiHandler.getVersion(mockContext);
      const responseData = await response.json();

      expect(responseData).toHaveProperty("success", true);
      expect(responseData).toHaveProperty("data");
      expect(responseData).not.toHaveProperty("error");
    });

    it("错误响应应该包含正确的结构", async () => {
      vi.mocked(VersionUtils.getVersionInfo).mockImplementation(() => {
        throw new Error("测试错误");
      });

      const response = await versionApiHandler.getVersion(mockContext);
      const responseData = await response.json();

      expect(responseData).toHaveProperty("success", false);
      expect(responseData).toHaveProperty("error");
      expect(responseData.error).toHaveProperty("code");
      expect(responseData.error).toHaveProperty("message");
    });
  });

  describe("边界条件测试", () => {
    it("应该处理空版本信息", async () => {
      vi.mocked(VersionUtils.getVersionInfo).mockReturnValue({ version: "" });

      const response = await versionApiHandler.getVersion(mockContext);
      const responseData = await response.json();

      expect(responseData.success).toBe(true);
      expect(responseData.data.version).toBe("");
    });

    it("应该处理大量版本列表", async () => {
      const largeVersionList = Array.from(
        { length: 1000 },
        (_, i) => `1.${i}.0`
      );
      mockNPMManager.getAvailableVersions.mockResolvedValue(largeVersionList);
      mockContext.req.query.mockReturnValue("all");

      const response =
        await versionApiHandler.getAvailableVersions(mockContext);
      const responseData = await response.json();

      expect(responseData.success).toBe(true);
      expect(responseData.data.total).toBe(1000);
      expect(responseData.data.versions).toHaveLength(1000);
    });
  });

  describe("日志记录验证", () => {
    it("应该记录所有重要操作的日志", async () => {
      vi.mocked(VersionUtils.getVersionInfo).mockReturnValue({
        version: "1.0.0",
      });

      await versionApiHandler.getVersion(mockContext);

      expect(mockLogger.debug).toHaveBeenCalledWith("处理获取版本信息请求");
      expect(mockLogger.debug).toHaveBeenCalledWith("获取版本信息成功:", {
        version: "1.0.0",
      });
    });

    it("应该记录错误日志", async () => {
      const error = new Error("测试错误");
      vi.mocked(VersionUtils.getVersionInfo).mockImplementation(() => {
        throw error;
      });

      await versionApiHandler.getVersion(mockContext);

      expect(mockLogger.error).toHaveBeenCalledWith("获取版本信息失败:", error);
    });
  });

  describe("HTTP 状态码验证", () => {
    it("成功操作应该返回 200 状态码", async () => {
      vi.mocked(VersionUtils.getVersion).mockReturnValue("1.0.0");

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
      vi.mocked(VersionUtils.getVersion).mockImplementation(() => {
        throw new Error("服务器内部错误");
      });

      const response = await versionApiHandler.getVersionSimple(mockContext);

      expect(response.status).toBe(500);
    });
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";
import { VersionApiHandler } from "../version.handler.js";

vi.mock("../../Logger.js", () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock("@xiaozhi-client/version", () => ({
  VersionUtils: {
    getVersionInfo: vi.fn(),
    getVersion: vi.fn(),
    clearCache: vi.fn(),
  },
}));

vi.mock("@/lib/npm", () => {
  const instance = {
    getAvailableVersions: vi.fn(),
    checkForLatestVersion: vi.fn(),
  };

  return {
    NPMManager: vi.fn(() => instance),
  };
});

describe("VersionApiHandler", () => {
  let handler: VersionApiHandler;
  let mockContext: any;
  let mockLogger: any;
  let mockVersionUtils: any;
  let mockNPMManagerInstance: any;

  beforeEach(async () => {
    vi.clearAllMocks();
    handler = new VersionApiHandler();

    const { logger } = await import("../../Logger.js");
    mockLogger = logger;

    const { VersionUtils } = await import("@xiaozhi-client/version");
    mockVersionUtils = VersionUtils;

    const { NPMManager } = await import("@/lib/npm");
    mockNPMManagerInstance = new (vi.mocked(NPMManager))();

    mockContext = {
      get: vi.fn((key: string) => {
        if (key === "logger") return mockLogger;
        return undefined;
      }),
      success: vi.fn((data?: unknown, message?: string, status = 200) => {
        const response: Record<string, unknown> = { success: true };
        if (data !== undefined) response.data = data;
        if (message !== undefined) response.message = message;
        return new Response(JSON.stringify(response), {
          status,
          headers: { "Content-Type": "application/json" },
        });
      }),
      fail: vi.fn(
        (code: string, message: string, details?: unknown, status = 400) => {
          const response: Record<string, unknown> = {
            success: false,
            error: {
              code,
              message,
              ...(details !== undefined ? { details } : {}),
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
      },
    };
  });

  describe("getVersion", () => {
    it("returns the full version payload", async () => {
      const versionInfo = {
        version: "1.2.3",
        gitHash: "abc123",
        buildTime: "2026-03-16T18:00:00Z",
      };
      mockVersionUtils.getVersionInfo.mockReturnValue(versionInfo);

      const response = await handler.getVersion(mockContext);

      expect(mockVersionUtils.getVersionInfo).toHaveBeenCalledTimes(1);
      expect(mockLogger.debug).toHaveBeenCalledWith("处理获取版本信息请求");
      expect(mockLogger.debug).toHaveBeenCalledWith(
        "获取版本信息成功:",
        versionInfo
      );
      await expect(response.json()).resolves.toEqual({
        success: true,
        data: versionInfo,
      });
    });

    it("maps thrown errors to VERSION_READ_ERROR", async () => {
      const error = new Error("version read failed");
      mockVersionUtils.getVersionInfo.mockImplementation(() => {
        throw error;
      });

      const response = await handler.getVersion(mockContext);

      expect(mockLogger.error).toHaveBeenCalledWith("获取版本信息失败:", error);
      await expect(response.json()).resolves.toEqual({
        success: false,
        error: {
          code: "VERSION_READ_ERROR",
          message: "version read failed",
        },
      });
      expect(response.status).toBe(500);
    });
  });

  describe("getVersionSimple", () => {
    it("returns the simplified version payload", async () => {
      mockVersionUtils.getVersion.mockReturnValue("2.0.0");

      const response = await handler.getVersionSimple(mockContext);

      expect(mockVersionUtils.getVersion).toHaveBeenCalledTimes(1);
      expect(mockLogger.debug).toHaveBeenCalledWith("处理获取版本号请求");
      expect(mockLogger.debug).toHaveBeenCalledWith("获取版本号成功: 2.0.0");
      await expect(response.json()).resolves.toEqual({
        success: true,
        data: {
          version: "2.0.0",
        },
      });
    });
  });

  describe("clearVersionCache", () => {
    it("clears the cache and returns a success message", async () => {
      const response = await handler.clearVersionCache(mockContext);

      expect(mockVersionUtils.clearCache).toHaveBeenCalledTimes(1);
      expect(mockLogger.info).toHaveBeenCalledWith("版本缓存已清除");
      await expect(response.json()).resolves.toEqual({
        success: true,
        message: "版本缓存已清除",
      });
    });
  });

  describe("getAvailableVersions", () => {
    it("defaults to stable versions when no type is provided", async () => {
      mockContext.req.query.mockReturnValue(undefined);
      mockNPMManagerInstance.getAvailableVersions.mockResolvedValue([
        "2.0.0",
        "1.9.0",
      ]);

      const response = await handler.getAvailableVersions(mockContext);

      expect(mockNPMManagerInstance.getAvailableVersions).toHaveBeenCalledWith(
        "stable"
      );
      await expect(response.json()).resolves.toEqual({
        success: true,
        data: {
          versions: ["2.0.0", "1.9.0"],
          type: "stable",
          total: 2,
        },
      });
    });

    it("rejects invalid version types with a 400 response", async () => {
      mockContext.req.query.mockReturnValue("nightly");

      const response = await handler.getAvailableVersions(mockContext);

      expect(
        mockNPMManagerInstance.getAvailableVersions
      ).not.toHaveBeenCalled();
      expect(mockContext.fail).toHaveBeenCalledWith(
        "INVALID_VERSION_TYPE",
        "无效的版本类型: nightly。支持的类型: stable, rc, beta, all",
        undefined,
        400
      );
      await expect(response.json()).resolves.toEqual({
        success: false,
        error: {
          code: "INVALID_VERSION_TYPE",
          message: "无效的版本类型: nightly。支持的类型: stable, rc, beta, all",
        },
      });
      expect(response.status).toBe(400);
    });
  });

  describe("checkLatestVersion", () => {
    it("returns the version check result", async () => {
      mockNPMManagerInstance.checkForLatestVersion.mockResolvedValue({
        currentVersion: "1.0.0",
        latestVersion: "1.1.0",
        hasUpdate: true,
      });

      const response = await handler.checkLatestVersion(mockContext);

      expect(
        mockNPMManagerInstance.checkForLatestVersion
      ).toHaveBeenCalledTimes(1);
      await expect(response.json()).resolves.toEqual({
        success: true,
        data: {
          currentVersion: "1.0.0",
          latestVersion: "1.1.0",
          hasUpdate: true,
        },
      });
    });

    it("preserves partial results when the version check reports an error", async () => {
      mockNPMManagerInstance.checkForLatestVersion.mockResolvedValue({
        currentVersion: "1.0.0",
        latestVersion: null,
        hasUpdate: false,
        error: "network unavailable",
      });

      const response = await handler.checkLatestVersion(mockContext);

      await expect(response.json()).resolves.toEqual({
        success: true,
        data: {
          currentVersion: "1.0.0",
          latestVersion: null,
          hasUpdate: false,
          error: "network unavailable",
        },
      });
    });
  });
});

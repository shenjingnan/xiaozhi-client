import type { Context } from "hono";
import type { Logger } from "../Logger.js";
import { logger } from "../Logger.js";
import type { VersionInfo } from "../cli/utils/VersionUtils.js";
import { VersionUtils } from "../cli/utils/VersionUtils.js";
import { NPMManager } from "../services/NPMManager.js";

/**
 * 统一响应格式接口
 */
interface ApiErrorResponse {
  error: {
    code: string;
    message: string;
    details?: any;
  };
}

interface ApiSuccessResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
}

/**
 * 版本 API 处理器
 */
export class VersionApiHandler {
  private logger: Logger;

  constructor() {
    this.logger = logger.withTag("VersionApiHandler");
  }

  /**
   * 创建统一的错误响应
   */
  private createErrorResponse(
    code: string,
    message: string,
    details?: any
  ): ApiErrorResponse {
    return {
      error: {
        code,
        message,
        details,
      },
    };
  }

  /**
   * 创建统一的成功响应
   */
  private createSuccessResponse<T>(
    data?: T,
    message?: string
  ): ApiSuccessResponse<T> {
    return {
      success: true,
      data,
      message,
    };
  }

  /**
   * 获取版本信息
   * GET /api/version
   */
  async getVersion(c: Context): Promise<Response> {
    try {
      this.logger.debug("处理获取版本信息请求");

      // 使用 VersionUtils 获取完整版本信息
      const versionInfo = VersionUtils.getVersionInfo();

      this.logger.debug("获取版本信息成功:", versionInfo);

      return c.json(this.createSuccessResponse(versionInfo));
    } catch (error) {
      this.logger.error("获取版本信息失败:", error);

      const errorResponse = this.createErrorResponse(
        "VERSION_READ_ERROR",
        error instanceof Error ? error.message : "获取版本信息失败"
      );

      return c.json(errorResponse, 500);
    }
  }

  /**
   * 获取版本号（简化接口）
   * GET /api/version/simple
   */
  async getVersionSimple(c: Context): Promise<Response> {
    try {
      this.logger.debug("处理获取版本号请求");

      const version = VersionUtils.getVersion();
      this.logger.debug(`获取版本号成功: ${version}`);

      return c.json(this.createSuccessResponse({ version }));
    } catch (error) {
      this.logger.error("获取版本号失败:", error);

      const errorResponse = this.createErrorResponse(
        "VERSION_READ_ERROR",
        error instanceof Error ? error.message : "获取版本号失败"
      );

      return c.json(errorResponse, 500);
    }
  }

  /**
   * 清除版本缓存
   * POST /api/version/cache/clear
   */
  async clearVersionCache(c: Context): Promise<Response> {
    try {
      this.logger.debug("处理清除版本缓存请求");

      VersionUtils.clearCache();
      this.logger.info("版本缓存已清除");

      return c.json(this.createSuccessResponse(null, "版本缓存已清除"));
    } catch (error) {
      this.logger.error("清除版本缓存失败:", error);

      const errorResponse = this.createErrorResponse(
        "CACHE_CLEAR_ERROR",
        error instanceof Error ? error.message : "清除版本缓存失败"
      );

      return c.json(errorResponse, 500);
    }
  }

  /**
   * 获取可用版本列表
   * GET /api/version/available?type=stable|rc|beta|all
   */
  async getAvailableVersions(c: Context): Promise<Response> {
    try {
      this.logger.debug("处理获取可用版本列表请求");

      // 获取查询参数
      const type = (c.req.query("type") as any) || "stable";

      // 验证版本类型参数
      const validTypes = ["stable", "rc", "beta", "all"];
      if (!validTypes.includes(type)) {
        const errorResponse = this.createErrorResponse(
          "INVALID_VERSION_TYPE",
          `无效的版本类型: ${type}。支持的类型: ${validTypes.join(", ")}`
        );
        return c.json(errorResponse, 400);
      }

      const npmManager = new NPMManager();
      const versions = await npmManager.getAvailableVersions(type);

      this.logger.debug(`获取到 ${versions.length} 个可用版本 (类型: ${type})`);

      return c.json(
        this.createSuccessResponse({
          versions,
          type,
          total: versions.length,
        })
      );
    } catch (error) {
      this.logger.error("获取可用版本列表失败:", error);

      const errorResponse = this.createErrorResponse(
        "VERSIONS_FETCH_ERROR",
        error instanceof Error ? error.message : "获取可用版本列表失败"
      );

      return c.json(errorResponse, 500);
    }
  }

  /**
   * 检查最新版本
   * GET /api/version/latest
   */
  async checkLatestVersion(c: Context): Promise<Response> {
    try {
      this.logger.debug("处理检查最新版本请求");

      const npmManager = new NPMManager();
      const result = await npmManager.checkForLatestVersion();

      this.logger.debug("版本检查结果:", result);

      if (result.error) {
        // 如果有错误，但仍返回部分信息
        return c.json(
          this.createSuccessResponse({
            currentVersion: result.currentVersion,
            latestVersion: result.latestVersion,
            hasUpdate: result.hasUpdate,
            error: result.error,
          })
        );
      }

      return c.json(
        this.createSuccessResponse({
          currentVersion: result.currentVersion,
          latestVersion: result.latestVersion,
          hasUpdate: result.hasUpdate,
        })
      );
    } catch (error) {
      this.logger.error("检查最新版本失败:", error);

      const errorResponse = this.createErrorResponse(
        "LATEST_VERSION_CHECK_ERROR",
        error instanceof Error ? error.message : "检查最新版本失败"
      );

      return c.json(errorResponse, 500);
    }
  }
}

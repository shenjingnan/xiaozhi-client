import { NPMManager } from "@/lib/npm/index.js";
import type { AppContext } from "@/types/hono.context.js";
import { VersionUtils } from "@xiaozhi-client/version";
import type { Context } from "hono";
import { BaseHandler } from "./base.handler.js";

/**
 * 版本 API 处理器
 */
export class VersionApiHandler extends BaseHandler {
  /**
   * 获取版本信息
   * GET /api/version
   */
  async getVersion(c: Context<AppContext>): Promise<Response> {
    try {
      c.get("logger").debug("处理获取版本信息请求");

      // 使用 VersionUtils 获取完整版本信息
      const versionInfo = VersionUtils.getVersionInfo();

      c.get("logger").debug("获取版本信息成功:", versionInfo);

      return c.success(versionInfo);
    } catch (error) {
      return this.handleError(c, error, "获取版本信息", "VERSION_READ_ERROR");
    }
  }

  /**
   * 获取版本号（简化接口）
   * GET /api/version/simple
   */
  async getVersionSimple(c: Context<AppContext>): Promise<Response> {
    try {
      c.get("logger").debug("处理获取版本号请求");

      const version = VersionUtils.getVersion();
      c.get("logger").debug(`获取版本号成功: ${version}`);

      return c.success({ version });
    } catch (error) {
      return this.handleError(c, error, "获取版本号", "VERSION_READ_ERROR");
    }
  }

  /**
   * 清除版本缓存
   * POST /api/version/cache/clear
   */
  async clearVersionCache(c: Context<AppContext>): Promise<Response> {
    try {
      c.get("logger").debug("处理清除版本缓存请求");

      VersionUtils.clearCache();
      c.get("logger").info("版本缓存已清除");

      return c.success(undefined, "版本缓存已清除");
    } catch (error) {
      return this.handleError(c, error, "清除版本缓存", "CACHE_CLEAR_ERROR");
    }
  }

  /**
   * 获取可用版本列表
   * GET /api/version/available?type=stable|rc|beta|all
   */
  async getAvailableVersions(c: Context<AppContext>): Promise<Response> {
    try {
      c.get("logger").debug("处理获取可用版本列表请求");

      // 获取查询参数
      const type = (c.req.query("type") as unknown) || "stable";

      // 验证版本类型参数
      const validTypes = ["stable", "rc", "beta", "all"];
      if (!validTypes.includes(type as string)) {
        return c.fail(
          "INVALID_VERSION_TYPE",
          `无效的版本类型: ${type}。支持的类型: ${validTypes.join(", ")}`,
          undefined,
          400
        );
      }

      const npmManager = new NPMManager();
      const versions = await npmManager.getAvailableVersions(type as string);

      c.get("logger").debug(
        `获取到 ${versions.length} 个可用版本 (类型: ${type})`
      );

      return c.success({
        versions,
        type,
        total: versions.length,
      });
    } catch (error) {
      return this.handleError(
        c,
        error,
        "获取可用版本列表",
        "VERSIONS_FETCH_ERROR"
      );
    }
  }

  /**
   * 检查最新版本
   * GET /api/version/latest
   */
  async checkLatestVersion(c: Context<AppContext>): Promise<Response> {
    try {
      c.get("logger").debug("处理检查最新版本请求");

      const npmManager = new NPMManager();
      const result = await npmManager.checkForLatestVersion();

      c.get("logger").debug("版本检查结果:", result);

      if (result.error) {
        // 如果有错误，但仍返回部分信息
        return c.success({
          currentVersion: result.currentVersion,
          latestVersion: result.latestVersion,
          hasUpdate: result.hasUpdate,
          error: result.error,
        });
      }

      return c.success({
        currentVersion: result.currentVersion,
        latestVersion: result.latestVersion,
        hasUpdate: result.hasUpdate,
      });
    } catch (error) {
      return this.handleError(
        c,
        error,
        "检查最新版本",
        "LATEST_VERSION_CHECK_ERROR"
      );
    }
  }
}

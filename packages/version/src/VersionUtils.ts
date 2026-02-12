/**
 * 版本管理工具
 *
 * 提供版本号获取、比较、验证等功能
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { VERSION, APP_NAME } from "./version-constants.js";

/**
 * 版本信息接口
 */
export interface VersionInfo {
  version: string;
  name?: string;
  description?: string;
  author?: string;
}

/**
 * 版本工具类
 */
export class VersionUtils {
  private static cachedVersion: string | null = null;
  private static cachedVersionInfo: VersionInfo | null = null;

  /**
   * 获取版本号
   *
   * 优先使用构建时注入的版本号常量
   * 如果是占位符，则运行时从 package.json 读取
   */
  static getVersion(): string {
    // 如果版本号是占位符，则运行时读取
    if (VERSION === "__VERSION__") {
      return VersionUtils.getRuntimeVersion();
    }

    // 使用构建时注入的版本号
    return VERSION;
  }

  /**
   * 获取完整版本信息
   */
  static getVersionInfo(): VersionInfo {
    // 如果有缓存，直接返回
    if (VersionUtils.cachedVersionInfo) {
      return VersionUtils.cachedVersionInfo;
    }

    // 如果版本号是占位符，则运行时读取
    if (VERSION === "__VERSION__") {
      VersionUtils.cachedVersionInfo = VersionUtils.getRuntimeVersionInfo();
      return VersionUtils.cachedVersionInfo;
    }

    // 使用构建时注入的版本号
    VersionUtils.cachedVersionInfo = {
      version: VERSION,
      name: APP_NAME === "__APP_NAME__" ? undefined : APP_NAME,
    };

    return VersionUtils.cachedVersionInfo;
  }

  /**
   * 比较版本号
   *
   * @param version1 第一个版本号
   * @param version2 第二个版本号
   * @returns 返回值：1 表示 version1 > version2，-1 表示 version1 < version2，0 表示相等
   */
  static compareVersions(version1: string, version2: string): number {
    const v1Parts = version1.split(".").map(Number);
    const v2Parts = version2.split(".").map(Number);
    const maxLength = Math.max(v1Parts.length, v2Parts.length);

    for (let i = 0; i < maxLength; i++) {
      const v1Part = v1Parts[i] || 0;
      const v2Part = v2Parts[i] || 0;

      if (v1Part > v2Part) return 1;
      if (v1Part < v2Part) return -1;
    }

    return 0;
  }

  /**
   * 检查版本是否有效
   *
   * @param version 版本号字符串
   * @returns 是否为有效的语义化版本号
   */
  static isValidVersion(version: string): boolean {
    // 支持语义化版本号：1.2.3 或 1.2.3-alpha.1 或 1.2.3-beta.1+build.123
    const versionRegex = /^\d+\.\d+\.\d+(-[a-zA-Z0-9.-]+)?(\+[a-zA-Z0-9.-]+)?$/;
    return versionRegex.test(version);
  }

  /**
   * 查找并读取 package.json 文件
   *
   * @returns package.json 内容，如果找不到则返回 null
   */
  private static findAndReadPackageJson(): Record<string, unknown> | null {
    try {
      const __filename = fileURLToPath(import.meta.url);
      const currentDir = path.dirname(__filename);

      const possiblePaths = [
        // 从 packages/version/dist/version/index.js 到项目根目录的 package.json
        path.join(currentDir, "..", "..", "..", "package.json"),
        // 从 dist/version/index.js 到项目根目录的 package.json
        path.join(currentDir, "..", "..", "package.json"),
        // 全局安装环境
        path.join(currentDir, "..", "..", "..", "..", "package.json"),
      ];

      for (const packagePath of possiblePaths) {
        if (fs.existsSync(packagePath)) {
          const packageJson = JSON.parse(
            fs.readFileSync(packagePath, "utf8"),
          ) as Record<string, unknown>;
          return packageJson;
        }
      }

      return null;
    } catch (error) {
      console.warn("无法读取 package.json:", error);
      return null;
    }
  }

  /**
   * 运行时从 package.json 读取版本号
   */
  private static getRuntimeVersion(): string {
    // 如果有缓存，直接返回
    if (VersionUtils.cachedVersion) {
      return VersionUtils.cachedVersion;
    }

    const packageJson = VersionUtils.findAndReadPackageJson();
    if (packageJson?.version && typeof packageJson.version === "string") {
      VersionUtils.cachedVersion = packageJson.version;
      return packageJson.version;
    }

    // 如果都找不到，返回默认版本
    VersionUtils.cachedVersion = "unknown";
    return "unknown";
  }

  /**
   * 运行时从 package.json 读取完整版本信息
   */
  private static getRuntimeVersionInfo(): VersionInfo {
    const packageJson = VersionUtils.findAndReadPackageJson();

    if (packageJson) {
      return {
        version:
          typeof packageJson.version === "string"
            ? packageJson.version
            : "unknown",
        name: typeof packageJson.name === "string" ? packageJson.name : undefined,
        description:
          typeof packageJson.description === "string"
            ? packageJson.description
            : undefined,
        author:
          typeof packageJson.author === "string"
            ? packageJson.author
            : undefined,
      };
    }

    return { version: "unknown" };
  }

  /**
   * 清除版本缓存
   *
   * 主要用于测试场景
   */
  static clearCache(): void {
    VersionUtils.cachedVersion = null;
    VersionUtils.cachedVersionInfo = null;
  }
}

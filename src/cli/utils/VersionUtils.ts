/**
 * 版本管理工具
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { FileError } from "../errors/index.js";

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

  /**
   * 获取版本号
   */
  static getVersion(): string {
    if (VersionUtils.cachedVersion) {
      return VersionUtils.cachedVersion;
    }

    try {
      // 在 ES 模块环境中获取当前目录
      const __filename = fileURLToPath(import.meta.url);
      const currentDir = path.dirname(__filename);

      // 尝试多个可能的 package.json 路径
      const possiblePaths = [
        // 构建后环境：dist/cli.js -> dist/package.json (优先)
        path.join(currentDir, "package.json"),
        // 构建后环境：dist/cli.js -> package.json
        path.join(currentDir, "..", "package.json"),
        // 开发环境：src/cli/utils/VersionUtils.ts -> package.json
        path.join(currentDir, "..", "..", "..", "package.json"),
        // 全局安装环境
        path.join(currentDir, "..", "..", "..", "..", "package.json"),
      ];

      for (const packagePath of possiblePaths) {
        if (fs.existsSync(packagePath)) {
          const packageJson = JSON.parse(fs.readFileSync(packagePath, "utf8"));
          if (packageJson.version) {
            VersionUtils.cachedVersion = packageJson.version;
            return packageJson.version;
          }
        }
      }

      // 如果都找不到，返回默认版本
      VersionUtils.cachedVersion = "unknown";
      return "unknown";
    } catch (error) {
      console.warn("无法从 package.json 读取版本信息:", error);
      VersionUtils.cachedVersion = "unknown";
      return "unknown";
    }
  }

  /**
   * 获取完整版本信息
   */
  static getVersionInfo(): VersionInfo {
    try {
      const __filename = fileURLToPath(import.meta.url);
      const currentDir = path.dirname(__filename);

      const possiblePaths = [
        // 构建后环境：dist/cli.js -> dist/package.json (优先)
        path.join(currentDir, "package.json"),
        // 构建后环境：dist/cli.js -> package.json
        path.join(currentDir, "..", "package.json"),
        // 开发环境：src/cli/utils/VersionUtils.ts -> package.json
        path.join(currentDir, "..", "..", "..", "package.json"),
        // 全局安装环境
        path.join(currentDir, "..", "..", "..", "..", "package.json"),
      ];

      for (const packagePath of possiblePaths) {
        if (fs.existsSync(packagePath)) {
          const packageJson = JSON.parse(fs.readFileSync(packagePath, "utf8"));
          return {
            version: packageJson.version || "unknown",
            name: packageJson.name,
            description: packageJson.description,
            author: packageJson.author,
          };
        }
      }

      return { version: "unknown" };
    } catch (error) {
      throw new FileError("无法读取版本信息", "package.json");
    }
  }

  /**
   * 比较版本号
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
   */
  static isValidVersion(version: string): boolean {
    const versionRegex = /^\d+\.\d+\.\d+(-[a-zA-Z0-9.-]+)?$/;
    return versionRegex.test(version);
  }

  /**
   * 清除版本缓存
   */
  static clearCache(): void {
    VersionUtils.cachedVersion = null;
  }
}

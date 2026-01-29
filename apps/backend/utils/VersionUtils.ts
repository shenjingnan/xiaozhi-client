/**
 * 版本管理工具
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

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
        // 从 apps/backend/utils/VersionUtils.ts 到项目根目录的 package.json
        path.join(currentDir, "..", "..", "package.json"),
        // 从 dist/backend/utils/VersionUtils.js 到项目根目录的 package.json
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
        // 从 apps/backend/utils/VersionUtils.ts 到项目根目录的 package.json
        path.join(currentDir, "..", "..", "package.json"),
        // 从 dist/backend/utils/VersionUtils.js 到项目根目录的 package.json
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
      console.warn("无法读取版本信息:", error);
      return { version: "unknown" };
    }
  }

  /**
   * 清除版本缓存
   */
  static clearCache(): void {
    VersionUtils.cachedVersion = null;
  }
}

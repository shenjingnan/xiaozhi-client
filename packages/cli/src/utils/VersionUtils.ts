/**
 * 版本管理工具
 */

import { APP_NAME, VERSION } from "../version";

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
  /**
   * 获取版本号（构建时注入）
   */
  static getVersion(): string {
    return VERSION;
  }

  /**
   * 获取完整版本信息（构建时注入）
   */
  static getVersionInfo(): VersionInfo {
    return {
      version: VERSION,
      name: APP_NAME,
    };
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
}

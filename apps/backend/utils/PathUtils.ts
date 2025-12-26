/**
 * 路径处理工具
 */

import { tmpdir } from "node:os";

/**
 * 路径工具类
 */
export class PathUtils {
  /**
   * 获取配置目录路径
   */
  static getConfigDir(): string {
    return process.env.XIAOZHI_CONFIG_DIR || process.cwd();
  }

  /**
   * 获取临时目录路径
   */
  static getTempDir(): string {
    return process.env.TMPDIR || process.env.TEMP || tmpdir();
  }

  /**
   * 获取用户主目录路径
   */
  static getHomeDir(): string {
    return process.env.HOME || process.env.USERPROFILE || "";
  }
}

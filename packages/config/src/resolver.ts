/**
 * 配置解析器
 * 负责按优先级查找配置文件
 */

import path from "node:path";
import { existsSync } from "node:fs";

/**
 * 配置解析器类
 * 实现配置文件查找优先级逻辑
 */
export class ConfigResolver {
  /**
   * 按优先级解析配置文件路径
   *
   * 优先级顺序：
   * 1. 环境变量 XIAOZHI_CONFIG_DIR 指定的目录
   * 2. 当前工作目录
   * 3. 用户家目录/.xiaozhi-client/
   *
   * @returns 找到的配置文件路径，如果都不存在则返回 null
   */
  static resolveConfigPath(): string | null {
    // 优先级 1: 环境变量指定（向后兼容）
    if (process.env.XIAOZHI_CONFIG_DIR) {
      const configPath = this.findConfigInDir(process.env.XIAOZHI_CONFIG_DIR);
      if (configPath) {
        return configPath;
      }
    }

    // 优先级 2: 当前目录
    const currentDirConfig = this.findConfigInDir(process.cwd());
    if (currentDirConfig) {
      return currentDirConfig;
    }

    // 优先级 3: 用户家目录/.xiaozhi-client/
    const homeDir = process.env.HOME || process.env.USERPROFILE;
    if (homeDir) {
      const xiaozhiClientDir = path.join(homeDir, ".xiaozhi-client");
      const homeDirConfig = this.findConfigInDir(xiaozhiClientDir);
      if (homeDirConfig) {
        return homeDirConfig;
      }
    }

    return null;
  }

  /**
   * 在指定目录中查找配置文件
   *
   * 按优先级查找：xiaozhi.config.json5 > xiaozhi.config.jsonc > xiaozhi.config.json
   *
   * @param dir - 要搜索的目录
   * @returns 找到的配置文件路径，如果不存在则返回 null
   */
  static findConfigInDir(dir: string): string | null {
    const configFileNames = [
      "xiaozhi.config.json5",
      "xiaozhi.config.jsonc",
      "xiaozhi.config.json",
    ];

    for (const fileName of configFileNames) {
      const filePath = path.join(dir, fileName);
      if (existsSync(filePath)) {
        return filePath;
      }
    }

    return null;
  }

  /**
   * 获取默认配置目录路径
   *
   * @returns 用户家目录下的 .xiaozhi-client 目录路径，如果无法获取家目录则返回 null
   */
  static getDefaultConfigDir(): string | null {
    const homeDir = process.env.HOME || process.env.USERPROFILE;
    if (!homeDir) {
      return null;
    }
    return path.join(homeDir, ".xiaozhi-client");
  }
}

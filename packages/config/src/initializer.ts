/**
 * 配置初始化器
 * 负责在用户家目录创建默认配置
 */

import path from "node:path";
import { copyFileSync, mkdirSync, existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * 配置初始化器类
 * 负责在用户家目录创建默认配置文件
 */
export class ConfigInitializer {
  /**
   * 初始化默认配置
   *
   * 在用户家目录的 .xiaozhi-client 目录下创建默认配置文件
   *
   * @returns 创建的配置文件路径
   * @throws 如果无法获取用户家目录或默认配置模板不存在
   */
  static async initializeDefaultConfig(): Promise<string> {
    const homeDir = process.env.HOME || process.env.USERPROFILE;
    if (!homeDir) {
      throw new Error("无法获取用户家目录");
    }

    const xiaozhiClientDir = path.join(homeDir, ".xiaozhi-client");

    // 创建目录（如果不存在）
    if (!existsSync(xiaozhiClientDir)) {
      mkdirSync(xiaozhiClientDir, { recursive: true });
    }

    // 获取默认配置模板
    const defaultConfigPath = this.getDefaultConfigTemplate();
    if (!defaultConfigPath) {
      throw new Error("默认配置模板不存在");
    }

    // 目标配置文件路径
    const targetConfigPath = path.join(xiaozhiClientDir, "xiaozhi.config.json");

    // 复制配置文件
    copyFileSync(defaultConfigPath, targetConfigPath);

    return targetConfigPath;
  }

  /**
   * 获取默认配置模板路径
   *
   * 在多个可能的路径中查找默认配置模板文件
   *
   * @returns 找到的默认配置模板路径，如果都不存在则返回 null
   */
  private static getDefaultConfigTemplate(): string | null {
    const possiblePaths = [
      // 开发环境
      resolve(__dirname, "templates", "default", "xiaozhi.config.json"),
      // 构建后的环境
      resolve(__dirname, "..", "templates", "default", "xiaozhi.config.json"),
      // 项目根目录
      resolve(process.cwd(), "templates", "default", "xiaozhi.config.json"),
      // dist 目录
      resolve(__dirname, "..", "..", "..", "templates", "default", "xiaozhi.config.json"),
    ];

    for (const p of possiblePaths) {
      if (existsSync(p)) {
        return p;
      }
    }

    return null;
  }
}

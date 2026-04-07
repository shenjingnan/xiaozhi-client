/**
 * 配置初始化器
 * 负责在用户家目录创建默认配置
 */

import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  statSync,
} from "node:fs";
import path, { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * 配置初始化器类
 * 负责在用户家目录创建完整的默认项目目录
 */
export class ConfigInitializer {
  /**
   * 初始化默认配置
   *
   * 复制整个默认模板目录到用户家目录的 .xiaozhi-client
   * 这包括 mcpServers/ 目录和其他必要文件
   *
   * @returns 创建的项目目录路径
   * @throws 如果无法获取用户家目录或默认配置模板不存在
   */
  static async initializeDefaultConfig(): Promise<string> {
    const homeDir = process.env.HOME || process.env.USERPROFILE;
    if (!homeDir) {
      throw new Error("无法获取用户家目录");
    }

    const xiaozhiClientDir = path.join(homeDir, ".xiaozhi-client");

    // 如果目录已存在，直接使用现有配置目录，避免删除用户数据
    if (existsSync(xiaozhiClientDir)) {
      return xiaozhiClientDir;
    }

    // 创建目录
    mkdirSync(xiaozhiClientDir, { recursive: true });

    // 获取默认模板目录路径
    const defaultTemplateDir = ConfigInitializer.getDefaultTemplateDir();
    if (!defaultTemplateDir) {
      throw new Error("默认配置模板不存在，请检查项目模板文件是否存在");
    }

    // 复制整个模板目录
    ConfigInitializer.copyDirectoryRecursive(
      defaultTemplateDir,
      xiaozhiClientDir,
      ["template.json", ".git", "node_modules"]
    );

    return xiaozhiClientDir;
  }

  /**
   * 递归复制目录
   *
   * @param srcDir 源目录
   * @param destDir 目标目录
   * @param exclude 要排除的文件/目录列表
   */
  private static copyDirectoryRecursive(
    srcDir: string,
    destDir: string,
    exclude: string[] = []
  ): void {
    const items = readdirSync(srcDir);

    for (const item of items) {
      // 跳过排除列表中的项
      if (exclude.includes(item)) {
        continue;
      }

      const srcPath = path.join(srcDir, item);
      const destPath = path.join(destDir, item);
      const stat = statSync(srcPath);

      if (stat.isDirectory()) {
        // 递归复制子目录
        mkdirSync(destPath, { recursive: true });
        ConfigInitializer.copyDirectoryRecursive(srcPath, destPath, exclude);
      } else {
        // 复制文件
        copyFileSync(srcPath, destPath);
      }
    }
  }

  /**
   * 获取默认模板目录路径
   *
   * 在多个可能的路径中查找默认模板目录
   *
   * @returns 找到的默认模板目录路径，如果都不存在则返回 null
   */
  private static getDefaultTemplateDir(): string | null {
    const possiblePaths = [
      // 开发环境：packages/config/src 目录
      resolve(__dirname, "templates", "default"),
      // 开发环境：packages/config 目录
      resolve(__dirname, "..", "templates", "default"),
      // 项目根目录的 templates
      resolve(process.cwd(), "templates", "default"),
      // dist 目录（从 packages/config/dist 配置目录）
      resolve(__dirname, "..", "..", "..", "templates", "default"),
      // 全局安装的 node_modules 目录
      resolve(__dirname, "..", "..", "..", "..", "templates", "default"),
    ];

    for (const p of possiblePaths) {
      if (existsSync(p)) {
        return p;
      }
    }

    return null;
  }
}

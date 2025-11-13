/**
 * 文件操作工具
 */

import fs from "node:fs";
import path from "node:path";
import type { FileOperationOptions } from "@cli/Types.js";
import { FileError } from "../errors/index.js";

/**
 * 文件工具类
 */
export class FileUtils {
  /**
   * 检查文件是否存在
   */
  static exists(filePath: string): boolean {
    try {
      return fs.existsSync(filePath);
    } catch {
      return false;
    }
  }

  /**
   * 确保目录存在
   */
  static ensureDir(dirPath: string): void {
    try {
      if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
      }
    } catch (error) {
      throw new FileError("无法创建目录", dirPath);
    }
  }

  /**
   * 读取文件内容
   */
  static readFile(filePath: string, encoding: BufferEncoding = "utf8"): string {
    try {
      if (!FileUtils.exists(filePath)) {
        throw FileError.notFound(filePath);
      }
      return fs.readFileSync(filePath, encoding);
    } catch (error) {
      if (error instanceof FileError) {
        throw error;
      }
      throw new FileError("无法读取文件", filePath);
    }
  }

  /**
   * 写入文件内容
   */
  static writeFile(
    filePath: string,
    content: string,
    options?: { overwrite?: boolean }
  ): void {
    try {
      if (!options?.overwrite && FileUtils.exists(filePath)) {
        throw FileError.alreadyExists(filePath);
      }

      // 确保目录存在
      const dir = path.dirname(filePath);
      FileUtils.ensureDir(dir);

      fs.writeFileSync(filePath, content, "utf8");
    } catch (error) {
      if (error instanceof FileError) {
        throw error;
      }
      throw new FileError("无法写入文件", filePath);
    }
  }

  /**
   * 复制文件
   */
  static copyFile(
    srcPath: string,
    destPath: string,
    options?: { overwrite?: boolean }
  ): void {
    try {
      if (!FileUtils.exists(srcPath)) {
        throw FileError.notFound(srcPath);
      }

      if (!options?.overwrite && FileUtils.exists(destPath)) {
        throw FileError.alreadyExists(destPath);
      }

      // 确保目标目录存在
      const destDir = path.dirname(destPath);
      FileUtils.ensureDir(destDir);

      fs.copyFileSync(srcPath, destPath);
    } catch (error) {
      if (error instanceof FileError) {
        throw error;
      }
      throw new FileError("无法复制文件", srcPath);
    }
  }

  /**
   * 删除文件
   */
  static deleteFile(filePath: string): void {
    try {
      if (FileUtils.exists(filePath)) {
        fs.unlinkSync(filePath);
      }
    } catch (error) {
      throw new FileError("无法删除文件", filePath);
    }
  }

  /**
   * 复制目录
   */
  static copyDirectory(
    srcDir: string,
    destDir: string,
    options: FileOperationOptions = {}
  ): void {
    try {
      if (!FileUtils.exists(srcDir)) {
        throw FileError.notFound(srcDir);
      }

      // 确保目标目录存在
      FileUtils.ensureDir(destDir);

      const items = fs.readdirSync(srcDir);

      for (const item of items) {
        // 检查是否在排除列表中
        if (options.exclude?.includes(item)) {
          continue;
        }

        const srcPath = path.join(srcDir, item);
        const destPath = path.join(destDir, item);
        const stat = fs.statSync(srcPath);

        if (stat.isDirectory()) {
          if (options.recursive !== false) {
            FileUtils.copyDirectory(srcPath, destPath, options);
          }
        } else {
          FileUtils.copyFile(srcPath, destPath, {
            overwrite: options.overwrite,
          });
        }
      }
    } catch (error) {
      if (error instanceof FileError) {
        throw error;
      }
      throw new FileError("无法复制目录", srcDir);
    }
  }

  /**
   * 删除目录
   */
  static deleteDirectory(
    dirPath: string,
    options: { recursive?: boolean } = {}
  ): void {
    try {
      if (FileUtils.exists(dirPath)) {
        fs.rmSync(dirPath, {
          recursive: options.recursive ?? true,
          force: true,
        });
      }
    } catch (error) {
      throw new FileError("无法删除目录", dirPath);
    }
  }

  /**
   * 获取文件信息
   */
  static getFileInfo(filePath: string): {
    size: number;
    isFile: boolean;
    isDirectory: boolean;
    mtime: Date;
    ctime: Date;
  } {
    try {
      if (!FileUtils.exists(filePath)) {
        throw FileError.notFound(filePath);
      }

      const stats = fs.statSync(filePath);
      return {
        size: stats.size,
        isFile: stats.isFile(),
        isDirectory: stats.isDirectory(),
        mtime: stats.mtime,
        ctime: stats.ctime,
      };
    } catch (error) {
      if (error instanceof FileError) {
        throw error;
      }
      throw new FileError("无法获取文件信息", filePath);
    }
  }

  /**
   * 列出目录内容
   */
  static listDirectory(
    dirPath: string,
    options: {
      recursive?: boolean;
      includeHidden?: boolean;
    } = {}
  ): string[] {
    try {
      if (!FileUtils.exists(dirPath)) {
        throw FileError.notFound(dirPath);
      }

      const items = fs.readdirSync(dirPath);
      let result: string[] = [];

      for (const item of items) {
        // 跳过隐藏文件（除非明确要求包含）
        if (!options.includeHidden && item.startsWith(".")) {
          continue;
        }

        const itemPath = path.join(dirPath, item);
        result.push(itemPath);

        // 递归处理子目录
        if (options.recursive && fs.statSync(itemPath).isDirectory()) {
          const subItems = FileUtils.listDirectory(itemPath, options);
          result = result.concat(subItems);
        }
      }

      return result;
    } catch (error) {
      if (error instanceof FileError) {
        throw error;
      }
      throw new FileError("无法列出目录内容", dirPath);
    }
  }

  /**
   * 创建临时文件
   */
  static createTempFile(prefix = "xiaozhi-", suffix = ".tmp"): string {
    const tempDir = process.env.TMPDIR || process.env.TEMP || "/tmp";
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2);
    const fileName = `${prefix}${timestamp}-${random}${suffix}`;
    return path.join(tempDir, fileName);
  }

  /**
   * 检查文件权限
   */
  static checkPermissions(
    filePath: string,
    mode: number = fs.constants.R_OK | fs.constants.W_OK
  ): boolean {
    try {
      fs.accessSync(filePath, mode);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * 获取文件扩展名
   */
  static getExtension(filePath: string): string {
    return path.extname(filePath).toLowerCase();
  }

  /**
   * 获取文件名（不含扩展名）
   */
  static getBaseName(filePath: string): string {
    return path.basename(filePath, path.extname(filePath));
  }

  /**
   * 规范化路径
   */
  static normalizePath(filePath: string): string {
    return path.normalize(filePath);
  }

  /**
   * 解析相对路径为绝对路径
   */
  static resolvePath(filePath: string, basePath?: string): string {
    if (basePath) {
      return path.resolve(basePath, filePath);
    }
    return path.resolve(filePath);
  }
}

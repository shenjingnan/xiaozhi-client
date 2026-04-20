/**
 * 路径处理工具
 */

import { realpathSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  CONFIG_CONSTANTS,
  PATH_CONSTANTS,
  SERVICE_CONSTANTS,
} from "../Constants";
import { FileUtils } from "./FileUtils";

/**
 * 路径工具类
 */

export class PathUtils {
  /**
   * 获取 PID 文件路径
   */
  static getPidFile(): string {
    // 优先使用环境变量中的配置目录，否则使用当前工作目录
    const configDir =
      process.env[CONFIG_CONSTANTS.DIR_ENV_VAR] || process.cwd();
    return path.join(configDir, `.${SERVICE_CONSTANTS.NAME}.pid`);
  }

  /**
   * 获取日志文件路径
   */
  static getLogFile(projectDir?: string): string {
    const baseDir = projectDir || process.cwd();
    return path.join(baseDir, SERVICE_CONSTANTS.LOG_FILE);
  }

  /**
   * 获取配置目录路径
   */
  static getConfigDir(): string {
    return process.env[CONFIG_CONSTANTS.DIR_ENV_VAR] || process.cwd();
  }

  /**
   * 获取工作目录路径
   */
  static getWorkDir(): string {
    const configDir = PathUtils.getConfigDir();
    return path.join(configDir, PATH_CONSTANTS.WORK_DIR);
  }

  /**
   * 获取模板目录路径
   */
  static getTemplatesDir(): string[] {
    // 在 ES 模块环境中获取当前目录
    const __filename = fileURLToPath(import.meta.url);
    const scriptDir = path.dirname(__filename);

    return [
      // 构建后的环境：dist/cli.js -> dist/templates
      path.join(scriptDir, PATH_CONSTANTS.TEMPLATES_DIR),
      // 构建环境：dist/cli/index.js -> dist/backend/templates
      path.join(scriptDir, "..", "backend", PATH_CONSTANTS.TEMPLATES_DIR),
      // npm 全局安装
      path.join(
        scriptDir,
        "..",
        "..",
        "..",
        "..",
        PATH_CONSTANTS.TEMPLATES_DIR
      ),
    ];
  }

  /**
   * 查找模板目录
   */
  static findTemplatesDir(): string | null {
    const possiblePaths = PathUtils.getTemplatesDir();

    for (const templatesDir of possiblePaths) {
      if (FileUtils.exists(templatesDir)) {
        return templatesDir;
      }
    }

    return null;
  }

  /**
   * 获取模板路径
   */
  static getTemplatePath(templateName: string): string | null {
    const templatesDir = PathUtils.findTemplatesDir();
    if (!templatesDir) {
      return null;
    }

    const templatePath = path.join(templatesDir, templateName);
    return FileUtils.exists(templatePath) ? templatePath : null;
  }

  /**
   * 获取脚本目录路径
   */
  static getScriptDir(): string {
    const __filename = fileURLToPath(import.meta.url);
    return path.dirname(__filename);
  }

  /**
   * 获取项目根目录路径
   */
  static getProjectRoot(): string {
    const scriptDir = PathUtils.getScriptDir();
    // 从 src/cli/utils 回到项目根目录
    return path.join(scriptDir, "..", "..", "..");
  }

  /**
   * 获取构建输出目录路径
   */
  static getDistDir(): string {
    const projectRoot = PathUtils.getProjectRoot();
    return path.join(projectRoot, "dist");
  }

  /**
   * 获取相对于项目根目录的路径
   */
  static getRelativePath(filePath: string): string {
    const projectRoot = PathUtils.getProjectRoot();
    return path.relative(projectRoot, filePath);
  }

  /**
   * 解析配置文件路径
   */
  static resolveConfigPath(format?: "json" | "json5" | "jsonc"): string {
    const configDir = PathUtils.getConfigDir();

    if (format) {
      return path.join(configDir, `xiaozhi.config.${format}`);
    }

    // 按优先级查找配置文件
    for (const fileName of CONFIG_CONSTANTS.FILE_NAMES) {
      const filePath = path.join(configDir, fileName);
      if (FileUtils.exists(filePath)) {
        return filePath;
      }
    }

    // 返回默认配置文件路径
    return path.join(configDir, CONFIG_CONSTANTS.FILE_NAMES[2]); // xiaozhi.config.json
  }

  /**
   * 获取默认配置文件路径
   */
  static getDefaultConfigPath(): string {
    const projectRoot = PathUtils.getProjectRoot();
    return path.join(projectRoot, CONFIG_CONSTANTS.DEFAULT_FILE);
  }

  /**
   * 验证路径安全性（防止路径遍历攻击）
   * 通过路径段判断是否存在严格等于 ".." 的段，避免误杀包含 ".." 子串的合法文件名
   * 同时支持 Unix (/) 和 Windows (\) 分隔符
   */
  static validatePath(inputPath: string): boolean {
    const normalizedPath = path.normalize(inputPath);
    // 按多种分隔符拆分路径段，检查是否包含严格等于 ".." 的段
    const segments = normalizedPath.split(/[/\\]/);
    return !segments.includes("..");
  }

  /**
   * 确保路径在指定目录内
   * 使用 path.relative 判断，避免前缀匹配被绕过（如 /safe/base2 匹配 /safe/base）
   */
  static ensurePathWithin(inputPath: string, baseDir: string): string {
    const resolvedPath = path.resolve(baseDir, inputPath);
    const resolvedBase = path.resolve(baseDir);

    // 使用 path.relative 检查相对路径是否以 ".." 开头或为绝对路径
    const relativePath = path.relative(resolvedBase, resolvedPath);
    if (relativePath.startsWith("..") || path.isAbsolute(relativePath)) {
      throw new Error(`路径 ${inputPath} 超出了允许的范围`);
    }

    return resolvedPath;
  }

  /**
   * 获取可执行文件路径
   * 对于 CLI 自身复用，直接返回当前脚本路径；其他名称从项目根目录的 dist 中查找
   */
  static getExecutablePath(name: string): string {
    // CLI 自身复用：直接返回当前执行的脚本路径
    if (name === "cli") {
      const cliPath = process.argv[1];
      if (cliPath) {
        try {
          return realpathSync(cliPath);
        } catch {
          return cliPath;
        }
      }
      // 回退：无法获取时抛出明确错误
      throw new Error("无法确定 CLI 脚本路径");
    }

    // 其他可执行文件：从项目根目录的 dist 中查找
    const projectRoot = PathUtils.getProjectRoot();
    return path.join(projectRoot, "dist", `${name}.js`);
  }

  /**
   * 获取 Web 服务器启动器路径
   * 返回项目根目录 dist/backend 下的 WebServerLauncher.js
   */
  static getWebServerLauncherPath(): string {
    const projectRoot = PathUtils.getProjectRoot();
    return path.join(projectRoot, "dist", "backend", "WebServerLauncher.js");
  }

  /**
   * 创建安全的文件路径
   * 通过路径段判断是否存在严格等于 ".." 的段，避免误杀合法文件名
   */
  static createSafePath(...segments: string[]): string {
    const joinedPath = path.join(...segments);
    const normalizedPath = path.normalize(joinedPath);

    // 按多种分隔符拆分路径段检查是否包含危险字符
    const hasTraversal = normalizedPath.split(/[/\\]/).includes("..");
    if (hasTraversal || normalizedPath.includes("~")) {
      throw new Error(`不安全的路径: ${normalizedPath}`);
    }

    return normalizedPath;
  }

  /**
   * 获取临时目录路径
   */
  static getTempDir(): string {
    // 使用 Node.js 的 os.tmpdir() 来获取跨平台的临时目录
    return process.env.TMPDIR || process.env.TEMP || tmpdir();
  }

  /**
   * 获取用户主目录路径
   */
  static getHomeDir(): string {
    return process.env.HOME || process.env.USERPROFILE || "";
  }
}

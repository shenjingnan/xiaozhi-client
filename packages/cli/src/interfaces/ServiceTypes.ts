/**
 * 服务类型定义
 *
 * 此文件定义了 DI 容器中所有服务的类型接口
 * 用于替代 getService<any>() 中的 any 类型，提高类型安全性
 */

import type { ConfigManager } from "@xiaozhi-client/config";
import type {
  DaemonManager,
  ProcessManager,
  ServiceManager,
  TemplateManager,
} from "./Service";

/**
 * FileUtils 接口
 */
export interface IFileUtils {
  /** 检查文件是否存在 */
  exists(filePath: string): boolean;
  /** 确保目录存在 */
  ensureDir(dirPath: string): void;
  /** 读取文件内容 */
  readFile(filePath: string, encoding?: BufferEncoding): string;
  /** 写入文件内容 */
  writeFile(
    filePath: string,
    content: string,
    options?: { overwrite?: boolean }
  ): void;
  /** 复制文件 */
  copyFile(
    srcPath: string,
    destPath: string,
    options?: { overwrite?: boolean }
  ): void;
  /** 删除文件 */
  deleteFile(filePath: string): void;
  /** 复制目录 */
  copyDirectory(
    srcDir: string,
    destDir: string,
    options?: {
      recursive?: boolean;
      exclude?: string[];
      overwrite?: boolean;
    }
  ): void;
  /** 删除目录 */
  deleteDirectory(dirPath: string, options?: { recursive?: boolean }): void;
  /** 获取文件信息 */
  getFileInfo(filePath: string): {
    size: number;
    isFile: boolean;
    isDirectory: boolean;
    mtime: Date;
    ctime: Date;
  };
  /** 列出目录内容 */
  listDirectory(
    dirPath: string,
    options?: {
      recursive?: boolean;
      includeHidden?: boolean;
    }
  ): string[];
  /** 创建临时文件 */
  createTempFile(prefix?: string, suffix?: string): string;
  /** 检查文件权限 */
  checkPermissions(filePath: string, mode?: number): boolean;
  /** 获取文件扩展名 */
  getExtension(filePath: string): string;
  /** 获取文件名（不含扩展名） */
  getBaseName(filePath: string): string;
  /** 规范化路径 */
  normalizePath(filePath: string): string;
  /** 解析相对路径为绝对路径 */
  resolvePath(filePath: string, basePath?: string): string;
}

/**
 * FormatUtils 接口
 */
export interface IFormatUtils {
  /** 格式化运行时间 */
  formatUptime(ms: number): string;
  /** 格式化文件大小 */
  formatFileSize(bytes: number): string;
  /** 格式化时间戳 */
  formatTimestamp(timestamp: number, format?: "full" | "date" | "time"): string;
  /** 格式化进程 ID */
  formatPid(pid: number): string;
  /** 格式化端口号 */
  formatPort(port: number): string;
  /** 格式化 URL */
  formatUrl(
    protocol: string,
    host: string,
    port: number,
    path?: string
  ): string;
  /** 格式化配置键值对 */
  formatConfigPair(key: string, value: unknown): string;
  /** 格式化错误消息 */
  formatError(error: Error, includeStack?: boolean): string;
  /** 格式化列表 */
  formatList(items: string[], bullet?: string): string;
  /** 格式化表格数据 */
  formatTable(data: Record<string, unknown>[]): string;
  /** 格式化进度条 */
  formatProgressBar(current: number, total: number, width?: number): string;
  /** 格式化命令行参数 */
  formatCommandArgs(command: string, args: string[]): string;
  /** 截断长文本 */
  truncateText(text: string, maxLength: number, suffix?: string): string;
  /** 格式化 JSON */
  formatJson(obj: unknown, indent?: number): string;
  /** 格式化布尔值 */
  formatBoolean(value: boolean, trueText?: string, falseText?: string): string;
  /** 计算字符串相似度 */
  calculateSimilarity(str1: string, str2: string): number;
}

/**
 * DaemonManager 接口
 */
export interface IDaemonManager {
  /** 启动守护进程 */
  startDaemon(serverFactory: () => Promise<any>): Promise<void>;
  /** 停止守护进程 */
  stopDaemon(): Promise<void>;
  /** 连接到守护进程日志 */
  attachToLogs(logFileName?: string): Promise<void>;
}

/**
 * ErrorHandler 接口
 */
export interface IErrorHandler {
  /** 处理错误 */
  handle(error: Error): void;
}

/**
 * DI 容器服务键到类型的映射
 */
export interface IServiceMap {
  /** 配置管理器 */
  configManager: ConfigManager;
  /** 服务管理器 */
  serviceManager: ServiceManager;
  /** 模板管理器 */
  templateManager: TemplateManager;
  /** 文件工具 */
  fileUtils: IFileUtils;
  /** 格式化工具 */
  formatUtils: IFormatUtils;
  /** 守护进程管理器 */
  daemonManager: IDaemonManager;
  /** 错误处理器 */
  errorHandler: IErrorHandler;
  /** 进程管理器 */
  processManager: ProcessManager;
}

/**
 * 获取服务类型的安全辅助类型
 *
 * @example
 * ```typescript
 * // 使用 ServiceType 获取正确的类型
 * const configManager = this.getService<ServiceType<"configManager">("configManager");
 * // configManager 的类型为 ConfigManager
 * ```
 */
export type ServiceType<K extends keyof IServiceMap> = IServiceMap[K];

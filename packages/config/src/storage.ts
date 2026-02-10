/**
 * 配置存储模块
 * 负责配置文件的读写和序列化
 */

import { copyFileSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import * as commentJson from "comment-json";
import { createJson5Writer, parseJson5 } from "./json5-adapter.js";
import { ConfigResolver } from "./resolver.js";
import type { AppConfig } from "./types.js";
import { configValidator } from "./validator.js";
import { configEvents } from "./events.js";

// 在 ESM 中，需要从 import.meta.url 获取当前文件目录
const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * 配置文件格式类型
 */
export type ConfigFileFormat = "json5" | "jsonc" | "json";

/**
 * 配置存储类
 * 负责配置文件的读写、序列化和反序列化
 */
export class ConfigStorage {
  private defaultConfigPath: string;
  private currentConfigPath: string | null = null; // 跟踪当前使用的配置文件路径
  private json5Writer: {
    write(data: unknown): void;
    toSource(): string;
  } | null = null; // json5-writer 实例，用于保留 JSON5 注释

  constructor() {
    // 使用模板目录中的默认配置文件
    // 在不同环境中尝试不同的路径
    const possiblePaths = [
      // 构建后的环境：dist/configManager.js -> dist/templates/default/xiaozhi.config.json
      resolve(__dirname, "templates", "default", "xiaozhi.config.json"),
      // 开发环境：src/configManager.ts -> templates/default/xiaozhi.config.json
      resolve(__dirname, "..", "templates", "default", "xiaozhi.config.json"),
      // 测试环境或其他情况
      resolve(process.cwd(), "templates", "default", "xiaozhi.config.json"),
    ];

    // 找到第一个存在的路径
    this.defaultConfigPath =
      possiblePaths.find((path) => existsSync(path)) || possiblePaths[0];
  }

  /**
   * 检查配置文件是否存在
   */
  public configExists(): boolean {
    return ConfigResolver.resolveConfigPath() !== null;
  }

  /**
   * 获取配置文件路径（动态计算）
   * 支持多种配置文件格式：json5 > jsonc > json
   */
  public getConfigFilePath(): string {
    // 优先使用 ConfigResolver 解析配置路径
    const resolvedPath = ConfigResolver.resolveConfigPath();

    if (resolvedPath) {
      return resolvedPath;
    }

    // 如果都找不到，返回用户家目录的默认路径
    const defaultDir = ConfigResolver.getDefaultConfigDir();
    if (defaultDir) {
      return resolve(defaultDir, "xiaozhi.config.json");
    }

    // 最后回退到当前目录
    const configDir = process.env.XIAOZHI_CONFIG_DIR || process.cwd();
    return resolve(configDir, "xiaozhi.config.json");
  }

  /**
   * 获取配置文件格式
   * @param filePath 配置文件路径
   */
  public getConfigFileFormat(filePath: string): ConfigFileFormat {
    if (filePath.endsWith(".json5")) {
      return "json5";
    }

    if (filePath.endsWith(".jsonc")) {
      return "jsonc";
    }

    return "json";
  }

  /**
   * 初始化配置文件
   * 从 config.default.json 复制到 config.json
   * @param format 配置文件格式，默认为 json
   */
  public initConfig(format: ConfigFileFormat = "json"): void {
    if (!existsSync(this.defaultConfigPath)) {
      throw new Error(`默认配置模板文件不存在: ${this.defaultConfigPath}`);
    }

    // 检查是否已有任何格式的配置文件
    if (this.configExists()) {
      throw new Error("配置文件已存在，无需重复初始化");
    }

    // 确定目标配置文件路径
    const configDir = process.env.XIAOZHI_CONFIG_DIR || process.cwd();
    const targetFileName = `xiaozhi.config.${format}`;
    const configPath = resolve(configDir, targetFileName);

    // 复制默认配置文件
    copyFileSync(this.defaultConfigPath, configPath);

    // 重置状态
    this.currentConfigPath = null;
    this.json5Writer = null;
  }

  /**
   * 加载配置文件
   * @returns 配置对象
   */
  public loadConfig(): AppConfig {
    if (!this.configExists()) {
      const error = new Error(
        "配置文件不存在，请先运行 xiaozhi init 初始化配置"
      );
      configEvents.emit("config:error", {
        error,
        operation: "loadConfig",
      });
      throw error;
    }

    try {
      const configPath = this.getConfigFilePath();
      this.currentConfigPath = configPath; // 记录当前使用的配置文件路径
      const configFileFormat = this.getConfigFileFormat(configPath);
      const rawConfigData = readFileSync(configPath, "utf8");

      // 移除可能存在的UTF-8 BOM字符（\uFEFF）
      // BOM字符在某些编辑器中不可见，但会导致JSON解析失败
      // 这个过滤确保即使文件包含BOM字符也能正常解析
      const configData = rawConfigData.replace(/^\uFEFF/, "");

      let config: AppConfig;

      // 根据文件格式使用相应的解析器
      switch (configFileFormat) {
        case "json5":
          // 使用 JSON5 解析配置对象，同时使用适配器保留注释信息
          config = parseJson5(configData) as AppConfig;
          // 创建适配器实例用于后续保存时保留注释
          this.json5Writer = createJson5Writer(configData);
          break;
        case "jsonc":
          // 使用 comment-json 解析 JSONC 格式，保留注释信息
          config = commentJson.parse(configData) as unknown as AppConfig;
          break;
        default:
          config = JSON.parse(configData) as AppConfig;
          break;
      }

      // 验证配置结构
      configValidator.validateConfig(config);

      return config;
    } catch (error) {
      // 发射配置错误事件
      configEvents.emit("config:error", {
        error: error instanceof Error ? error : new Error(String(error)),
        operation: "loadConfig",
      });
      if (error instanceof SyntaxError) {
        throw new Error(`配置文件格式错误: ${error.message}`);
      }
      throw error;
    }
  }

  /**
   * 保存配置到文件
   * 保存到原始配置文件路径，保持文件格式一致性
   * @param config 配置对象
   */
  public saveConfig(config: AppConfig): void {
    try {
      // 验证配置
      configValidator.validateConfig(config);

      // 确定保存路径 - 优先使用当前配置文件路径，否则使用默认路径
      let configPath: string;
      if (this.currentConfigPath) {
        configPath = this.currentConfigPath;
      } else {
        // 如果没有当前路径，使用 getConfigFilePath 获取
        configPath = this.getConfigFilePath();
        this.currentConfigPath = configPath;
      }

      // 根据文件格式选择序列化方法
      const configFileFormat = this.getConfigFileFormat(configPath);
      let configContent: string;

      switch (configFileFormat) {
        case "json5":
          // 对于 JSON5 格式，使用适配器保留注释
          try {
            if (this.json5Writer) {
              // 使用适配器更新配置并保留注释
              this.json5Writer.write(config);
              configContent = this.json5Writer.toSource();
            } else {
              // 如果没有适配器实例，回退到 comment-json 序列化
              console.warn("没有 JSON5 适配器实例，使用 comment-json 序列化");
              configContent = commentJson.stringify(config, null, 2);
            }
          } catch (json5Error) {
            // 如果适配器序列化失败，回退到 comment-json 序列化
            console.warn(
              "使用 JSON5 适配器保存失败，回退到 comment-json 序列化:",
              json5Error
            );
            configContent = commentJson.stringify(config, null, 2);
          }
          break;
        case "jsonc":
          // 对于 JSONC 格式，使用 comment-json 库保留注释
          try {
            // 直接使用 comment-json 的 stringify 方法
            // 如果 config 是通过 comment-json.parse 解析的，注释信息会被保留
            configContent = commentJson.stringify(config, null, 2);
          } catch (commentJsonError) {
            // 如果 comment-json 序列化失败，回退到标准 JSON
            console.warn(
              "使用 comment-json 保存失败，回退到标准 JSON 格式:",
              commentJsonError
            );
            configContent = JSON.stringify(config, null, 2);
          }
          break;
        default:
          configContent = JSON.stringify(config, null, 2);
          break;
      }

      // 保存到文件
      writeFileSync(configPath, configContent, "utf8");

      console.log("配置保存成功");
    } catch (error) {
      // 发射配置错误事件
      configEvents.emit("config:error", {
        error: error instanceof Error ? error : new Error(String(error)),
        operation: "saveConfig",
      });
      throw new Error(
        `保存配置失败: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  /**
   * 重新加载配置（清除缓存）
   */
  public reloadConfig(): void {
    this.currentConfigPath = null; // 清除配置文件路径缓存
    this.json5Writer = null; // 清除 json5Writer 实例
  }

  /**
   * 获取当前配置文件路径
   */
  public getCurrentConfigPath(): string | null {
    return this.currentConfigPath;
  }

  /**
   * 获取默认配置文件路径
   */
  public getDefaultConfigPath(): string {
    return this.defaultConfigPath;
  }

  /**
   * 获取配置目录路径（与配置文件同级目录）
   */
  public getConfigDir(): string {
    // 配置文件路径 - 优先使用环境变量指定的目录，否则使用当前工作目录
    return process.env.XIAOZHI_CONFIG_DIR || process.cwd();
  }
}

// 导出单例实例
export const configStorage = new ConfigStorage();

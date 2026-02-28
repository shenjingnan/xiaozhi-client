/**
 * 配置文件 I/O 操作
 *
 * 负责配置文件的读取、写入和格式检测
 */
import { copyFileSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import * as commentJson from "comment-json";
import type { AppConfig } from "./types.js";
import { ConfigResolver } from "./resolver.js";
import { createJson5Writer, parseJson5 } from "./json5-adapter.js";
import { ConfigValidator } from "./ConfigValidator.js";
import { ConfigEventBus } from "./ConfigEventBus.js";

// 在 ESM 中，需要从 import.meta.url 获取当前文件目录
const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * 配置文件格式类型
 */
export type ConfigFileFormat = "json" | "json5" | "jsonc";

/**
 * 配置文件 I/O 类
 */
export class ConfigIO {
  private defaultConfigPath: string;
  private currentConfigPath: string | null = null; // 跟踪当前使用的配置文件路径
  private json5Writer: {
    write(data: unknown): void;
    toSource(): string;
  } | null = null; // json5-writer 实例，用于保留 JSON5 注释
  private validator: ConfigValidator;
  private eventBus: ConfigEventBus;

  constructor(
    validator: ConfigValidator,
    eventBus: ConfigEventBus
  ) {
    this.validator = validator;
    this.eventBus = eventBus;

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
   * 初始化配置文件
   * 从默认配置模板复制到指定位置
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
    this.currentConfigPath = null; // 重置路径
    this.json5Writer = null; // 重置 json5Writer 实例
  }

  /**
   * 加载配置文件
   */
  public loadConfig(): AppConfig {
    if (!this.configExists()) {
      const error = new Error(
        "配置文件不存在，请先运行 xiaozhi init 初始化配置"
      );
      this.eventBus.emitConfigError({
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
      this.validator.validateConfig(config);

      return config;
    } catch (error) {
      // 发射配置错误事件
      this.eventBus.emitConfigError({
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
   */
  public saveConfig(config: AppConfig): void {
    try {
      // 验证配置
      this.validator.validateConfig(config);

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

      let configData: string;

      switch (configFileFormat) {
        case "json5":
          // 使用 json5-writer 保留注释信息
          if (this.json5Writer) {
            this.json5Writer.write(config);
            configData = this.json5Writer.toSource();
          } else {
            // 如果没有 json5Writer 实例，使用默认序列化
            configData = JSON.stringify(config, null, 2);
          }
          break;
        case "jsonc":
          // 使用 comment-json 序列化，保留注释
          configData = commentJson.stringify(config, null, 2);
          break;
        default:
          // 标准JSON序列化
          configData = JSON.stringify(config, null, 2);
          break;
      }

      // 写入文件
      writeFileSync(configPath, configData, "utf8");
    } catch (error) {
      this.eventBus.emitConfigError({
        error: error instanceof Error ? error : new Error(String(error)),
        operation: "saveConfig",
      });
      throw error;
    }
  }

  /**
   * 获取配置文件路径（动态计算）
   * 支持多种配置文件格式：json5 > jsonc > json
   *
   * 查找优先级：
   * 1. 环境变量 XIAOZHI_CONFIG_DIR 指定的目录
   * 2. 当前工作目录
   * 3. 用户家目录/.xiaozhi-client/
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
   * 获取默认配置文件路径
   */
  public getDefaultConfigPath(): string {
    return this.defaultConfigPath;
  }

  /**
   * 获取当前配置文件路径
   */
  public getCurrentConfigPath(): string | null {
    return this.currentConfigPath;
  }

  /**
   * 重新加载配置（清除缓存）
   */
  public reloadConfig(): void {
    this.currentConfigPath = null;
    this.json5Writer = null;
  }
}

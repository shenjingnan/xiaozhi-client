/**
 * 配置存储类
 *
 * 负责配置文件的核心 I/O 操作：
 * - 配置文件的读取和解析（支持 JSON、JSON5、JSONC 格式）
 * - 配置验证和类型检查
 * - 配置持久化
 * - 配置文件路径解析
 *
 * @example
 * ```typescript
 * import { ConfigStore } from '@xiaozhi-client/config/managers';
 *
 * const store = new ConfigStore();
 * const config = store.loadConfig();
 * store.saveConfig(updatedConfig);
 * ```
 */

import {
  copyFileSync,
  existsSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import * as commentJson from "comment-json";
import { createJson5Writer, parseJson5 } from "../json5-adapter.js";
import { ConfigResolver } from "../resolver.js";
import type {
  AppConfig,
  WebServerInstance,
} from "../types.js";

// 在 ESM 中，需要从 import.meta.url 获取当前文件目录
const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * 配置存储类
 * 负责配置文件的读取、验证、保存等核心 I/O 操作
 */
export class ConfigStore {
  private defaultConfigPath: string;
  private config: AppConfig | null = null;
  private currentConfigPath: string | null = null;
  private json5Writer: {
    write(data: unknown): void;
    toSource(): string;
  } | null = null;

  // 事件回调
  private eventCallbacks: Map<string, Array<(data: unknown) => void>> =
    new Map();

  constructor() {
    // 使用模板目录中的默认配置文件
    const possiblePaths = [
      resolve(__dirname, "..", "..", "templates", "default", "xiaozhi.config.json"),
      resolve(__dirname, "..", "templates", "default", "xiaozhi.config.json"),
      resolve(process.cwd(), "templates", "default", "xiaozhi.config.json"),
    ];

    this.defaultConfigPath =
      possiblePaths.find((path) => existsSync(path)) || possiblePaths[0];
  }

  /**
   * 注册事件监听器
   */
  public on(eventName: string, callback: (data: unknown) => void): void {
    if (!this.eventCallbacks.has(eventName)) {
      this.eventCallbacks.set(eventName, []);
    }
    this.eventCallbacks.get(eventName)?.push(callback);
  }

  /**
   * 发射事件
   */
  protected emitEvent(eventName: string, data: unknown): void {
    const callbacks = this.eventCallbacks.get(eventName);
    if (callbacks) {
      for (const callback of callbacks) {
        try {
          callback(data);
        } catch (error) {
          console.error(`事件回调执行失败 [${eventName}]:`, error);
        }
      }
    }
  }

  /**
   * 获取配置文件路径（动态计算）
   */
  protected getConfigFilePath(): string {
    const resolvedPath = ConfigResolver.resolveConfigPath();

    if (resolvedPath) {
      return resolvedPath;
    }

    const defaultDir = ConfigResolver.getDefaultConfigDir();
    if (defaultDir) {
      return resolve(defaultDir, "xiaozhi.config.json");
    }

    const configDir = process.env.XIAOZHI_CONFIG_DIR || process.cwd();
    return resolve(configDir, "xiaozhi.config.json");
  }

  /**
   * 获取配置文件格式
   */
  protected getConfigFileFormat(
    filePath: string
  ): "json5" | "jsonc" | "json" {
    if (filePath.endsWith(".json5")) {
      return "json5";
    }

    if (filePath.endsWith(".jsonc")) {
      return "jsonc";
    }

    return "json";
  }

  /**
   * 检查配置文件是否存在
   */
  public configExists(): boolean {
    return ConfigResolver.resolveConfigPath() !== null;
  }

  /**
   * 初始化配置文件
   */
  public initConfig(format: "json" | "json5" | "jsonc" = "json"): void {
    if (!existsSync(this.defaultConfigPath)) {
      throw new Error(`默认配置模板文件不存在: ${this.defaultConfigPath}`);
    }

    if (this.configExists()) {
      throw new Error("配置文件已存在，无需重复初始化");
    }

    const configDir = process.env.XIAOZHI_CONFIG_DIR || process.cwd();
    const targetFileName = `xiaozhi.config.${format}`;
    const configPath = resolve(configDir, targetFileName);

    copyFileSync(this.defaultConfigPath, configPath);
    this.config = null;
    this.json5Writer = null;
  }

  /**
   * 加载配置文件
   */
  public loadConfig(): AppConfig {
    if (!this.configExists()) {
      const error = new Error(
        "配置文件不存在，请先运行 xiaozhi init 初始化配置"
      );
      this.emitEvent("config:error", {
        error,
        operation: "loadConfig",
      });
      throw error;
    }

    try {
      const configPath = this.getConfigFilePath();
      this.currentConfigPath = configPath;
      const configFileFormat = this.getConfigFileFormat(configPath);
      const rawConfigData = readFileSync(configPath, "utf8");

      const configData = rawConfigData.replace(/^\uFEFF/, "");

      let config: AppConfig;

      switch (configFileFormat) {
        case "json5":
          config = parseJson5(configData) as AppConfig;
          this.json5Writer = createJson5Writer(configData);
          break;
        case "jsonc":
          config = commentJson.parse(configData) as unknown as AppConfig;
          break;
        default:
          config = JSON.parse(configData) as AppConfig;
          break;
      }

      this.validateConfig(config);

      return config;
    } catch (error) {
      this.emitEvent("config:error", {
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
   * 验证配置文件结构
   */
  public validateConfig(config: unknown): void {
    if (!config || typeof config !== "object") {
      throw new Error("配置文件格式错误：根对象无效");
    }

    const configObj = config as Record<string, unknown>;

    if (configObj.mcpEndpoint === undefined || configObj.mcpEndpoint === null) {
      throw new Error("配置文件格式错误：mcpEndpoint 字段无效");
    }

    if (typeof configObj.mcpEndpoint === "string") {
      // 空字符串是允许的
    } else if (Array.isArray(configObj.mcpEndpoint)) {
      for (const endpoint of configObj.mcpEndpoint) {
        if (typeof endpoint !== "string" || endpoint.trim() === "") {
          throw new Error(
            "配置文件格式错误：mcpEndpoint 数组中的每个元素必须是非空字符串"
          );
        }
      }
    } else {
      throw new Error("配置文件格式错误：mcpEndpoint 必须是字符串或字符串数组");
    }

    if (!configObj.mcpServers || typeof configObj.mcpServers !== "object") {
      throw new Error("配置文件格式错误：mcpServers 字段无效");
    }

    for (const [serverName, serverConfig] of Object.entries(
      configObj.mcpServers as Record<string, unknown>
    )) {
      if (!serverConfig || typeof serverConfig !== "object") {
        throw new Error(`配置文件格式错误：mcpServers.${serverName} 无效`);
      }
    }
  }

  /**
   * 获取配置（只读）
   */
  public getConfig(): Readonly<AppConfig> {
    if (!this.config) {
      this.config = this.loadConfig();
    }

    return structuredClone(this.config);
  }

  /**
   * 获取可修改的配置对象（内部使用）
   */
  protected getMutableConfig(): AppConfig {
    if (!this.config) {
      this.config = this.loadConfig();
    }
    return this.config;
  }

  /**
   * 保存配置到文件
   */
  public saveConfig(config: AppConfig): void {
    try {
      this.validateConfig(config);

      let configPath: string;
      if (this.currentConfigPath) {
        configPath = this.currentConfigPath;
      } else {
        configPath = this.getConfigFilePath();
        this.currentConfigPath = configPath;
      }

      const configFileFormat = this.getConfigFileFormat(configPath);
      let configContent: string;

      switch (configFileFormat) {
        case "json5":
          try {
            if (this.json5Writer) {
              this.json5Writer.write(config);
              configContent = this.json5Writer.toSource();
            } else {
              console.warn("没有 JSON5 适配器实例，使用 comment-json 序列化");
              configContent = commentJson.stringify(config, null, 2);
            }
          } catch (json5Error) {
            console.warn(
              "使用 JSON5 适配器保存失败，回退到 comment-json 序列化:",
              json5Error
            );
            configContent = commentJson.stringify(config, null, 2);
          }
          break;
        case "jsonc":
          try {
            configContent = commentJson.stringify(config, null, 2);
          } catch (commentJsonError) {
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

      writeFileSync(configPath, configContent, "utf8");

      this.config = config;

      console.log("配置保存成功");

      this.notifyConfigUpdate(config);
    } catch (error) {
      this.emitEvent("config:error", {
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
    this.config = null;
    this.currentConfigPath = null;
    this.json5Writer = null;
  }

  /**
   * 获取配置文件路径
   */
  public getConfigPath(): string {
    return this.getConfigFilePath();
  }

  /**
   * 获取默认配置文件路径
   */
  public getDefaultConfigPath(): string {
    return this.defaultConfigPath;
  }

  /**
   * 获取配置目录路径
   */
  public getConfigDir(): string {
    return process.env.XIAOZHI_CONFIG_DIR || process.cwd();
  }

  /**
   * 通知 Web 界面配置已更新
   */
  private notifyConfigUpdate(config: AppConfig): void {
    try {
      const webServer = (
        global as typeof global & { __webServer?: WebServerInstance }
      ).__webServer;
      if (webServer && typeof webServer.broadcastConfigUpdate === "function") {
        webServer.broadcastConfigUpdate(config);
        console.log("已通过 WebSocket 广播配置更新");
      }
    } catch (error) {
      console.warn(
        "通知 Web 界面配置更新失败:",
        error instanceof Error ? error.message : String(error)
      );
    }
  }
}

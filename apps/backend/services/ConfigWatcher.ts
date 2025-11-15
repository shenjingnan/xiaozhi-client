import { existsSync, readFileSync } from "node:fs";
import type { Logger } from "@root/Logger.js";
import { logger } from "@root/Logger.js";
import { categorizeError, shouldAlert } from "@services/ErrorHandler.js";
import type { MCPServiceConfig } from "@services/MCPService.js";
import type { FSWatcher } from "chokidar";
import { watch } from "chokidar";

/**
 * 配置变更事件类型
 */
export enum ConfigChangeType {
  ADDED = "added",
  MODIFIED = "modified",
  REMOVED = "removed",
  RELOADED = "reloaded", // 整个配置文件重新加载
}

/**
 * 配置变更事件接口
 */
export interface ConfigChangeEvent {
  type: ConfigChangeType;
  serviceName?: string; // 对于单个服务的变更
  oldConfig?: MCPServiceConfig;
  newConfig?: MCPServiceConfig;
  allConfigs?: MCPServiceConfig[]; // 对于整个配置文件的重新加载
  timestamp: Date;
  filePath: string;
}

/**
 * 配置验证结果
 */
export interface ConfigValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * 配置监听器选项
 */
export interface ConfigWatcherOptions {
  debounceMs: number; // 防抖延迟（毫秒）
  validateOnChange: boolean; // 是否在变更时验证配置
  backupOnChange: boolean; // 是否在变更时备份配置
  autoReload: boolean; // 是否自动重新加载配置
  ignoreInitial: boolean; // 是否忽略初始事件
}

/**
 * 配置变更回调函数类型
 */
export type ConfigChangeCallback = (
  event: ConfigChangeEvent
) => void | Promise<void>;

/**
 * 配置监听器
 */
class ConfigWatcherClass {
  private logger: Logger;
  private watcher: FSWatcher | null = null;
  private callbacks: Set<ConfigChangeCallback> = new Set();
  private currentConfigs: Map<string, MCPServiceConfig> = new Map();
  private watchedPath: string | null = null;
  private options: ConfigWatcherOptions;
  private debounceTimer: NodeJS.Timeout | null = null;
  private backupConfigs: MCPServiceConfig[] = [];

  constructor(options?: Partial<ConfigWatcherOptions>) {
    this.logger = logger;
    this.options = {
      debounceMs: 1000, // 1秒防抖
      validateOnChange: true,
      backupOnChange: true,
      autoReload: true,
      ignoreInitial: true,
      ...options,
    };
  }

  /**
   * 开始监听配置文件
   */
  startWatching(configPath: string): void {
    if (this.watcher) {
      this.logger.warn("配置监听器已在运行，先停止现有监听");
      this.stopWatching();
    }

    if (!existsSync(configPath)) {
      throw new Error(`配置文件不存在: ${configPath}`);
    }

    this.watchedPath = configPath;
    this.logger.info(`开始监听配置文件: ${configPath}`);

    // 加载初始配置
    try {
      this.loadInitialConfig(configPath);
    } catch (error) {
      this.logger.error("加载初始配置失败:", error);
      throw error;
    }

    // 创建文件监听器
    this.watcher = watch(configPath, {
      persistent: true,
      ignoreInitial: this.options.ignoreInitial,
      awaitWriteFinish: {
        stabilityThreshold: 100,
        pollInterval: 100,
      },
    });

    // 监听文件变更事件
    this.watcher.on("change", (path) => {
      this.logger.debug(`配置文件变更: ${path}`);
      this.handleConfigChange(path);
    });

    this.watcher.on("error", (error) => {
      this.logger.error("配置文件监听错误:", error);
      const mcpError = categorizeError(
        error instanceof Error ? error : new Error(String(error)),
        "ConfigWatcher"
      );
      if (shouldAlert(mcpError)) {
        this.logger.error("配置监听器发生严重错误，需要人工干预");
      }
    });
  }

  /**
   * 停止监听配置文件
   */
  stopWatching(): void {
    if (this.watcher) {
      this.watcher.close();
      this.watcher = null;
      this.logger.info("已停止配置文件监听");
    }

    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }

    this.watchedPath = null;
  }

  /**
   * 添加配置变更回调
   */
  onConfigChange(callback: ConfigChangeCallback): void {
    this.callbacks.add(callback);
    this.logger.debug("已添加配置变更回调");
  }

  /**
   * 移除配置变更回调
   */
  removeConfigChangeCallback(callback: ConfigChangeCallback): void {
    this.callbacks.delete(callback);
    this.logger.debug("已移除配置变更回调");
  }

  /**
   * 手动重新加载配置
   */
  async reloadConfig(): Promise<void> {
    if (!this.watchedPath) {
      throw new Error("未设置监听路径，无法重新加载配置");
    }

    this.logger.info("手动重新加载配置");
    await this.handleConfigChange(this.watchedPath);
  }

  /**
   * 验证配置
   */
  validateConfig(configs: MCPServiceConfig[]): ConfigValidationResult {
    const result: ConfigValidationResult = {
      valid: true,
      errors: [],
      warnings: [],
    };

    const serviceNames = new Set<string>();

    for (const config of configs) {
      // 检查必需字段
      if (!config.name) {
        result.valid = false;
        result.errors.push("服务配置缺少 name 字段");
        continue;
      }

      if (!config.type) {
        result.valid = false;
        result.errors.push(`服务 ${config.name} 缺少 type 字段`);
        continue;
      }

      // 检查重复的服务名
      if (serviceNames.has(config.name)) {
        result.valid = false;
        result.errors.push(`重复的服务名: ${config.name}`);
      } else {
        serviceNames.add(config.name);
      }

      // 检查传输类型特定的配置
      switch (config.type) {
        case "stdio":
          if (!config.command) {
            result.valid = false;
            result.errors.push(`stdio 服务 ${config.name} 缺少 command 字段`);
          }
          break;
        case "sse":
        case "streamable-http":
          if (!config.url) {
            result.valid = false;
            result.errors.push(
              `${config.type} 服务 ${config.name} 缺少 url 字段`
            );
          }
          break;
      }

      // 检查可选字段的合理性
      if (config.timeout && config.timeout <= 0) {
        result.warnings.push(`服务 ${config.name} 的 timeout 值应该大于 0`);
      }

      if (config.retryAttempts && config.retryAttempts < 0) {
        result.warnings.push(
          `服务 ${config.name} 的 retryAttempts 值不应该小于 0`
        );
      }
    }

    return result;
  }

  /**
   * 获取当前配置
   */
  getCurrentConfigs(): MCPServiceConfig[] {
    return Array.from(this.currentConfigs.values());
  }

  /**
   * 获取备份配置
   */
  getBackupConfigs(): MCPServiceConfig[] {
    return [...this.backupConfigs];
  }

  /**
   * 恢复到备份配置
   */
  restoreFromBackup(): MCPServiceConfig[] {
    if (this.backupConfigs.length === 0) {
      throw new Error("没有可用的备份配置");
    }

    this.logger.info("恢复到备份配置");
    return [...this.backupConfigs];
  }

  /**
   * 更新配置选项
   */
  updateOptions(options: Partial<ConfigWatcherOptions>): void {
    this.options = { ...this.options, ...options };
    this.logger.info("配置监听器选项已更新");
  }

  /**
   * 获取当前选项
   */
  getOptions(): ConfigWatcherOptions {
    return { ...this.options };
  }

  /**
   * 加载初始配置
   */
  private loadInitialConfig(configPath: string): void {
    try {
      const configContent = readFileSync(configPath, "utf-8");
      const configData = JSON.parse(configContent);

      let configs: MCPServiceConfig[] = [];
      if (configData.mcpServices && Array.isArray(configData.mcpServices)) {
        configs = configData.mcpServices;
      } else if (Array.isArray(configData)) {
        configs = configData;
      } else {
        throw new Error("配置文件格式不正确，应包含 mcpServices 数组");
      }

      // 验证配置
      if (this.options.validateOnChange) {
        const validation = this.validateConfig(configs);
        if (!validation.valid) {
          throw new Error(`配置验证失败: ${validation.errors.join(", ")}`);
        }
        if (validation.warnings.length > 0) {
          this.logger.warn(`配置警告: ${validation.warnings.join(", ")}`);
        }
      }

      // 更新当前配置
      this.currentConfigs.clear();
      for (const config of configs) {
        this.currentConfigs.set(config.name, config);
      }

      // 备份配置
      if (this.options.backupOnChange) {
        this.backupConfigs = [...configs];
      }

      this.logger.info(`已加载 ${configs.length} 个服务配置`);
    } catch (error) {
      this.logger.error("加载配置文件失败:", error);
      throw error;
    }
  }

  /**
   * 处理配置文件变更
   */
  private async handleConfigChange(filePath: string): Promise<void> {
    // 防抖处理
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }

    this.debounceTimer = setTimeout(async () => {
      try {
        await this.processConfigChange(filePath);
      } catch (error) {
        this.logger.error("处理配置变更失败:", error);
      }
    }, this.options.debounceMs);
  }

  /**
   * 处理配置变更的核心逻辑
   */
  private async processConfigChange(filePath: string): Promise<void> {
    this.logger.info("处理配置文件变更");

    try {
      // 读取新配置
      const configContent = readFileSync(filePath, "utf-8");
      const configData = JSON.parse(configContent);

      let newConfigs: MCPServiceConfig[] = [];
      if (configData.mcpServices && Array.isArray(configData.mcpServices)) {
        newConfigs = configData.mcpServices;
      } else if (Array.isArray(configData)) {
        newConfigs = configData;
      } else {
        throw new Error("配置文件格式不正确");
      }

      // 验证新配置
      if (this.options.validateOnChange) {
        const validation = this.validateConfig(newConfigs);
        if (!validation.valid) {
          this.logger.error(`配置验证失败: ${validation.errors.join(", ")}`);
          return;
        }
        if (validation.warnings.length > 0) {
          this.logger.warn(`配置警告: ${validation.warnings.join(", ")}`);
        }
      }

      // 比较配置变更
      const changes = this.compareConfigs(
        Array.from(this.currentConfigs.values()),
        newConfigs
      );

      // 备份当前配置
      if (this.options.backupOnChange) {
        this.backupConfigs = Array.from(this.currentConfigs.values());
      }

      // 更新当前配置
      this.currentConfigs.clear();
      for (const config of newConfigs) {
        this.currentConfigs.set(config.name, config);
      }

      // 触发变更事件
      for (const change of changes) {
        await this.notifyConfigChange(change);
      }

      // 如果有变更，触发整体重新加载事件
      if (changes.length > 0) {
        const reloadEvent: ConfigChangeEvent = {
          type: ConfigChangeType.RELOADED,
          allConfigs: newConfigs,
          timestamp: new Date(),
          filePath,
        };
        await this.notifyConfigChange(reloadEvent);
      }

      this.logger.info(`配置变更处理完成，共 ${changes.length} 个变更`);
    } catch (error) {
      this.logger.error("处理配置变更失败:", error);
      const mcpError = categorizeError(error as Error, "ConfigWatcher");
      if (shouldAlert(mcpError)) {
        this.logger.error("配置变更处理发生严重错误，可能需要回滚配置");
      }
    }
  }

  /**
   * 比较配置变更
   */
  private compareConfigs(
    oldConfigs: MCPServiceConfig[],
    newConfigs: MCPServiceConfig[]
  ): ConfigChangeEvent[] {
    const changes: ConfigChangeEvent[] = [];
    const oldConfigMap = new Map(oldConfigs.map((c) => [c.name, c]));
    const newConfigMap = new Map(newConfigs.map((c) => [c.name, c]));

    // 检查新增和修改的服务
    for (const [serviceName, newConfig] of newConfigMap) {
      const oldConfig = oldConfigMap.get(serviceName);

      if (!oldConfig) {
        // 新增服务
        changes.push({
          type: ConfigChangeType.ADDED,
          serviceName,
          newConfig,
          timestamp: new Date(),
          filePath: this.watchedPath!,
        });
      } else if (JSON.stringify(oldConfig) !== JSON.stringify(newConfig)) {
        // 修改服务
        changes.push({
          type: ConfigChangeType.MODIFIED,
          serviceName,
          oldConfig,
          newConfig,
          timestamp: new Date(),
          filePath: this.watchedPath!,
        });
      }
    }

    // 检查删除的服务
    for (const [serviceName, oldConfig] of oldConfigMap) {
      if (!newConfigMap.has(serviceName)) {
        changes.push({
          type: ConfigChangeType.REMOVED,
          serviceName,
          oldConfig,
          timestamp: new Date(),
          filePath: this.watchedPath!,
        });
      }
    }

    return changes;
  }

  /**
   * 通知配置变更
   */
  private async notifyConfigChange(event: ConfigChangeEvent): Promise<void> {
    this.logger.debug(
      `通知配置变更: ${event.type} - ${event.serviceName || "全部"}`
    );

    const promises = Array.from(this.callbacks).map(async (callback) => {
      try {
        await callback(event);
      } catch (error) {
        this.logger.error("配置变更回调执行失败:", error);
      }
    });

    await Promise.all(promises);
  }
}

// 导出单例实例
let configWatcherInstance: ConfigWatcherClass | null = null;

export const ConfigWatcher = (() => {
  if (!configWatcherInstance) {
    configWatcherInstance = new ConfigWatcherClass();
  }
  return configWatcherInstance;
})();

// 导出类型和类
export { ConfigWatcherClass };

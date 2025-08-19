/**
 * 依赖注入容器
 */

import type { IDIContainer } from "./interfaces/Config.js";

/**
 * 依赖注入容器实现
 */
export class DIContainer implements IDIContainer {
  private instances = new Map<string, any>();
  private factories = new Map<string, () => any>();
  private singletons = new Set<string>();

  /**
   * 注册服务工厂
   */
  register<T>(key: string, factory: () => T, singleton = false): void {
    this.factories.set(key, factory);
    if (singleton) {
      this.singletons.add(key);
    }
  }

  /**
   * 注册单例服务
   */
  registerSingleton<T>(key: string, factory: () => T): void {
    this.register(key, factory, true);
  }

  /**
   * 注册实例
   */
  registerInstance<T>(key: string, instance: T): void {
    this.instances.set(key, instance);
    this.singletons.add(key);
  }

  /**
   * 获取服务实例
   */
  get<T>(key: string): T {
    // 如果是单例且已经创建过实例，直接返回
    if (this.singletons.has(key) && this.instances.has(key)) {
      return this.instances.get(key);
    }

    // 获取工厂函数
    const factory = this.factories.get(key);
    if (!factory) {
      throw new Error(`Service ${key} not registered`);
    }

    // 创建实例
    const instance = factory();

    // 如果是单例，缓存实例
    if (this.singletons.has(key)) {
      this.instances.set(key, instance);
    }

    return instance;
  }

  /**
   * 检查服务是否已注册
   */
  has(key: string): boolean {
    return this.factories.has(key) || this.instances.has(key);
  }

  /**
   * 清除所有注册的服务
   */
  clear(): void {
    this.instances.clear();
    this.factories.clear();
    this.singletons.clear();
  }

  /**
   * 获取所有已注册的服务键
   */
  getRegisteredKeys(): string[] {
    const factoryKeys = Array.from(this.factories.keys());
    const instanceKeys = Array.from(this.instances.keys());
    return [...new Set([...factoryKeys, ...instanceKeys])];
  }

  /**
   * 创建默认容器实例
   */
  static create(): DIContainer {
    const container = new DIContainer();

    // 注册工具类（单例）
    container.registerSingleton("versionUtils", () => {
      const { VersionUtils } = require("./utils/VersionUtils.js");
      return VersionUtils;
    });

    container.registerSingleton("platformUtils", () => {
      const { PlatformUtils } = require("./utils/PlatformUtils.js");
      return PlatformUtils;
    });

    container.registerSingleton("formatUtils", () => {
      const { FormatUtils } = require("./utils/FormatUtils.js");
      return FormatUtils;
    });

    container.registerSingleton("fileUtils", () => {
      const { FileUtils } = require("./utils/FileUtils.js");
      return FileUtils;
    });

    container.registerSingleton("pathUtils", () => {
      const { PathUtils } = require("./utils/PathUtils.js");
      return PathUtils;
    });

    container.registerSingleton("validation", () => {
      const { Validation } = require("./utils/Validation.js");
      return Validation;
    });

    // 注册配置管理器（单例）
    container.registerSingleton("configManager", () => {
      const { configManager } = require("../configManager.js");
      return configManager;
    });

    // 注册日志管理器（单例）
    container.registerSingleton("logger", () => {
      const { logger } = require("../Logger.js");
      return logger;
    });

    // 注册服务层（稍后在服务层实现时添加）
    // container.registerSingleton('processManager', () => {
    //   const { ProcessManagerImpl } = require('./services/ProcessManager.js');
    //   return new ProcessManagerImpl();
    // });

    // container.registerSingleton('serviceManager', () => {
    //   const { ServiceManagerImpl } = require('./services/ServiceManager.js');
    //   const processManager = container.get('processManager');
    //   const daemonManager = container.get('daemonManager');
    //   return new ServiceManagerImpl(processManager, daemonManager);
    // });

    // container.registerSingleton('daemonManager', () => {
    //   const { DaemonManagerImpl } = require('./services/DaemonManager.js');
    //   return new DaemonManagerImpl();
    // });

    // container.registerSingleton('templateManager', () => {
    //   const { TemplateManagerImpl } = require('./services/TemplateManager.js');
    //   return new TemplateManagerImpl();
    // });

    // 注册命令层（稍后在命令层实现时添加）
    // container.register('serviceCommand', () => {
    //   const { ServiceCommand } = require('./commands/ServiceCommand.js');
    //   const serviceManager = container.get('serviceManager');
    //   const processManager = container.get('processManager');
    //   return new ServiceCommand(serviceManager, processManager);
    // });

    // container.register('configCommand', () => {
    //   const { ConfigCommand } = require('./commands/ConfigCommand.js');
    //   const configManager = container.get('configManager');
    //   const validation = container.get('validation');
    //   return new ConfigCommand(configManager, validation);
    // });

    // container.register('projectCommand', () => {
    //   const { ProjectCommand } = require('./commands/ProjectCommand.js');
    //   const templateManager = container.get('templateManager');
    //   const fileUtils = container.get('fileUtils');
    //   return new ProjectCommand(templateManager, fileUtils);
    // });

    // container.register('mcpCommand', () => {
    //   const { McpCommand } = require('./commands/McpCommand.js');
    //   return new McpCommand();
    // });

    // container.register('infoCommand', () => {
    //   const { InfoCommand } = require('./commands/InfoCommand.js');
    //   const versionUtils = container.get('versionUtils');
    //   const platformUtils = container.get('platformUtils');
    //   return new InfoCommand(versionUtils, platformUtils);
    // });

    return container;
  }
}

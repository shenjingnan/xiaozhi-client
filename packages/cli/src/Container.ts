/**
 * 依赖注入容器
 */

import { configManager } from "@xiaozhi-client/config";
import { VersionUtils } from "@xiaozhi-client/version";
import { ErrorHandler } from "./errors/ErrorHandlers";
import type { IDIContainer } from "./interfaces/Config";
import { FileUtils } from "./utils/FileUtils";
import { FormatUtils } from "./utils/FormatUtils";
import { PathUtils } from "./utils/PathUtils";
import { PlatformUtils } from "./utils/PlatformUtils";
import { Validation } from "./utils/Validation";

/**
 * 依赖注入容器实现
 */
export class DIContainer implements IDIContainer {
  private instances = new Map<string, any>();
  private factories = new Map<string, () => any>();
  private asyncFactories = new Map<string, () => Promise<any>>();
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
  static async create(): Promise<DIContainer> {
    const container = new DIContainer();

    // 注册工具类（单例）
    container.registerSingleton("versionUtils", () => {
      return VersionUtils;
    });

    container.registerSingleton("platformUtils", () => {
      return PlatformUtils;
    });

    container.registerSingleton("formatUtils", () => {
      return FormatUtils;
    });

    container.registerSingleton("fileUtils", () => {
      return FileUtils;
    });

    container.registerSingleton("pathUtils", () => {
      return PathUtils;
    });

    container.registerSingleton("validation", () => {
      return Validation;
    });

    // 注册配置管理器（单例）
    container.registerSingleton("configManager", () => {
      return configManager;
    });

    // 注册错误处理器（单例）
    container.registerSingleton("errorHandler", () => {
      return ErrorHandler;
    });

    // 使用 ESM 标准动态 import 并行加载所有服务模块
    const [
      { ProcessManagerImpl },
      { DaemonManagerImpl },
      { ServiceManagerImpl },
      { TemplateManagerImpl },
    ] = await Promise.all([
      import("./services/ProcessManager.js"),
      import("./services/DaemonManager.js"),
      import("./services/ServiceManager.js"),
      import("./services/TemplateManager.js"),
    ]);

    // 注册服务层（使用预加载的模块）
    container.registerSingleton("processManager", () => {
      return new ProcessManagerImpl();
    });

    container.registerSingleton("daemonManager", () => {
      const processManager = container.get("processManager");
      return new DaemonManagerImpl(processManager);
    });

    container.registerSingleton("serviceManager", () => {
      const processManager = container.get("processManager");
      const configManager = container.get("configManager");
      return new ServiceManagerImpl(processManager, configManager);
    });

    container.registerSingleton("templateManager", () => {
      return new TemplateManagerImpl();
    });

    // 注册命令层（稍后在命令层实现时添加）
    // container.register('serviceCommand', () => {
    //   const { ServiceCommand } = await import('./commands/ServiceCommand.js');
    //   const serviceManager = container.get('serviceManager');
    //   const processManager = container.get('processManager');
    //   return new ServiceCommand(serviceManager, processManager);
    // });

    // container.register('configCommand', () => {
    //   const { ConfigCommand } = await import('./commands/ConfigCommand.js');
    //   const configManager = container.get('configManager');
    //   const validation = container.get('validation');
    //   return new ConfigCommand(configManager, validation);
    // });

    // container.register('projectCommand', () => {
    //   const { ProjectCommand } = await import('./commands/ProjectCommand.js');
    //   const templateManager = container.get('templateManager');
    //   const fileUtils = container.get('fileUtils');
    //   return new ProjectCommand(templateManager, fileUtils);
    // });

    // container.register('mcpCommand', () => {
    //   const { McpCommand } = await import('./commands/McpCommand.js');
    //   return new McpCommand();
    // });

    // container.register('infoCommand', () => {
    //   const { InfoCommand } = await import('./commands/InfoCommand.js');
    //   const versionUtils = container.get('versionUtils');
    //   const platformUtils = container.get('platformUtils');
    //   return new InfoCommand(versionUtils, platformUtils);
    // });

    return container;
  }
}

/**
 * 创建并配置 DI 容器
 */
export async function createContainer(): Promise<IDIContainer> {
  return await DIContainer.create();
}

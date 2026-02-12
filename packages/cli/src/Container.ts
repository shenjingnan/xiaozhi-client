/**
 * 依赖注入容器
 */

import type { ConfigManager } from "@xiaozhi-client/config";
import { configManager } from "@xiaozhi-client/config";
import { VersionUtils } from "@xiaozhi-client/version";
import { ErrorHandler } from "./errors/ErrorHandlers";
import type { IDIContainer } from "./interfaces/Config";
import type {
  DaemonManager,
  ProcessManager,
  ServiceManager,
  TemplateManager,
} from "./interfaces/Service";
import { FileUtils } from "./utils/FileUtils";
import { FormatUtils } from "./utils/FormatUtils";
import { PathUtils } from "./utils/PathUtils";
import { PlatformUtils } from "./utils/PlatformUtils";
import { Validation } from "./utils/Validation";

/**
 * 服务类型映射
 * 定义每个服务键对应的类型，确保类型安全
 */
export interface ServiceMap {
  versionUtils: typeof VersionUtils;
  platformUtils: typeof PlatformUtils;
  formatUtils: typeof FormatUtils;
  fileUtils: typeof FileUtils;
  pathUtils: typeof PathUtils;
  validation: typeof Validation;
  configManager: ConfigManager;
  errorHandler: typeof ErrorHandler;
  processManager: ProcessManager;
  daemonManager: DaemonManager;
  serviceManager: ServiceManager;
  templateManager: TemplateManager;
}

/**
 * 服务键类型
 */
export type ServiceKey = keyof ServiceMap;

/**
 * 依赖注入容器实现
 */
export class DIContainer implements IDIContainer {
  private instances = new Map<ServiceKey, ServiceMap[ServiceKey]>();
  private factories = new Map<
    ServiceKey,
    () => ServiceMap[ServiceKey]
  >();
  private asyncFactories = new Map<
    ServiceKey,
    () => Promise<ServiceMap[ServiceKey]>
  >();
  private singletons = new Set<ServiceKey>();

  /**
   * 注册服务工厂
   */
  register<K extends ServiceKey>(
    key: K,
    factory: () => ServiceMap[K],
    singleton = false
  ): void {
    this.factories.set(key, factory);
    if (singleton) {
      this.singletons.add(key);
    }
  }

  /**
   * 注册单例服务
   */
  registerSingleton<K extends ServiceKey>(
    key: K,
    factory: () => ServiceMap[K]
  ): void {
    this.register(key, factory, true);
  }

  /**
   * 注册实例
   */
  registerInstance<K extends ServiceKey>(
    key: K,
    instance: ServiceMap[K]
  ): void {
    this.instances.set(key, instance);
    this.singletons.add(key);
  }

  /**
   * 获取服务实例（类型安全）
   */
  get<K extends ServiceKey>(key: K): ServiceMap[K] {
    // 如果是单例且已经创建过实例，直接返回
    if (this.singletons.has(key) && this.instances.has(key)) {
      return this.instances.get(key) as ServiceMap[K];
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
  has(key: ServiceKey): boolean {
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
  getRegisteredKeys(): ServiceKey[] {
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

    // 注册服务层
    container.registerSingleton("processManager", () => {
      const ProcessManagerModule = require("./services/ProcessManager.js");
      return new ProcessManagerModule.ProcessManagerImpl();
    });

    container.registerSingleton("daemonManager", () => {
      const DaemonManagerModule = require("./services/DaemonManager.js");
      const processManager = container.get("processManager");
      return new DaemonManagerModule.DaemonManagerImpl(processManager);
    });

    container.registerSingleton("serviceManager", () => {
      const ServiceManagerModule = require("./services/ServiceManager.js");
      const processManager = container.get("processManager");
      const configManager = container.get("configManager");
      return new ServiceManagerModule.ServiceManagerImpl(
        processManager,
        configManager
      );
    });

    container.registerSingleton("templateManager", () => {
      // 使用动态导入的同步版本
      const TemplateManagerModule = require("./services/TemplateManager.js");
      return new TemplateManagerModule.TemplateManagerImpl();
    });

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

/**
 * 创建并配置 DI 容器
 */
export async function createContainer(): Promise<IDIContainer> {
  return DIContainer.create();
}

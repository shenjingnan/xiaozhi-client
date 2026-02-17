/**
 * 依赖注入容器
 */

import type { ConfigManager } from "@xiaozhi-client/config";
import { configManager } from "@xiaozhi-client/config";
import type { VersionUtilsType } from "@xiaozhi-client/version";
import { VersionUtils } from "@xiaozhi-client/version";
import { ErrorHandler } from "./errors/ErrorHandlers";
import type { IDIContainer } from "./interfaces/Config";
import type {
  DaemonManager as IDaemonManager,
  ProcessManager as IProcessManager,
  ServiceManager as IServiceManager,
  TemplateManager as ITemplateManager,
} from "./interfaces/Service";
import { FileUtils } from "./utils/FileUtils";
import { FormatUtils } from "./utils/FormatUtils";
import { PathUtils } from "./utils/PathUtils";
import { PlatformUtils } from "./utils/PlatformUtils";
import { Validation } from "./utils/Validation";

/**
 * 服务类型映射
 * 定义容器中所有注册服务的类型
 */
export interface ServiceTypes {
  /** 进程管理器 */
  processManager: IProcessManager;
  /** 守护进程管理器 */
  daemonManager: IDaemonManager;
  /** 服务管理器 */
  serviceManager: IServiceManager;
  /** 模板管理器 */
  templateManager: ITemplateManager;
  /** 配置管理器 */
  configManager: ConfigManager;
  /** 错误处理器 */
  errorHandler: typeof ErrorHandler;
  /** 版本工具类 */
  versionUtils: VersionUtilsType;
  /** 平台工具类 */
  platformUtils: typeof PlatformUtils;
  /** 格式化工具类 */
  formatUtils: typeof FormatUtils;
  /** 文件工具类 */
  fileUtils: typeof FileUtils;
  /** 路径工具类 */
  pathUtils: typeof PathUtils;
  /** 验证工具类 */
  validation: typeof Validation;
}

/**
 * 服务键类型：从 ServiceTypes 中提取所有键的联合类型
 */
export type ServiceKey = keyof ServiceTypes;

/**
 * 依赖注入容器实现
 * 使用类型映射提供类型安全的服务注册和获取
 */
export class DIContainer implements IDIContainer {
  /** 已创建的服务实例 */
  private instances = new Map<ServiceKey, unknown>();
  /** 服务工厂函数 */
  private factories = new Map<ServiceKey, () => unknown>();
  /** 异步服务工厂函数（预留，当前未使用） */
  private asyncFactories = new Map<ServiceKey, () => Promise<unknown>>();
  /** 单例服务键集合 */
  private singletons = new Set<ServiceKey>();

  /**
   * 注册服务工厂
   * @param key 服务键
   * @param factory 工厂函数
   * @param singleton 是否为单例
   */
  register<K extends ServiceKey>(
    key: K,
    factory: () => ServiceTypes[K],
    singleton = false
  ): void {
    this.factories.set(key, factory);
    if (singleton) {
      this.singletons.add(key);
    }
  }

  /**
   * 注册单例服务
   * @param key 服务键
   * @param factory 工厂函数
   */
  registerSingleton<K extends ServiceKey>(
    key: K,
    factory: () => ServiceTypes[K]
  ): void {
    this.register(key, factory, true);
  }

  /**
   * 注册实例
   * @param key 服务键
   * @param instance 服务实例
   */
  registerInstance<K extends ServiceKey>(
    key: K,
    instance: ServiceTypes[K]
  ): void {
    this.instances.set(key, instance);
    this.singletons.add(key);
  }

  /**
   * 获取服务实例
   * @param key 服务键
   * @returns 服务实例
   * @throws 当服务未注册时抛出错误
   */
  get<K extends ServiceKey>(key: K): ServiceTypes[K] {
    // 如果是单例且已经创建过实例，直接返回
    if (this.singletons.has(key) && this.instances.has(key)) {
      return this.instances.get(key) as ServiceTypes[K];
    }

    // 获取工厂函数
    const factory = this.factories.get(key);
    if (!factory) {
      throw new Error(`Service ${String(key)} not registered`);
    }

    // 创建实例
    const instance = factory() as ServiceTypes[K];

    // 如果是单例，缓存实例
    if (this.singletons.has(key)) {
      this.instances.set(key, instance);
    }

    return instance;
  }

  /**
   * 检查服务是否已注册
   * @param key 服务键
   * @returns 是否已注册
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
   * @returns 服务键数组
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

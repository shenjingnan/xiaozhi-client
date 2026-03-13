/**
 * 配置接口定义
 */

/**
 * 依赖注入容器接口
 */
export interface IDIContainer {
  /** 注册服务工厂 */
  register<T>(key: string, factory: () => T, singleton?: boolean): void;
  /** 注册单例服务 */
  registerSingleton<T>(key: string, factory: () => T): void;
  /** 注册实例 */
  registerInstance<T>(key: string, instance: T): void;
  /** 获取服务实例 */
  get<T>(key: string): T;
  /** 检查服务是否已注册 */
  has(key: string): boolean;
  /** 清除所有注册的服务 */
  clear(): void;
  /** 获取所有已注册的服务键 */
  getRegisteredKeys(): string[];
}

/**
 * 配置验证结果
 */
export interface ValidationResult {
  /** 是否有效 */
  valid: boolean;
  /** 错误信息 */
  error?: string;
}

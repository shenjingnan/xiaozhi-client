/**
 * 配置接口定义
 */

/**
 * 依赖注入容器接口
 */
export interface IDIContainer {
  /** 注册服务 */
  register<T>(key: string, factory: () => T): void;
  /** 获取服务实例 */
  get<T>(key: string): T;
  /** 检查服务是否已注册 */
  has(key: string): boolean;
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

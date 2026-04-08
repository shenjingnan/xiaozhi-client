/**
 * 配置接口定义
 */

import type { ServiceKey } from "../Container";

/**
 * 依赖注入容器接口
 */
export interface IDIContainer {
  /** 注册服务 */
  register<K extends ServiceKey>(
    key: K,
    factory: () => unknown,
    singleton?: boolean
  ): void;
  /** 获取服务实例 */
  get<K extends ServiceKey>(key: K): unknown;
  /** 检查服务是否已注册 */
  has(key: ServiceKey): boolean;
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

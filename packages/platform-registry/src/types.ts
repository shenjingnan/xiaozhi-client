/**
 * 平台注册表共享类型定义
 */

/**
 * 平台配置泛型接口
 */
export interface PlatformConfig {
  /** 平台类型 */
  readonly platform: string;
  [key: string]: unknown;
}

/**
 * 平台接口泛型定义
 * @template TController - 控制器类型
 * @template TPlatform - 平台类型
 */
export interface Platform<TController, TPlatform extends { readonly platform: string }> {
  /** 平台唯一标识 */
  readonly platform: string;

  /**
   * 创建控制器
   * @param config - 平台配置
   * @returns 控制器实例
   */
  createController(config: PlatformConfig): TController;

  /**
   * 校验配置
   * @param config - 用户配置
   * @returns 校验后的配置
   */
  validateConfig(config: unknown): PlatformConfig;

  /**
   * 获取认证头
   * @param config - 平台配置
   * @returns 认证头
   */
  getAuthHeaders(config: PlatformConfig): Record<string, string>;

  /**
   * 获取服务地址
   * @param config - 平台配置
   * @returns 服务地址
   */
  getEndpoint(config: PlatformConfig): string;
}

/**
 * 平台注册表接口
 * @template TPlatform - 平台类型
 */
export interface PlatformRegistry<TPlatform> {
  /** 获取平台 */
  get(platform: string): TPlatform | undefined;

  /** 注册平台 */
  register(platform: TPlatform): void;

  /** 获取所有已注册的平台 */
  list(): string[];
}

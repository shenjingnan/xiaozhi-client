/**
 * 平台核心类型（泛型基类）
 * 用于 ASR、TTS 等需要平台抽象的模块
 */

/**
 * 平台配置
 */
export interface PlatformConfig {
  /** 平台类型 */
  platform: string;
  [key: string]: unknown;
}

/**
 * 平台接口（泛型版本）
 * @template TController - 控制器类型
 */
export interface BasePlatform<TController> {
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
   * @returns WebSocket URL
   */
  getEndpoint(config: PlatformConfig): string;
}

/**
 * 平台注册表（泛型版本）
 * @template TPlatform - 平台类型
 */
export interface BasePlatformRegistry<TPlatform> {
  /** 获取平台 */
  get(platform: string): TPlatform | undefined;

  /** 注册平台 */
  register(platform: TPlatform): void;

  /** 获取所有已注册的平台 */
  list(): string[];
}

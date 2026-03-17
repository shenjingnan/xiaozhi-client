/**
 * 平台相关类型定义
 * ASR 和 TTS 包共享的泛型接口
 */

/**
 * 基础平台配置接口
 */
export interface BasePlatformConfig {
  /** 平台类型 */
  platform: string;
  [key: string]: unknown;
}

/**
 * 平台接口泛型定义
 * @template TController - 控制器类型（ASRController 或 TTSController）
 */
export interface Platform<TController> {
  /** 平台唯一标识 */
  readonly platform: string;

  /**
   * 创建控制器实例
   * @param config - 平台配置
   * @returns 控制器实例
   */
  createController(config: BasePlatformConfig): TController;

  /**
   * 校验配置
   * @param config - 用户配置
   * @returns 校验后的配置
   */
  validateConfig(config: unknown): BasePlatformConfig;

  /**
   * 获取认证头
   * @param config - 平台配置
   * @returns 认证头
   */
  getAuthHeaders(config: BasePlatformConfig): Record<string, string>;

  /**
   * 获取服务地址
   * @param config - 平台配置
   * @returns WebSocket URL
   */
  getEndpoint(config: BasePlatformConfig): string;
}

/**
 * 平台注册表接口泛型定义
 * @template TPlatform - 平台类型
 */
export interface PlatformRegistry<TPlatform> {
  /**
   * 获取平台
   * @param platform - 平台名称
   * @returns 平台实例或 undefined
   */
  get(platform: string): TPlatform | undefined;

  /**
   * 注册平台
   * @param platform - 平台实例
   */
  register(platform: TPlatform): void;

  /**
   * 获取所有已注册的平台名称
   * @returns 平台名称数组
   */
  list(): string[];
}

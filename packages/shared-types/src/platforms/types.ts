/**
 * 平台定义相关共享类型
 */

/**
 * 平台定义泛型接口
 * 用于 ASR/TTS 等平台的配置定义
 */
export interface PlatformDefinition {
  /** 平台类型 */
  platform: string;
  [key: string]: unknown;
}

/**
 * 平台注册表接口
 * 用于管理平台实例的注册和查找
 */
export interface PlatformRegistry<T extends { platform: string }> {
  /** 获取平台 */
  get(platform: string): T | undefined;

  /** 注册平台 */
  register(platform: T): void;

  /** 获取所有已注册的平台 */
  list(): string[];
}
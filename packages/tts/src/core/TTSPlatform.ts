/**
 * TTS 平台抽象接口
 */

import type {
  PlatformConfig,
  PlatformRegistry,
  TTSController,
  TTSPlatform,
} from "./types.js";

/**
 * 创建 TTS 平台实例
 */
export type TTSPlatformFactory = (config: PlatformConfig) => TTSPlatform;

/**
 * 简单平台注册表实现
 */
export class SimplePlatformRegistry implements PlatformRegistry {
  private platforms: Map<string, TTSPlatform> = new Map();

  get(platform: string): TTSPlatform | undefined {
    return this.platforms.get(platform);
  }

  register(platform: TTSPlatform): void {
    this.platforms.set(platform.platform, platform);
  }

  list(): string[] {
    return Array.from(this.platforms.keys());
  }
}

/**
 * 全局平台注册表
 */
export const platformRegistry = new SimplePlatformRegistry();

/**
 * 注册平台装饰器
 * 用于自动注册平台实现
 */
export function registerPlatform(platform: TTSPlatform): ClassDecorator {
  return () => {
    platformRegistry.register(platform);
  };
}

export type { TTSController, TTSPlatform, PlatformConfig };

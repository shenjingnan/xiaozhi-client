/**
 * ASR 平台抽象接口
 */

import type {
  ASRController,
  ASRPlatform,
  PlatformConfig,
  PlatformRegistry,
} from "./types.js";

/**
 * 创建 ASR 平台实例
 */
export type ASRPlatformFactory = (config: PlatformConfig) => ASRPlatform;

/**
 * 简单平台注册表实现
 */
export class SimplePlatformRegistry implements PlatformRegistry {
  private platforms: Map<string, ASRPlatform> = new Map();

  get(platform: string): ASRPlatform | undefined {
    return this.platforms.get(platform);
  }

  register(platform: ASRPlatform): void {
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
export function registerPlatform(platform: ASRPlatform): ClassDecorator {
  return () => {
    platformRegistry.register(platform);
  };
}

export type { ASRPlatform, ASRController, PlatformConfig };

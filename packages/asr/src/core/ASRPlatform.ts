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
 * 泛型平台注册表基础类
 * 提供通用的平台注册逻辑
 */
class GenericPlatformRegistry<T extends { platform: string }> {
  private platforms: Map<string, T> = new Map();

  get(platform: string): T | undefined {
    return this.platforms.get(platform);
  }

  register(platform: T): void {
    this.platforms.set(platform.platform, platform);
  }

  list(): string[] {
    return Array.from(this.platforms.keys());
  }
}

/**
 * 简单平台注册表实现
 * 基于 GenericPlatformRegistry 的类型化封装
 */
export class SimplePlatformRegistry implements PlatformRegistry {
  private registry: GenericPlatformRegistry<ASRPlatform>;

  constructor() {
    this.registry = new GenericPlatformRegistry<ASRPlatform>();
  }

  get(platform: string): ASRPlatform | undefined {
    return this.registry.get(platform);
  }

  register(platform: ASRPlatform): void {
    this.registry.register(platform);
  }

  list(): string[] {
    return this.registry.list();
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

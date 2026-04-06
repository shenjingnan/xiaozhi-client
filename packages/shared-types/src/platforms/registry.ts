/**
 * 平台注册表实现
 */

import type { PlatformRegistry } from "./types.js";

/**
 * 简单平台注册表实现
 * 提供基于 Map 的平台注册和查找功能
 */
export class SimplePlatformRegistry<T extends { platform: string }>
  implements PlatformRegistry<T>
{
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
/**
 * 平台注册表实现
 */

import type { PlatformRegistry } from "./types.js";

/**
 * 简单平台注册表实现
 * @template TPlatform - 平台类型
 */
export class SimplePlatformRegistry<TPlatform extends { readonly platform: string }>
  implements PlatformRegistry<TPlatform>
{
  private platforms: Map<string, TPlatform> = new Map();

  get(platform: string): TPlatform | undefined {
    return this.platforms.get(platform);
  }

  register(platform: TPlatform): void {
    this.platforms.set(platform.platform, platform);
  }

  list(): string[] {
    return Array.from(this.platforms.keys());
  }
}

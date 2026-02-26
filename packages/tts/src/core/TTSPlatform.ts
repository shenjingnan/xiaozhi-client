/**
 * TTS 平台抽象接口
 */

import {
  type PlatformConfig,
  SimplePlatformRegistry,
  type PlatformRegistry,
} from "@xiaozhi-client/platform-registry";
import type { TTSController, TTSPlatform } from "./types.js";

/**
 * 创建 TTS 平台实例
 */
export type TTSPlatformFactory = (config: PlatformConfig) => TTSPlatform;

/**
 * TTS 平台注册表类型
 */
export type TTSPlatformRegistry = PlatformRegistry<TTSPlatform>;

/**
 * 简单平台注册表实现（TTS 特化）
 */
export class SimplePlatformRegistryImpl
  extends SimplePlatformRegistry<TTSPlatform>
  implements TTSPlatformRegistry
{}

/**
 * 全局平台注册表
 */
export const platformRegistry = new SimplePlatformRegistryImpl();

/**
 * 注册平台装饰器
 * 用于自动注册平台实现
 */
export function registerPlatform(platform: TTSPlatform): ClassDecorator {
  return () => {
    platformRegistry.register(platform);
  };
}

export type { TTSController, TTSPlatform };

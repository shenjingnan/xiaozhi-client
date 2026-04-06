/**
 * TTS 平台抽象接口
 */

import { SimplePlatformRegistry } from "@xiaozhi-client/shared-types";
import type {
  PlatformConfig,
  TTSController,
  TTSPlatform,
} from "./types.js";

/**
 * 创建 TTS 平台实例
 */
export type TTSPlatformFactory = (config: PlatformConfig) => TTSPlatform;

/**
 * 简单平台注册表实现
 * 使用共享的 SimplePlatformRegistry 类型
 */
export class SimpleTTSPlatformRegistry extends SimplePlatformRegistry<TTSPlatform> {}

/**
 * 全局平台注册表
 */
export const platformRegistry = new SimpleTTSPlatformRegistry();

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

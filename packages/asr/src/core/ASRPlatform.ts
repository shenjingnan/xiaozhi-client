/**
 * ASR 平台抽象接口
 */

import {
  type PlatformConfig,
  SimplePlatformRegistry,
  type PlatformRegistry,
} from "@xiaozhi-client/platform-registry";
import type { ASRController, ASRPlatform } from "./types.js";

/**
 * 创建 ASR 平台实例
 */
export type ASRPlatformFactory = (config: PlatformConfig) => ASRPlatform;

/**
 * ASR 平台注册表类型
 */
export type ASRPlatformRegistry = PlatformRegistry<ASRPlatform>;

/**
 * 简单平台注册表实现（ASR 特化）
 */
export class SimplePlatformRegistryImpl
  extends SimplePlatformRegistry<ASRPlatform>
  implements ASRPlatformRegistry
{}

/**
 * 全局平台注册表
 */
export const platformRegistry = new SimplePlatformRegistryImpl();

/**
 * 注册平台装饰器
 * 用于自动注册平台实现
 */
export function registerPlatform(platform: ASRPlatform): ClassDecorator {
  return () => {
    platformRegistry.register(platform);
  };
}

export type { ASRPlatform, ASRController };

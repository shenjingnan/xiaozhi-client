/**
 * ASR 平台抽象接口
 */

import { SimplePlatformRegistry } from "@xiaozhi-client/shared-types";
import type {
  ASRController,
  ASRPlatform,
  PlatformConfig,
} from "./types.js";

/**
 * 创建 ASR 平台实例
 */
export type ASRPlatformFactory = (config: PlatformConfig) => ASRPlatform;

/**
 * 简单平台注册表实现
 * 使用共享的 SimplePlatformRegistry 类型
 */
export class SimpleASRPlatformRegistry extends SimplePlatformRegistry<ASRPlatform> {}

/**
 * 全局平台注册表
 */
export const platformRegistry = new SimpleASRPlatformRegistry();

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

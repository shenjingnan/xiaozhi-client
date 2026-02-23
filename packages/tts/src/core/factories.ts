/**
 * TTS 工厂函数
 */

import { platformRegistry } from "./TTSPlatform.js";
import type { PlatformConfig, TTSController, TTSPlatform } from "./types.js";

/**
 * TTS 控制器工厂函数
 * @param platform - 平台名称
 * @param config - 平台配置
 * @returns TTS 控制器实例
 */
export function createTTSController(
  platform: string,
  config: Record<string, unknown>
): TTSController {
  const platformImpl = platformRegistry.get(platform);
  if (!platformImpl) {
    throw new Error(
      `不支持的平台: ${platform}，可用平台: ${platformRegistry.list().join(", ")}`
    );
  }

  // 确保配置包含 platform 属性
  const configWithPlatform: PlatformConfig = {
    ...config,
    platform,
  };

  const validatedConfig = platformImpl.validateConfig(configWithPlatform);
  return platformImpl.createController(validatedConfig);
}

/**
 * 获取平台实例
 * @param platform - 平台名称
 * @returns TTS 平台实例
 */
export function getTTSPlatform(platform: string): TTSPlatform | undefined {
  return platformRegistry.get(platform);
}

/**
 * 列出所有已注册的平台
 * @returns 平台名称列表
 */
export function listTTSPlatforms(): string[] {
  return platformRegistry.list();
}

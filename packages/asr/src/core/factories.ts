/**
 * 平台工厂函数
 */

import type { ASRPlatform, PlatformConfig } from "./types.js";

/**
 * 获取指定平台的实例
 * @param platform - 平台名称
 * @param config - 平台配置
 * @returns 平台实例
 */
export async function getPlatform(
  platform: string,
  config: PlatformConfig
): Promise<ASRPlatform> {
  // 动态导入平台实现
  switch (platform) {
    case "bytedance": {
      const { ByteDancePlatform } = await import(
        "../platforms/bytedance/index.js"
      );
      return new ByteDancePlatform(config);
    }
    default:
      throw new Error(`不支持的平台: ${platform}`);
  }
}

/**
 * 获取所有已注册的平台列表
 */
export function listPlatforms(): string[] {
  return ["bytedance"];
}

/**
 * 平台配置管理器
 *
 * 负责各平台配置的管理：
 * - 平台配置的获取和更新
 * - 扣子平台配置管理
 */

import type {
  PlatformsConfig,
  PlatformConfig,
  CozePlatformConfig,
} from "../types.js";
import { ConfigStore } from "./ConfigStore.js";

/**
 * 平台配置管理器
 */
export class PlatformConfigManager {
  constructor(private readonly store: ConfigStore) {}

  /**
   * 获取所有平台配置
   */
  public getPlatformsConfig(): Readonly<PlatformsConfig> {
    const config = this.store.getConfig();
    return config.platforms || {};
  }

  /**
   * 获取指定平台配置
   */
  public getPlatformConfig(platformName: string): PlatformConfig | null {
    const platformsConfig = this.getPlatformsConfig();
    const platformConfig = platformsConfig[platformName];

    if (!platformConfig) {
      return null;
    }

    return platformConfig;
  }

  /**
   * 更新平台配置
   */
  public updatePlatformConfig(
    platformName: string,
    platformConfig: PlatformConfig
  ): void {
    const config = this.getMutableConfig();

    if (!config.platforms) {
      config.platforms = {};
    }

    config.platforms[platformName] = platformConfig;
    this.store.saveConfig(config);

    this.emitConfigUpdate({
      type: "platform",
      platformName,
      timestamp: new Date(),
    });
  }

  /**
   * 获取扣子平台配置
   */
  public getCozePlatformConfig(): CozePlatformConfig | null {
    const config = this.store.getConfig();
    const cozeConfig = config.platforms?.coze;

    if (!cozeConfig || !cozeConfig.token) {
      return null;
    }

    return {
      token: cozeConfig.token,
    };
  }

  /**
   * 获取扣子 API Token
   */
  public getCozeToken(): string | null {
    const cozeConfig = this.getCozePlatformConfig();
    return cozeConfig?.token || null;
  }

  /**
   * 检查扣子平台配置是否有效
   */
  public isCozeConfigValid(): boolean {
    const cozeConfig = this.getCozePlatformConfig();
    return (
      cozeConfig !== null &&
      typeof cozeConfig.token === "string" &&
      cozeConfig.token.trim() !== ""
    );
  }

  /**
   * 设置扣子平台配置
   */
  public setCozePlatformConfig(config: CozePlatformConfig): void {
    if (
      !config.token ||
      typeof config.token !== "string" ||
      config.token.trim() === ""
    ) {
      throw new Error("扣子 API Token 不能为空");
    }

    this.updatePlatformConfig("coze", {
      token: config.token.trim(),
    });
  }

  private getMutableConfig(): any {
    return (this.store as any).getMutableConfig();
  }

  private emitConfigUpdate(data: { type: string; platformName?: string; timestamp: Date }): void {
    (this.store as any).emitEvent("config:updated", data);
  }
}

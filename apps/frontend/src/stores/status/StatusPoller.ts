/**
 * 状态轮询管理器
 *
 * 负责定时轮询状态的逻辑
 */

import type { FullStatus, PollingConfig } from "./types";

/**
 * 轮询定时器引用
 */
let pollingTimer: NodeJS.Timeout | null = null;

/**
 * 轮询管理器配置
 */
interface PollerConfig {
  /** 获取状态的函数 */
  refreshStatus: () => Promise<FullStatus>;
  /** 更新轮询配置的函数 */
  updateConfig: (config: Partial<PollingConfig>) => void;
  /** 获取当前轮询配置的函数 */
  getConfig: () => PollingConfig;
}

/**
 * 状态轮询管理器
 *
 * 负责管理状态轮询的生命周期
 */
export class StatusPoller {
  private config: PollerConfig;

  constructor(config: PollerConfig) {
    this.config = config;
  }

  /**
   * 启动状态轮询
   */
  startPolling(interval = 30000): void {
    const currentConfig = this.config.getConfig();

    if (currentConfig.enabled) {
      console.log("[StatusPoller] 轮询已启用，跳过启动");
      return;
    }

    console.log(`[StatusPoller] 启动状态轮询，间隔: ${interval}ms`);

    // 更新轮询配置
    this.config.updateConfig({
      enabled: true,
      interval,
      currentRetries: 0,
    });

    // 立即执行一次刷新
    this.config.refreshStatus().catch((error) => {
      console.error("[StatusPoller] 轮询初始刷新失败:", error);
    });

    // 设置定时器
    pollingTimer = setInterval(() => {
      const config = this.config.getConfig();
      if (!config.enabled) {
        return;
      }

      this.config.refreshStatus().catch((error) => {
        console.error("[StatusPoller] 轮询刷新失败:", error);
      });
    }, interval);
  }

  /**
   * 停止状态轮询
   */
  stopPolling(): void {
    console.log("[StatusPoller] 停止状态轮询");

    this.config.updateConfig({
      enabled: false,
      currentRetries: 0,
    });

    if (pollingTimer) {
      clearInterval(pollingTimer);
      pollingTimer = null;
    }
  }

  /**
   * 更新轮询配置
   */
  setPollingConfig(config: Partial<PollingConfig>): void {
    this.config.updateConfig(config);
  }

  /**
   * 清理资源
   */
  dispose(): void {
    this.stopPolling();
  }
}

/**
 * 创建状态轮询管理器工厂函数
 */
export function createStatusPoller(config: PollerConfig): StatusPoller {
  return new StatusPoller(config);
}

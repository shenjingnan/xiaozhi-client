/**
 * 重启状态管理器
 *
 * 负责管理服务重启的状态跟踪和轮询检查
 */

import type {
  FullStatus,
  RestartPollingConfig,
  RestartStatus,
  StatusSource,
} from "./types";

/**
 * 重启轮询定时器引用
 */
let restartPollingTimer: NodeJS.Timeout | null = null;

/**
 * 重启管理器配置
 */
interface RestartManagerConfig {
  /** 刷新状态的函数 */
  refreshStatus: () => Promise<FullStatus>;
  /** 设置重启状态的函数 */
  setRestartStatus: (status: RestartStatus, source?: StatusSource) => void;
  /** 更新重启轮询配置的函数 */
  updateConfig: (config: Partial<RestartPollingConfig>) => void;
  /** 获取当前重启轮询配置的函数 */
  getConfig: () => RestartPollingConfig;
  /** 设置加载状态的函数 */
  setLoading: (loading: { isRestarting: boolean }) => void;
}

/**
 * 重启状态管理器
 *
 * 负责管理服务重启的状态跟踪和重连检查
 */
export class RestartManager {
  private config: RestartManagerConfig;

  constructor(config: RestartManagerConfig) {
    this.config = config;
  }

  /**
   * 启动重启后重连检查轮询
   */
  startRestartPolling(): void {
    const currentConfig = this.config.getConfig();

    if (currentConfig.enabled) {
      console.log("[RestartManager] 重启轮询已启用，跳过启动");
      return;
    }

    console.log("[RestartManager] 启动重启后重连检查轮询");

    const startTime = Date.now();
    this.config.updateConfig({
      enabled: true,
      currentAttempts: 0,
      startTime,
    });

    // 设置定时器进行重连检查
    restartPollingTimer = setInterval(async () => {
      const config = this.config.getConfig();

      if (!config.enabled) {
        return;
      }

      const elapsed = Date.now() - (config.startTime || 0);
      const attempts = config.currentAttempts + 1;

      console.log(
        `[RestartManager] 重启重连检查 (第 ${attempts} 次，已用时 ${Math.round(elapsed / 1000)}s)`
      );

      try {
        // 尝试获取状态以检查服务是否重连成功
        const status = await this.config.refreshStatus();

        // 检查是否重连成功
        const isReconnected = status.client?.status === "connected";

        if (isReconnected) {
          console.log("[RestartManager] 服务重连成功，停止重启轮询");

          // 设置重启完成状态
          this.config.setRestartStatus(
            {
              status: "completed",
              timestamp: Date.now(),
            },
            "polling"
          );

          // 停止重启轮询和loading状态
          this.stopRestartPolling();
          this.config.setLoading({ isRestarting: false });
          return;
        }

        // 更新尝试次数
        this.config.updateConfig({ currentAttempts: attempts });

        // 检查是否超时或达到最大尝试次数
        if (elapsed >= config.timeout || attempts >= config.maxAttempts) {
          console.warn("[RestartManager] 重启重连检查超时或达到最大尝试次数");
          this.handleRestartTimeout();
        }
      } catch (error) {
        console.log(
          `[RestartManager] 重启重连检查失败 (第 ${attempts} 次):`,
          error
        );

        // 更新尝试次数
        this.config.updateConfig({ currentAttempts: attempts });

        // 检查是否超时或达到最大尝试次数
        const config = this.config.getConfig();
        if (elapsed >= config.timeout || attempts >= config.maxAttempts) {
          console.error("[RestartManager] 重启重连检查超时或达到最大尝试次数");
          this.handleRestartTimeout();
        }
      }
    }, currentConfig.interval);
  }

  /**
   * 处理重启超时
   */
  private handleRestartTimeout(): void {
    // 设置重启失败状态
    this.config.setRestartStatus(
      {
        status: "failed",
        error: "重连超时，服务可能未成功重启",
        timestamp: Date.now(),
      },
      "polling"
    );

    // 停止重启轮询和loading状态
    this.stopRestartPolling();
    this.config.setLoading({ isRestarting: false });
  }

  /**
   * 停止重启轮询
   */
  stopRestartPolling(): void {
    console.log("[RestartManager] 停止重启轮询");

    this.config.updateConfig({
      enabled: false,
      currentAttempts: 0,
      startTime: null,
    });

    if (restartPollingTimer) {
      clearInterval(restartPollingTimer);
      restartPollingTimer = null;
    }
  }

  /**
   * 更新重启轮询配置
   */
  setRestartPollingConfig(config: Partial<RestartPollingConfig>): void {
    this.config.updateConfig(config);
  }

  /**
   * 清理资源
   */
  dispose(): void {
    this.stopRestartPolling();
  }
}

/**
 * 创建重启管理器工厂函数
 */
export function createRestartManager(
  config: RestartManagerConfig
): RestartManager {
  return new RestartManager(config);
}

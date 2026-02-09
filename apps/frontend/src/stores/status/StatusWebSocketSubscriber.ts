/**
 * 状态 WebSocket 订阅器
 *
 * 负责 WebSocket 事件监听和实时状态更新
 */

import { webSocketManager } from "@services/websocket";
import type { ClientStatus } from "@xiaozhi-client/shared-types";
import type { RestartStatus } from "./types";

/**
 * WebSocket 订阅器配置
 */
interface WebSocketSubscriberConfig {
  /** 设置客户端状态的回调 */
  onClientStatusUpdate: (status: ClientStatus) => void;
  /** 设置重启状态的回调 */
  onRestartStatusUpdate: (status: RestartStatus) => void;
}

/**
 * 状态 WebSocket 订阅器
 *
 * 管理 WebSocket 事件订阅，将实时更新传递给状态 Store
 */
export class StatusWebSocketSubscriber {
  private config: WebSocketSubscriberConfig;
  private unsubscribes: Array<() => void> = [];

  constructor(config: WebSocketSubscriberConfig) {
    this.config = config;
  }

  /**
   * 初始化 WebSocket 订阅
   */
  initialize(): void {
    console.log("[StatusWebSocketSubscriber] 初始化 WebSocket 订阅");

    // 订阅状态更新
    const statusUnsubscribe = webSocketManager.subscribe(
      "data:statusUpdate",
      (status) => {
        console.log("[StatusWebSocketSubscriber] 收到 WebSocket 状态更新");
        this.config.onClientStatusUpdate(status);
      }
    );
    this.unsubscribes.push(statusUnsubscribe);

    // 订阅重启状态更新
    const restartUnsubscribe = webSocketManager.subscribe(
      "data:restartStatus",
      (status) => {
        console.log("[StatusWebSocketSubscriber] 收到 WebSocket 重启状态更新");
        this.config.onRestartStatusUpdate(status);
      }
    );
    this.unsubscribes.push(restartUnsubscribe);
  }

  /**
   * 清理订阅
   */
  dispose(): void {
    console.log("[StatusWebSocketSubscriber] 清理 WebSocket 订阅");
    for (const unsubscribe of this.unsubscribes) {
      unsubscribe();
    }
    this.unsubscribes = [];
  }
}

/**
 * 创建状态 WebSocket 订阅器工厂函数
 */
export function createStatusWebSocketSubscriber(
  config: WebSocketSubscriberConfig
): StatusWebSocketSubscriber {
  return new StatusWebSocketSubscriber(config);
}

/**
 * WebSocket 辅助工具模块
 *
 * 提供 WebSocket 相关的工具函数和类型定义：
 * - WebSocketLike: WebSocket 接口定义
 * - sendWebSocketError: 向 WebSocket 客户端发送错误消息
 *
 * @module websocket-helper
 */

import type { Logger } from "@/Logger.js";

/**
 * WebSocket 接口
 * 描述具有 send 方法的 WebSocket 对象
 */
export interface WebSocketLike {
  send(data: string): void;
}

/**
 * 向 WebSocket 客户端发送错误消息
 *
 * @param ws - WebSocket 客户端连接对象
 * @param code - 错误代码
 * @param message - 错误消息
 * @param logger - 日志记录器
 */
export function sendWebSocketError(
  ws: WebSocketLike,
  code: string,
  message: string,
  logger: Logger
): void {
  try {
    const errorResponse = {
      type: "error",
      error: {
        code,
        message,
        timestamp: Date.now(),
      },
    };
    ws.send(JSON.stringify(errorResponse));
  } catch (error) {
    logger.error("发送错误消息失败:", error);
  }
}

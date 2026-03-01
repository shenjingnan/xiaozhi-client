/**
 * 连接状态验证工具函数
 */

/**
 * 连接状态类型（兼容各种枚举实现）
 */
export type ConnectionStateValue = string;

/**
 * 连接状态常量
 */
export const ConnectionStateValues = {
  DISCONNECTED: "disconnected",
  CONNECTING: "connecting",
  CONNECTED: "connected",
  RECONNECTING: "reconnecting",
  FAILED: "failed",
  ERROR: "error",
} as const;

/**
 * 验证连接状态，如果正在连接中则抛出错误
 *
 * @param currentState - 当前连接状态
 * @throws {Error} 如果状态为 CONNECTING 或 RECONNECTING
 *
 * @example
 * ```typescript
 * validateConnectionState(this.connectionState);
 * ```
 */
export function validateConnectionState(
  currentState: ConnectionStateValue
): void {
  // 如果正在连接中或重连中，抛出错误
  if (
    currentState === ConnectionStateValues.CONNECTING ||
    currentState === ConnectionStateValues.RECONNECTING
  ) {
    throw new Error("连接正在进行中，请等待连接完成");
  }
}

/**
 * 工具函数模块
 *
 * 内联的必要工具函数，确保包的独立性
 */

import type { ValidatedToolCallParams } from "./types.js";

/**
 * 截断端点 URL 用于日志显示
 *
 * @param endpoint - 完整的端点 URL
 * @returns 截断后的 URL
 *
 * @example
 * ```typescript
 * sliceEndpoint("ws://very-long-endpoint-url-here.example.com/endpoint")
 * // 返回: "ws://very-long-endpoint-u...e.com/endpoint"
 * ```
 */
export function sliceEndpoint(endpoint: string): string {
  return `${endpoint.slice(0, 30)}...${endpoint.slice(-10)}`;
}

/**
 * 验证工具调用参数
 *
 * @param params - 待验证的参数
 * @returns 验证后的参数
 * @throws {Error} 如果参数无效
 *
 * @example
 * ```typescript
 * const params = validateToolCallParams({
 *   name: "test_tool",
 *   arguments: { foo: "bar" }
 * });
 * ```
 */
export function validateToolCallParams(
  params: unknown
): ValidatedToolCallParams {
  // 基础类型检查
  if (!params || typeof params !== "object") {
    throw new Error("工具调用参数必须是对象");
  }

  const p = params as Record<string, unknown>;

  // 验证工具名称
  if (!p.name || typeof p.name !== "string") {
    throw new Error("工具名称必须是字符串");
  }

  // 构建验证后的参数
  const validated: ValidatedToolCallParams = {
    name: p.name,
  };

  // 验证参数（可选）
  if (p.arguments !== undefined) {
    if (typeof p.arguments !== "object" || p.arguments === null) {
      throw new Error("工具参数必须是对象");
    }
    validated.arguments = p.arguments as Record<string, unknown>;
  }

  return validated;
}

/**
 * 验证端点 URL 格式
 *
 * @param endpoint - 待验证的端点 URL
 * @returns 是否为有效的 WebSocket URL
 */
export function isValidEndpointUrl(endpoint: string): boolean {
  if (!endpoint || typeof endpoint !== "string") {
    return false;
  }

  if (!endpoint.startsWith("ws://") && !endpoint.startsWith("wss://")) {
    return false;
  }

  try {
    new URL(endpoint);
    return true;
  } catch {
    return false;
  }
}

/**
 * 深度合并对象
 *
 * @param target - 目标对象
 * @param sources - 源对象
 * @returns 合并后的对象
 */
export function deepMerge<T>(
  target: Partial<T>,
  ...sources: Array<Partial<T>>
): T {
  if (sources.length === 0) {
    return target as T;
  }

  const source = sources.shift();

  if (source === undefined) {
    return target as T;
  }

  for (const key in source) {
    if (
      typeof source[key] === "object" &&
      source[key] !== null &&
      !Array.isArray(source[key]) &&
      typeof target[key] === "object" &&
      target[key] !== null &&
      !Array.isArray(target[key])
    ) {
      (target as Record<string, unknown>)[key] = deepMerge(
        target[key] as Record<string, unknown>,
        source[key] as Record<string, unknown>
      );
    } else {
      (target as Record<string, unknown>)[key] = source[key];
    }
  }

  return deepMerge(target, ...sources);
}

/**
 * 延迟执行
 *
 * @param ms - 延迟时间（毫秒）
 * @returns Promise
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * 格式化错误消息
 *
 * @param error - 错误对象
 * @returns 格式化后的错误消息
 */
export function formatErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === "string") {
    return error;
  }

  return String(error);
}

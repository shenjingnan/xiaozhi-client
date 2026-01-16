/**
 * 工具函数模块
 *
 * 内联的必要工具函数，确保包的独立性
 */

import type {
  ParsedEndpointInfo,
  ValidatedToolCallParams,
  XiaozhiTokenPayload,
} from "./types.js";

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
 * 检查属性名是否安全，防止原型污染攻击
 *
 * @param key - 待检查的属性名
 * @returns 是否为安全的属性名
 *
 * @example
 * ```typescript
 * isSafeKey("name") // true
 * isSafeKey("__proto__") // false
 * isSafeKey("constructor") // false
 * ```
 */
function isSafeKey(key: string): boolean {
  // 拒绝已知的危险属性名
  const dangerousKeys = ["__proto__", "constructor", "prototype"];
  if (dangerousKeys.includes(key)) {
    return false;
  }

  // 确保属性名是普通的字符串（不是 Symbol 等）
  return typeof key === "string" && key.length > 0;
}

/**
 * 深度合并对象
 *
 * @param target - 目标对象
 * @param sources - 源对象
 * @returns 合并后的对象
 *
 * @example
 * ```typescript
 * const result = deepMerge(
 *   { a: 1, b: { x: 1 } },
 *   { b: { y: 2 }, c: 3 }
 * );
 * // 返回: { a: 1, b: { x: 1, y: 2 }, c: 3 }
 * ```
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

  // 使用 Object.keys() 替代 for...in，只遍历对象自身的可枚举属性
  const keys = Object.keys(source as Record<string, unknown>);

  for (const key of keys) {
    // 跳过不安全的 key，防止原型污染攻击
    if (!isSafeKey(key)) {
      continue;
    }

    const sourceValue = (source as Record<string, unknown>)[key];
    const targetValue = (target as Record<string, unknown>)[key];

    if (
      typeof sourceValue === "object" &&
      sourceValue !== null &&
      !Array.isArray(sourceValue) &&
      typeof targetValue === "object" &&
      targetValue !== null &&
      !Array.isArray(targetValue)
    ) {
      (target as Record<string, unknown>)[key] = deepMerge(
        targetValue as Record<string, unknown>,
        sourceValue as Record<string, unknown>
      );
    } else {
      (target as Record<string, unknown>)[key] = sourceValue;
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

// =========================
// JWT Token 解码相关函数
// =========================

/**
 * Base64URL 解码
 *
 * @param input - Base64URL 编码的字符串
 * @returns 解码后的字符串
 *
 * @example
 * ```typescript
 * base64UrlDecode("SGVsbG8gV29ybGQ") // 返回: "Hello World"
 * ```
 */
function base64UrlDecode(input: string): string {
  // 将 Base64URL 格式转换为标准 Base64 格式
  let base64 = input.replace(/-/g, "+").replace(/_/g, "/");

  // 补全 padding
  while (base64.length % 4) {
    base64 += "=";
  }

  // 使用 Node.js Buffer 进行解码
  return Buffer.from(base64, "base64").toString("utf-8");
}

/**
 * 解码 JWT Token（仅解析 payload，不验证签名）
 *
 * @param token - JWT Token 字符串
 * @returns 解码后的 Token Payload，解码失败返回 null
 *
 * @example
 * ```typescript
 * const payload = decodeJWTToken("eyJ...token...");
 * if (payload) {
 *   console.log(payload.endpointId); // "agent_1324149"
 * }
 * ```
 */
export function decodeJWTToken(token: string): XiaozhiTokenPayload | null {
  if (!token || typeof token !== "string") {
    return null;
  }

  try {
    // JWT 格式: header.payload.signature
    const parts = token.split(".");
    if (parts.length !== 3) {
      return null;
    }

    // 解码 payload 部分（第二部分）
    const payloadStr = base64UrlDecode(parts[1]);
    const payload = JSON.parse(payloadStr) as unknown;

    // 验证 payload 结构
    if (
      typeof payload !== "object" ||
      payload === null ||
      !("userId" in payload) ||
      !("agentId" in payload) ||
      !("endpointId" in payload) ||
      !("purpose" in payload) ||
      !("iat" in payload) ||
      !("exp" in payload)
    ) {
      return null;
    }

    return payload as XiaozhiTokenPayload;
  } catch {
    return null;
  }
}

/**
 * 从 endpoint URL 中提取 token 参数
 *
 * @param url - 完整的 endpoint URL
 * @returns 提取的 token 字符串，未找到返回 null
 *
 * @example
 * ```typescript
 * const token = extractTokenFromUrl(
 *   "wss://api.xiaozhi.me/mcp/?token=eyJ..."
 * );
 * ```
 */
export function extractTokenFromUrl(url: string): string | null {
  if (!url || typeof url !== "string") {
    return null;
  }

  try {
    const urlObj = new URL(url);
    return urlObj.searchParams.get("token");
  } catch {
    return null;
  }
}

/**
 * 解析 endpoint URL 获取完整信息
 *
 * @param url - 完整的 endpoint URL
 * @returns 解析后的 endpoint 信息，解析失败返回 null
 *
 * @example
 * ```typescript
 * const info = parseEndpointUrl(
 *   "wss://api.xiaozhi.me/mcp/?token=eyJ..."
 * );
 * if (info) {
 *   console.log(info.payload.endpointId); // "agent_1324149"
 *   console.log(info.wsUrl); // "wss://api.xiaozhi.me/mcp/"
 * }
 * ```
 */
export function parseEndpointUrl(url: string): ParsedEndpointInfo | null {
  if (!url || typeof url !== "string") {
    return null;
  }

  try {
    // 提取 token
    const token = extractTokenFromUrl(url);
    if (!token) {
      return null;
    }

    // 解码 token
    const payload = decodeJWTToken(token);
    if (!payload) {
      return null;
    }

    // 移除 token 参数得到纯净的 WebSocket URL
    const urlObj = new URL(url);
    urlObj.searchParams.delete("token");
    const wsUrl = urlObj.toString();

    return {
      url,
      token,
      payload,
      wsUrl,
    };
  } catch {
    return null;
  }
}

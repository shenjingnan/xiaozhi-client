/**
 * UUID 工具函数
 */

import { v4 as uuidv4 } from "uuid";

/**
 * 生成唯一的请求 ID
 */
export function generateReqId(): string {
  return uuidv4();
}

/**
 * 生成短唯一 ID（8 字符）
 */
export function generateShortId(): string {
  return uuidv4().split("-")[0];
}

/**
 * 格式化工具函数
 */

import type { ToolCallRecord } from "@xiaozhi/shared-types";

/**
 * 格式化时间戳为本地化字符串
 * @param timestamp 时间戳（毫秒）
 * @returns 格式化后的时间字符串
 */
export const formatTimestamp = (timestamp?: number): string => {
  if (!timestamp) return "未知时间";
  return new Date(timestamp).toLocaleString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
};

/**
 * 格式化持续时间为易读字符串
 * @param duration 持续时间（毫秒）
 * @returns 格式化后的持续时间字符串
 */
export const formatDuration = (duration?: number): string => {
  if (!duration) return "-";
  if (duration < 1000) return `${duration}ms`;
  return `${(duration / 1000).toFixed(1)}s`;
};

/**
 * 生成稳定的React键值
 * @param log 工具调用记录
 * @param index 索引
 * @returns 稳定的键值
 */
export const generateStableKey = (
  log: ToolCallRecord,
  index: number
): string => {
  // 使用工具名、时间戳和索引组合生成稳定的键
  // 如果时间戳不存在，使用索引作为后备
  const timestamp = log.timestamp || Date.now();
  return `${log.toolName}-${timestamp}-${index}`;
};

/**
 * 格式化JSON数据为可读字符串
 * @param data 要格式化的数据
 * @returns 格式化后的JSON字符串
 */
export const formatJson = (data: any): string | null => {
  if (!data) return null;
  try {
    return JSON.stringify(data, null, 2);
  } catch (error) {
    return String(data);
  }
};

/**
 * 重新抛出错误的工具函数
 * @param error 错误对象
 * @returns 错误字符串
 */
export const formatError = (error: any): string => {
  if (typeof error === "string") return error;
  if (error instanceof Error) return error.message;
  return String(error);
};

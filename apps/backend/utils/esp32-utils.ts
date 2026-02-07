/**
 * ESP32 设备信息提取工具
 * 提供设备型号、固件版本等信息的提取功能
 */

import { logger } from "@/Logger.js";
import type { ESP32DeviceReport } from "@/types/esp32.js";

/**
 * 从请求头获取的设备信息
 */
export interface DeviceInfoFromHeaders {
  deviceModel?: string;
  deviceVersion?: string;
}

/**
 * 提取的设备信息
 */
export interface ExtractedDeviceInfo {
  boardType: string;
  appVersion: string;
}

/**
 * 从请求头和设备上报信息中提取设备型号和固件版本
 * 支持多级回退机制：
 * 1. 优先从请求头获取
 * 2. 尝试新格式：board.type
 * 3. 兼容旧格式：application.board.type
 */
export function extractDeviceInfo(
  report: ESP32DeviceReport,
  headerInfo?: DeviceInfoFromHeaders
): ExtractedDeviceInfo {
  const boardType = extractBoardType(report, headerInfo);
  const appVersion = extractAppVersion(report, headerInfo);
  return { boardType, appVersion };
}

/**
 * 提取设备型号
 * 多级回退机制：
 * 1. 优先从请求头获取
 * 2. 尝试新格式：board.type
 * 3. 兼容旧格式：application.board.type
 */
function extractBoardType(
  report: ESP32DeviceReport,
  headerInfo?: DeviceInfoFromHeaders
): string {
  // 1. 优先从请求头获取
  let boardType = headerInfo?.deviceModel;

  // 2. 尝试新格式：board.type
  if (!boardType) {
    boardType = report.board?.type;
  }

  // 3. 兼容旧格式：application.board.type
  if (!boardType) {
    const oldFormat = (
      report.application as unknown as { board?: { type: string } }
    ).board;
    if (oldFormat?.type) {
      logger.debug(
        `使用旧格式数据结构: application.board.type=${oldFormat.type}`
      );
      boardType = oldFormat.type;
    }
  }

  if (!boardType) {
    throw new Error(
      "无法获取设备型号，请确保请求头包含 device-model 或请求体包含 board.type",
      { cause: "MISSING_DEVICE_MODEL" }
    );
  }

  return boardType;
}

/**
 * 提取固件版本
 * 多级回退机制：
 * 1. 优先从请求头获取
 * 2. 从 application.version 获取
 */
function extractAppVersion(
  report: ESP32DeviceReport,
  headerInfo?: DeviceInfoFromHeaders
): string {
  // 1. 优先从请求头获取
  let appVersion = headerInfo?.deviceVersion;

  // 2. 从 application.version 获取
  if (!appVersion) {
    appVersion = report.application?.version;
  }

  if (!appVersion) {
    throw new Error("无法获取固件版本，请确保请求体包含 application.version", {
      cause: "MISSING_APP_VERSION",
    });
  }

  return appVersion;
}

/**
 * 递归将对象的键从驼峰命名转换为下划线命名
 * @param obj - 要转换的对象
 * @returns 转换后的对象
 */
export function camelToSnakeCase(obj: unknown): unknown {
  // 处理 null 和 undefined
  if (obj === null || obj === undefined) {
    return obj;
  }

  // 处理基本类型
  if (typeof obj !== "object") {
    return obj;
  }

  // 处理数组
  if (Array.isArray(obj)) {
    return obj.map(camelToSnakeCase);
  }

  // 处理普通对象
  const result: Record<string, unknown> = {};
  for (const key of Object.keys(obj)) {
    const snakeKey = key.replace(/([A-Z])/g, "_$1").toLowerCase();
    result[snakeKey] = camelToSnakeCase((obj as Record<string, unknown>)[key]);
  }
  return result;
}

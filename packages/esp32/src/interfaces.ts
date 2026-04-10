/**
 * ESP32 SDK 核心接口定义
 * 定义日志、配置提供者、设备连接等抽象接口，实现解耦
 */

import type {
  ASRConfig,
  LLMConfig,
  TTSConfig,
} from "@xiaozhi-client/shared-types";
import type { ESP32WSMessage } from "./types.js";

/**
 * 日志接口
 * 最小化日志抽象，支持注入任意日志实现
 */
export interface ILogger {
  debug(message: string, ...args: unknown[]): void;
  info(message: string, ...args: unknown[]): void;
  warn(message: string, ...args: unknown[]): void;
  error(message: string, ...args: unknown[]): void;
}

/**
 * 空操作日志实现
 * 默认日志器，不输出任何内容
 */
export const noopLogger: ILogger = {
  debug() {},
  info() {},
  warn() {},
  error() {},
};

/**
 * ESP32 配置提供者接口
 * 用于解耦 ASR/LLM/TTS 服务与具体配置管理器的依赖
 */
export interface IESP32ConfigProvider {
  /** 获取 ASR 配置 */
  getASRConfig(): ASRConfig | null;
  /** 获取 TTS 配置 */
  getTTSConfig(): TTSConfig | null;
  /** 获取 LLM 配置 */
  getLLMConfig(): LLMConfig | null;
  /** 检查 LLM 配置是否有效 */
  isLLMConfigValid(): boolean;
}

/**
 * 设备连接接口
 * 用于解耦 TTS 服务与具体连接实现的依赖
 */
export interface IDeviceConnection {
  /** 发送消息到设备 */
  send(message: ESP32WSMessage): Promise<void>;
  /** 发送二进制协议2格式数据到设备 */
  sendBinaryProtocol2(data: Uint8Array, timestamp?: number): Promise<void>;
  /** 获取会话ID */
  getSessionId(): string;
}

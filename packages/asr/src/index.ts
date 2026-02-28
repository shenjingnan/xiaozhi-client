/**
 * @xiaozhi-client/asr
 *
 * ByteDance 流式 ASR WebSocket 客户端库
 *
 * 此库提供了与字节跳动 ASR 服务集成的完整功能，包括：
 * - ASR: 流式 ASR 客户端，支持实时语音识别和单次识别
 * - 平台支持: 支持字节跳动 V2、V3 API，提供可扩展的平台抽象
 * - 音频处理: 支持多种音频格式（WAV、MP3、OGG/Opus）
 * - 认证管理: 支持 Token 和签名认证方式
 * - 核心抽象: ASRClient、ASRPlatform 等核心抽象层
 * - 控制器: ByteDance V2/V3 协议控制器
 *
 * @example
 * ### 流式识别模式
 * ```typescript
 * import { ASR } from '@xiaozhi-client/asr';
 *
 * const asr = new ASR({
 *   bytedance: {
 *     v2: {
 *       app: { appid: 'your-app-id', token: 'your-token' },
 *     },
 *   },
 * });
 *
 * asr.on('result', (result) => {
 *   console.log('识别结果:', result.result?.[0]?.text);
 * });
 *
 * asr.on('vad_end', (finalText) => {
 *   console.log('最终结果:', finalText);
 * });
 *
 * await asr.connect();
 * // ... 流式发送音频帧
 * await asr.end();
 * ```
 *
 * @example
 * ### 单次识别模式
 * ```typescript
 * import { executeOne } from '@xiaozhi-client/asr';
 *
 * const result = await executeOne('path/to/audio.wav', 'your-cluster', {
 *   bytedance: {
 *     v2: {
 *       app: { appid: 'your-app-id', token: 'your-token' },
 *     },
 *   },
 * });
 * ```
 */

// =========================
// 模块导出
// =========================

// 核心抽象层
export * from "./core/index.js";

// 平台实现
export * from "./platforms/index.js";

// 音频处理模块
export * from "./audio/index.js";

// 认证模块
export * from "./auth/index.js";

// 类型定义
export * from "./types/index.js";

// 客户端模块
export * from "./client/index.js";

// 工具函数
export * from "./utils/index.js";

// =========================
// 主要导出
// =========================

export { ASR, executeOne } from "./client";

export type {
  ASROption,
  ASRResult,
  ASREventType,
  ASREventData,
} from "./client";

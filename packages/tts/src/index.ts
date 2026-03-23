/**
 * @xiaozhi-client/tts
 *
 * ByteDance 流式 TTS WebSocket 客户端库
 *
 * 此库提供了与字节跳动 TTS 服务集成的完整功能，包括：
 * - TTS: 流式 TTS 客户端，支持实时语音合成和单次合成
 * - 平台支持: 支持字节跳动 V1 API，提供可扩展的平台抽象
 * - 音频处理: 支持多种音频格式（WAV、MP3、OGG/Opus）
 * - 认证管理: 支持 Token 认证方式
 * - 核心抽象: TTSController、TTSPlatform 等核心抽象层
 *
 * @example
 * ### 流式合成模式
 * ```typescript
 * import { TTS } from '@xiaozhi-client/tts';
 *
 * const tts = new TTS({
 *   bytedance: {
 *     v1: {
 *       app: { appid: 'your-app-id', accessToken: 'your-token' },
 *       audio: { voice_type: 'S_70000', encoding: 'wav' }
 *     }
 *   }
 * });
 *
 * const stream = await tts.speak('你好，世界');
 * for await (const chunk of stream) {
 *   console.log('收到音频块:', chunk.chunk.length, '字节');
 * }
 * ```
 *
 * @example
 * ### 单次合成模式
 * ```typescript
 * import { synthesizeSpeech } from '@xiaozhi-client/tts';
 *
 * const audioBuffer = await synthesizeSpeech('你好，世界', {
 *   bytedance: {
 *     v1: {
 *       app: { appid: 'your-app-id', accessToken: 'your-token' },
 *       audio: { voice_type: 'S_70000', encoding: 'wav' }
 *     }
 *   }
 * });
 * ```
 */

// 导入平台模块以注册平台
import "./platforms/index.js";

// 核心模块
export * from "./core/index.js";

// 平台模块
export * from "./platforms/index.js";

// 客户端模块（包含便捷函数）
export { TTS, type TTSClientOptions } from "./client/index.js";
export {
  synthesizeSpeech,
  synthesizeSpeechStream,
  validateConfig,
  type SynthesizeOptions,
  type SynthesizeStreamOptions,
} from "./client/index.js";

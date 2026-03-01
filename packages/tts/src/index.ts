/**
 * @xiaozhi-client/tts 包入口
 */

// 导入平台模块以注册平台
import "./platforms/index.js";

// 客户端模块（包含便捷函数）
export {
  type SynthesizeOptions,
  type SynthesizeStreamOptions,
  synthesizeSpeech,
  synthesizeSpeechStream,
  TTS,
  type TTSClientOptions,
  validateConfig,
} from "./client/index.js";
// 核心模块
export * from "./core/index.js";
// 平台模块
export * from "./platforms/index.js";

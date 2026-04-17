/**
 * ESP32 语音服务统一导出
 */

export type {
  IASRService,
  ASRServiceEvents,
  ASRServiceOptions,
} from "./asr.interface.js";
export { ASRService } from "./asr.service.js";
export { LLMService } from "./llm.service.js";
export type {
  ITTSService,
  TTSServiceOptions,
  SendCallback,
} from "./tts.interface.js";
export { TTSService, mapClusterToResourceId } from "./tts.service.js";

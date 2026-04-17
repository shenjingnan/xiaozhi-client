/**
 * @xiaozhi-client/esp32
 * ESP32 硬件设备通信 SDK
 *
 * 提供设备连接管理 + 语音交互全流程（ASR → LLM → TTS）+ 二进制音频协议处理
 */

// 核心接口
export type {
  ILogger,
  IESP32ConfigProvider,
  IDeviceConnection,
} from "./interfaces.js";
export { noopLogger } from "./interfaces.js";

// 类型定义
export type {
  ESP32DeviceStatus,
  ESP32Device,
  ESP32DeviceReport,
  ESP32WebSocketConfig,
  ESP32MQTTConfig,
  ESP32ServerTime,
  ESP32FirmwareInfo,
  ESP32OTAResponse,
  ESP32WSMessageType,
  ESP32WSMessageBase,
  ESP32HelloMessage,
  ESP32ListenMessage,
  ESP32ServerHelloMessage,
  ESP32AudioMessage,
  ESP32STTMessage,
  ESP32TTSMessage,
  ESP32LLMMessage,
  ESP32TextMessage,
  ESP32MCPMessage,
  ESP32SystemMessage,
  ESP32AbortMessage,
  ESP32CustomMessage,
  ESP32ErrorMessage,
  ESP32ASREndMessage,
  ESP32WSMessage,
  ESP32ConnectionState,
} from "./types.js";
export { ESP32ErrorCode } from "./types.js";

// 工具函数
export {
  extractDeviceInfo,
  camelToSnakeCase,
} from "./utils.js";
export type { DeviceInfoFromHeaders, ExtractedDeviceInfo } from "./utils.js";

// 音频协议
export {
  encodeBinaryProtocol2,
  parseBinaryProtocol2,
  isBinaryProtocol2,
  parseBinaryProtocol3,
  isBinaryProtocol3,
  detectAudioProtocol,
} from "./audio-protocol.js";
export type {
  BinaryProtocol2Parsed,
  BinaryProtocol3Parsed,
  AudioProtocolType,
} from "./audio-protocol.js";

// 设备注册服务
export { DeviceRegistryService } from "./device-registry.js";

// 连接管理
export { ESP32Connection } from "./connection.js";

// 语音服务
export * from "./services/index.js";

// 核心：设备管理器
export { ESP32DeviceManager } from "./esp32-manager.js";
export type { ESP32DeviceManagerOptions } from "./esp32-manager.js";

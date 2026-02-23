/**
 * TTS 协议消息类型定义
 *
 * @deprecated 使用 @xiaozhi-client/tts 包中的协议定义代替
 * @module protocols
 *
 * @see binary.ts - TTS 二进制协议实现
 */

// 重新导出新包中的协议定义（避免破坏性变更）
// 注意：新包中移除了 logger.debug 调用
export {
  EventType,
  MsgType,
  MsgTypeServerACK,
  MsgTypeFlagBits,
  VersionBits,
  HeaderSizeBits,
  SerializationBits,
  CompressionBits,
  Message,
  getEventTypeName,
  getMsgTypeName,
  messageToString,
  createMessage,
  marshalMessage,
  unmarshalMessage,
  ReceiveMessage,
  WaitForEvent,
  FullClientRequest,
  AudioOnlyClient,
  StartConnection,
  FinishConnection,
  StartSession,
  FinishSession,
  CancelSession,
  TaskRequest,
} from "@xiaozhi-client/tts";

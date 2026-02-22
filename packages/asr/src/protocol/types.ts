/**
 * ASR 协议类型定义
 *
 * 定义字节跳动流式 ASR 服务的二进制协议相关类型，
 * 包括消息类型、序列化方法、压缩方式等核心枚举和接口。
 *
 * @module types
 */

/**
 * 消息类型枚举
 * 定义 ASR 协议中不同类型的消息
 */
export enum MessageType {
  /** 客户端完整请求（包含音频和控制信息） */
  CLIENT_FULL_REQUEST = 0b0001,
  /** 客户端纯音频请求 */
  CLIENT_AUDIO_ONLY_REQUEST = 0b0010,
  /** 服务器完整响应 */
  SERVER_FULL_RESPONSE = 0b1001,
  /** 服务器确认消息 */
  SERVER_ACK = 0b1011,
  /** 服务器错误响应 */
  SERVER_ERROR_RESPONSE = 0b1111,
}

/**
 * 消息类型特定标志枚举
 * 用于控制消息的序列号行为
 */
export enum MessageTypeSpecificFlags {
  /** 无序列号 */
  NO_SEQUENCE = 0b0000,
  /** 正向序列号 */
  POS_SEQUENCE = 0b0001,
  /** 负向序列号 */
  NEG_SEQUENCE = 0b0010,
  /** 负向序列号变体 */
  NEG_SEQUENCE_1 = 0b0011,
}

/**
 * 序列化方法枚举
 * 定义消息负载的序列化方式
 */
export enum SerializationMethod {
  /** 无序列化 */
  NO_SERIALIZATION = 0b0000,
  /** JSON 序列化 */
  JSON = 0b0001,
  /** Thrift 序列化 */
  THRIFT = 0b0011,
  /** 自定义序列化 */
  CUSTOM_TYPE = 0b1111,
}

/**
 * 压缩类型枚举
 * 定义消息负载的压缩方式
 */
export enum CompressionType {
  /** 无压缩 */
  NO_COMPRESSION = 0b0000,
  /** GZIP 压缩 */
  GZIP = 0b0001,
  /** 自定义压缩 */
  CUSTOM_COMPRESSION = 0b1111,
}

/**
 * 协议头生成选项接口
 * 用于配置生成的协议头参数
 */
export interface HeaderOptions {
  /** 协议版本号，默认为 PROTOCOL_VERSION */
  version?: number;
  /** 消息类型 */
  messageType?: MessageType;
  /** 消息类型特定标志 */
  messageTypeSpecificFlags?: MessageTypeSpecificFlags;
  /** 序列化方法 */
  serialMethod?: SerializationMethod;
  /** 压缩类型 */
  compressionType?: CompressionType;
  /** 保留数据，默认为 0x00 */
  reservedData?: number;
  /** 扩展头数据 */
  extensionHeader?: Buffer;
}

/**
 * 解析后的服务器响应接口
 * 包含协议头和负载的完整信息
 */
export interface ParsedResponse {
  /** 协议版本号 */
  protocolVersion: number;
  /** 协议头大小（以 4 字节为单位） */
  headerSize: number;
  /** 消息类型 */
  messageType: number;
  /** 消息类型特定标志 */
  messageTypeSpecificFlags: number;
  /** 序列化方法 */
  serializationMethod: number;
  /** 消息压缩方式 */
  messageCompression: number;
  /** 保留字段 */
  reserved: number;
  /** 扩展头数据 */
  headerExtensions: Buffer;
  /** 消息负载数据 */
  payload: Buffer;
  /** 响应状态码（解析后） */
  code?: number;
  /** 序列号（解析后） */
  seq?: number;
  /** 负载大小（解析后） */
  payloadSize?: number;
  /** 负载消息（解析后） */
  payloadMsg?: unknown;
}

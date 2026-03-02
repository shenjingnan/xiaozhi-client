/**
 * 二进制协议头生成和解析模块
 *
 * 提供字节跳动 ASR 协议的二进制协议头生成和解析功能
 */

import { Buffer } from "node:buffer";
import { gunzipSync, gzip, gzipSync } from "node:zlib";
import { PROTOCOL_VERSION } from "@/platforms/bytedance/protocol/constants.js";
import {
  CompressionType,
  type HeaderOptions,
  MessageType,
  MessageTypeSpecificFlags,
  type ParsedResponse,
  SerializationMethod,
} from "@/platforms/bytedance/protocol/types.js";

/**
 * 生成协议头
 */
export function generateHeader(options: HeaderOptions = {}): Buffer {
  const {
    version = PROTOCOL_VERSION,
    messageType = MessageType.CLIENT_FULL_REQUEST,
    messageTypeSpecificFlags = MessageTypeSpecificFlags.NO_SEQUENCE,
    serialMethod = SerializationMethod.JSON,
    compressionType = CompressionType.GZIP,
    reservedData = 0x00,
    extensionHeader = Buffer.alloc(0),
  } = options;

  const headerSize = Math.floor(extensionHeader.length / 4) + 1;

  const header = Buffer.alloc(4 + extensionHeader.length);

  // Byte 0: protocol_version(4 bits) | header_size(4 bits)
  header.writeUInt8((version << 4) | headerSize, 0);

  // Byte 1: message_type(4 bits) | message_type_specific_flags(4 bits)
  header.writeUInt8((messageType << 4) | messageTypeSpecificFlags, 1);

  // Byte 2: serialization_method(4 bits) | message_compression(4 bits)
  header.writeUInt8((serialMethod << 4) | compressionType, 2);

  // Byte 3: reserved (8 bits)
  header.writeUInt8(reservedData, 3);

  // Extension header
  if (extensionHeader.length > 0) {
    extensionHeader.copy(header, 4);
  }

  return header;
}

/**
 * 生成默认的完整客户端请求头
 */
export function generateFullDefaultHeader(): Buffer {
  return generateHeader({
    messageType: MessageType.CLIENT_FULL_REQUEST,
    messageTypeSpecificFlags: MessageTypeSpecificFlags.NO_SEQUENCE,
  });
}

/**
 * 生成仅音频请求头
 */
export function generateAudioDefaultHeader(): Buffer {
  return generateHeader({
    messageType: MessageType.CLIENT_AUDIO_ONLY_REQUEST,
    messageTypeSpecificFlags: MessageTypeSpecificFlags.NO_SEQUENCE,
  });
}

/**
 * 生成最后一个音频请求头（带有 NEG_SEQUENCE 标志）
 */
export function generateLastAudioDefaultHeader(): Buffer {
  return generateHeader({
    messageType: MessageType.CLIENT_AUDIO_ONLY_REQUEST,
    messageTypeSpecificFlags: MessageTypeSpecificFlags.NEG_SEQUENCE,
  });
}

/**
 * 解析服务器响应
 */
export function parseResponse(res: Buffer): ParsedResponse {
  // Parse header
  const protocolVersion = res.readUInt8(0) >> 4;
  const headerSize = res.readUInt8(0) & 0x0f;
  const messageType = res.readUInt8(1) >> 4;
  const messageTypeSpecificFlags = res.readUInt8(1) & 0x0f;
  const serializationMethod = res.readUInt8(2) >> 4;
  const messageCompression = res.readUInt8(2) & 0x0f;
  const reserved = res.readUInt8(3);

  // Header extensions
  const headerExtensions = res.subarray(4, headerSize * 4);

  // Payload
  const payload = res.subarray(headerSize * 4);

  const result: ParsedResponse = {
    protocolVersion,
    headerSize,
    messageType,
    messageTypeSpecificFlags,
    serializationMethod,
    messageCompression,
    reserved,
    headerExtensions,
    payload: Buffer.alloc(0),
  };

  // Parse payload based on message type
  let payloadData = payload;
  let payloadSize = 0;

  if (messageType === MessageType.SERVER_FULL_RESPONSE) {
    if (payload.length >= 4) {
      payloadSize = payload.readInt32BE(0);
      payloadData = payload.subarray(4);
    }
  } else if (messageType === MessageType.SERVER_ACK) {
    if (payload.length >= 4) {
      result.seq = payload.readInt32BE(0);
      if (payload.length >= 8) {
        payloadSize = payload.readUInt32BE(4);
        payloadData = payload.subarray(8);
      }
    }
  } else if (messageType === MessageType.SERVER_ERROR_RESPONSE) {
    if (payload.length >= 4) {
      result.code = payload.readUInt32BE(0);
      if (payload.length >= 8) {
        payloadSize = payload.readUInt32BE(4);
        payloadData = payload.subarray(8);
      }
    }
  }

  result.payload = payloadData;

  // Decompress if needed
  if (messageCompression === CompressionType.GZIP && payloadData.length > 0) {
    try {
      payloadData = gunzipSync(payloadData);
    } catch {
      // Keep original if decompression fails
    }
  }

  // Deserialize payload
  if (serializationMethod === SerializationMethod.JSON) {
    try {
      const text = payloadData.toString("utf-8");
      result.payloadMsg = JSON.parse(text);
    } catch {
      result.payloadMsg = payloadData.toString("utf-8");
    }
  } else if (serializationMethod !== SerializationMethod.NO_SERIALIZATION) {
    result.payloadMsg = payloadData.toString("utf-8");
  }

  result.payloadSize = payloadSize;

  return result;
}

/**
 * 使用 gzip 压缩数据
 */
export function compressGzip(data: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    gzip(data, (err: Error | null, result: Buffer) => {
      if (err) reject(err);
      else resolve(result);
    });
  });
}

/**
 * 同步 gzip 压缩
 */
export function compressGzipSync(data: Buffer): Buffer {
  return gzipSync(data);
}

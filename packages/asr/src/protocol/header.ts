/**
 * Binary protocol header generation and parsing
 */

import { gzip, gzipSync, gunzipSync } from "node:zlib";
import { Buffer } from "node:buffer";
import {
  MessageType,
  MessageTypeSpecificFlags,
  SerializationMethod,
  CompressionType,
  HeaderOptions,
  ParsedResponse,
} from "./types.js";
import {
  PROTOCOL_VERSION,
} from "./constants.js";

/**
 * Generate protocol header
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
 * Generate default full client request header
 */
export function generateFullDefaultHeader(): Buffer {
  return generateHeader({
    messageType: MessageType.CLIENT_FULL_REQUEST,
    messageTypeSpecificFlags: MessageTypeSpecificFlags.NO_SEQUENCE,
  });
}

/**
 * Generate audio-only request header
 */
export function generateAudioDefaultHeader(): Buffer {
  return generateHeader({
    messageType: MessageType.CLIENT_AUDIO_ONLY_REQUEST,
    messageTypeSpecificFlags: MessageTypeSpecificFlags.NO_SEQUENCE,
  });
}

/**
 * Generate last audio request header (with NEG_SEQUENCE flag)
 */
export function generateLastAudioDefaultHeader(): Buffer {
  return generateHeader({
    messageType: MessageType.CLIENT_AUDIO_ONLY_REQUEST,
    messageTypeSpecificFlags: MessageTypeSpecificFlags.NEG_SEQUENCE,
  });
}

/**
 * Parse server response
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
 * Compress data using gzip
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
 * Synchronous gzip compress
 */
export function compressGzipSync(data: Buffer): Buffer {
  return gzipSync(data);
}

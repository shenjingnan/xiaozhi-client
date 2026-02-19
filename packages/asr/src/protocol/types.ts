/**
 * Protocol type definitions
 */

// Message Type
export enum MessageType {
  CLIENT_FULL_REQUEST = 0b0001,
  CLIENT_AUDIO_ONLY_REQUEST = 0b0010,
  SERVER_FULL_RESPONSE = 0b1001,
  SERVER_ACK = 0b1011,
  SERVER_ERROR_RESPONSE = 0b1111,
}

// Message Type Specific Flags
export enum MessageTypeSpecificFlags {
  NO_SEQUENCE = 0b0000,
  POS_SEQUENCE = 0b0001,
  NEG_SEQUENCE = 0b0010,
  NEG_SEQUENCE_1 = 0b0011,
}

// Message Serialization Method
export enum SerializationMethod {
  NO_SERIALIZATION = 0b0000,
  JSON = 0b0001,
  THRIFT = 0b0011,
  CUSTOM_TYPE = 0b1111,
}

// Message Compression Type
export enum CompressionType {
  NO_COMPRESSION = 0b0000,
  GZIP = 0b0001,
  CUSTOM_COMPRESSION = 0b1111,
}

// Header options for generating headers
export interface HeaderOptions {
  version?: number;
  messageType?: MessageType;
  messageTypeSpecificFlags?: MessageTypeSpecificFlags;
  serialMethod?: SerializationMethod;
  compressionType?: CompressionType;
  reservedData?: number;
  extensionHeader?: Buffer;
}

// Parsed response from server
export interface ParsedResponse {
  protocolVersion: number;
  headerSize: number;
  messageType: number;
  messageTypeSpecificFlags: number;
  serializationMethod: number;
  messageCompression: number;
  reserved: number;
  headerExtensions: Buffer;
  payload: Buffer;
  // Parsed fields
  code?: number;
  seq?: number;
  payloadSize?: number;
  payloadMsg?: unknown;
}

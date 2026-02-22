/**
 * Protocol type definitions
 *
 * Defines core types for the ASR protocol binary format,
 * including message types, serialization methods, compression types, and interfaces.
 *
 * @module types
 */

/**
 * Message type enum
 * Defines different types of messages in the ASR protocol
 */
export enum MessageType {
  /** Client full request (contains audio and control info) */
  CLIENT_FULL_REQUEST = 0b0001,
  /** Client audio-only request */
  CLIENT_AUDIO_ONLY_REQUEST = 0b0010,
  /** Server full response */
  SERVER_FULL_RESPONSE = 0b1001,
  /** Server acknowledgment message */
  SERVER_ACK = 0b1011,
  /** Server error response */
  SERVER_ERROR_RESPONSE = 0b1111,
}

/**
 * Message type-specific flags enum
 * Controls serialization behavior for messages
 */
export enum MessageTypeSpecificFlags {
  /** No sequence number */
  NO_SEQUENCE = 0b0000,
  /** Positive sequence number */
  POS_SEQUENCE = 0b0001,
  /** Negative sequence number */
  NEG_SEQUENCE = 0b0010,
  /** Negative sequence number variant */
  NEG_SEQUENCE_1 = 0b0011,
}

/**
 * Serialization method enum
 * Defines how message payloads are serialized
 */
export enum SerializationMethod {
  /** No serialization */
  NO_SERIALIZATION = 0b0000,
  /** JSON serialization */
  JSON = 0b0001,
  /** Thrift serialization */
  THRIFT = 0b0011,
  /** Custom serialization */
  CUSTOM_TYPE = 0b1111,
}

/**
 * Compression type enum
 * Defines how message payloads are compressed
 */
export enum CompressionType {
  /** No compression */
  NO_COMPRESSION = 0b0000,
  /** GZIP compression */
  GZIP = 0b0001,
  /** Custom compression */
  CUSTOM_COMPRESSION = 0b1111,
}

/**
 * Protocol header generation options interface
 * Used to configure protocol header parameters
 */
export interface HeaderOptions {
  /** Protocol version number, default is PROTOCOL_VERSION */
  version?: number;
  /** Message type */
  messageType?: MessageType;
  /** Message type-specific flags */
  messageTypeSpecificFlags?: MessageTypeSpecificFlags;
  /** Serialization method */
  serialMethod?: SerializationMethod;
  /** Compression type */
  compressionType?: CompressionType /** Reserved data, default is 0x00 */
  reservedData?: number;
  /** Extension header data */
  extensionHeader?: Buffer;
}

/**
 * Parsed server response interface
 * Contains complete protocol header and payload information
 */
export interface ParsedResponse {
  /** Protocol version number */
  protocolVersion: number;
  /** Protocol header size (in 4-byte units) */
  headerSize: number;
  /** Message type */
  messageType: number;
  /** Message type-specific flags */
  messageTypeSpecificFlags: number;
  /** Serialization method */
  serializationMethod: number;
  /** Message compression type */
  messageCompression: number;
  /** Reserved field */
  reserved: number;
  /** Extension header data */
  headerExtensions: Buffer;
  /** Message payload data */
  payload: Buffer;
  /** Response status code (parsed) */
  code?: number;
  /** Sequence number (parsed) */
  seq?: number;
  /** Payload size (parsed) */
  payloadSize?: number;
  /** Payload message (parsed) */
  payloadMsg?: unknown;
}

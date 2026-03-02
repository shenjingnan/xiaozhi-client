/**
 * 协议常量
 *
 * 定义字节跳动 ASR 协议使用的常量值
 */

export const PROTOCOL_VERSION = 0b0001;
export const DEFAULT_HEADER_SIZE = 0b0001;

// Bit field positions
export const PROTOCOL_VERSION_BITS = 4;
export const HEADER_BITS = 4;
export const MESSAGE_TYPE_BITS = 4;
export const MESSAGE_TYPE_SPECIFIC_FLAGS_BITS = 4;
export const MESSAGE_SERIALIZATION_BITS = 4;
export const MESSAGE_COMPRESSION_BITS = 4;
export const RESERVED_BITS = 8;

// Default values
export const DEFAULT_RESERVED = 0x00;

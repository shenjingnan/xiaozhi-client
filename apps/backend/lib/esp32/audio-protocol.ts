/**
 * ESP32 音频协议解析器
 * 支持小智硬件使用的 BinaryProtocol2 音频协议
 */

import { logger } from "@/Logger.js";

/**
 * BinaryProtocol2 音频数据包
 * 小智硬件使用的音频协议格式
 */
export interface ParsedAudioPacket {
  /** 协议版本 */
  protocolVersion: 2;
  /** 数据类型（0=Opus音频, 1=JSON数据） */
  type: "opus" | "json";
  /** 时间戳（毫秒，用于AEC回声消除） */
  timestamp: number;
  /** 音频载荷数据 */
  payload: Uint8Array;
}

/**
 * BinaryProtocol2 协议头结构（16字节）
 *
 * struct BinaryProtocol2 {
 *     uint16_t version;       // = 2 (小端序)
 *     uint16_t type;          // 0=Opus, 1=JSON (小端序)
 *     uint32_t reserved;      // 保留字段 (小端序)
 *     uint32_t timestamp;     // 时间戳毫秒 (小端序)
 *     uint32_t payload_size;  // 载荷大小 (小端序)
 *     uint8_t payload[];      // 载荷数据
 * }
 */
const PROTOCOL_HEADER_SIZE = 16;
const PROTOCOL_VERSION = 2;

/**
 * 解析 BinaryProtocol2 音频数据包
 * @param data - 原始二进制数据
 * @returns 解析后的音频数据包，如果解析失败则返回 null
 */
export function parseBinaryProtocol2(data: Buffer): ParsedAudioPacket | null {
  // 检查数据长度是否至少包含协议头
  if (data.length < PROTOCOL_HEADER_SIZE) {
    logger.debug(
      `数据包长度不足: expected=${PROTOCOL_HEADER_SIZE}, actual=${data.length}`
    );
    return null;
  }

  // 读取协议版本（小端序，uint16_t）
  const version = data.readUInt16LE(0);
  if (version !== PROTOCOL_VERSION) {
    logger.debug(`不支持的协议版本: ${version}`);
    return null;
  }

  // 读取数据类型（小端序，uint16_t）
  const typeValue = data.readUInt16LE(2);

  // 跳过保留字段（uint32_t，偏移4-7）
  // 读取时间戳（小端序，uint32_t，偏移8-11）
  const timestamp = data.readUInt32LE(8);

  // 读取载荷大小（小端序，uint32_t，偏移12-15）
  const payloadSize = data.readUInt32LE(12);

  // 检查载荷大小是否与实际数据匹配
  const expectedTotalSize = PROTOCOL_HEADER_SIZE + payloadSize;
  if (data.length < expectedTotalSize) {
    logger.debug(
      `载荷大小不匹配: expected=${payloadSize}, actual=${data.length - PROTOCOL_HEADER_SIZE}`
    );
    return null;
  }

  // 提取载荷数据
  const payload = data.subarray(PROTOCOL_HEADER_SIZE, expectedTotalSize);

  // 映射数据类型
  const type: "opus" | "json" = typeValue === 1 ? "json" : "opus";

  logger.debug(
    `解析音频包成功: version=${version}, type=${type}, timestamp=${timestamp}, payloadSize=${payloadSize}`
  );

  return {
    protocolVersion: 2,
    type,
    timestamp,
    payload,
  };
}

/**
 * 检查数据是否可能是 BinaryProtocol2 格式
 * @param data - 原始二进制数据
 * @returns 是否可能是该协议格式
 */
export function isBinaryProtocol2(data: Buffer): boolean {
  if (data.length < PROTOCOL_HEADER_SIZE) {
    return false;
  }

  // 检查协议版本是否为2
  const version = data.readUInt16LE(0);
  return version === PROTOCOL_VERSION;
}

/**
 * 创建 BinaryProtocol2 音频数据包
 * @param payload - 音频载荷数据
 * @param timestamp - 时间戳（毫秒）
 * @param type - 数据类型
 * @returns 编码后的二进制数据
 */
export function encodeBinaryProtocol2(
  payload: Uint8Array,
  timestamp: number,
  type: "opus" | "json" = "opus"
): Buffer {
  const typeValue = type === "json" ? 1 : 0;
  const payloadSize = payload.length;

  // 分配缓冲区（协议头 + 载荷）
  const buffer = Buffer.allocUnsafe(PROTOCOL_HEADER_SIZE + payloadSize);

  // 写入协议版本（小端序，uint16_t）
  buffer.writeUInt16LE(PROTOCOL_VERSION, 0);

  // 写入数据类型（小端序，uint16_t）
  buffer.writeUInt16LE(typeValue, 2);

  // 写入保留字段（小端序，uint32_t）
  buffer.writeUInt32LE(0, 4);

  // 写入时间戳（小端序，uint32_t）
  buffer.writeUInt32LE(timestamp, 8);

  // 写入载荷大小（小端序，uint32_t）
  buffer.writeUInt32LE(payloadSize, 12);

  // 写入载荷数据
  buffer.set(payload, PROTOCOL_HEADER_SIZE);

  return buffer;
}

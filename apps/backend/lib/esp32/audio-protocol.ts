/**
 * BinaryProtocol2 音频协议实现
 * 用于 ESP32 设备与服务端之间的音频数据传输
 *
 * 协议格式（大端序/网络字节序）：
 * +--------+--------+--------+--------+--------+--------+--------+--------+
 * | Version (16)  |   Type (16)   |           Reserved (32)          |
 * +--------+--------+--------+--------+--------+--------+--------+--------+
 * |                           Timestamp (32)                          |
 * +--------+--------+--------+--------+--------+--------+--------+--------+
 * |                          Payload Size (32)                        |
 * +--------+--------+--------+--------+--------+--------+--------+--------+
 * |                            Payload Data...                         |
 * +--------+--------+--------+--------+--------+--------+--------+--------+
 *
 * - Version: 2 (协议版本)
 * - Type: 0 = Opus 音频, 1 = JSON
 * - Timestamp: 毫秒级时间戳（uint32，使用模运算避免溢出）
 * - Payload Size: 负载字节数
 * - Payload: 实际音频数据
 */

/**
 * BinaryProtocol2 解析结果接口
 */
export interface BinaryProtocol2Parsed {
  /** 协议版本 */
  protocolVersion: number;
  /** 数据类型 */
  type: "opus" | "json";
  /** 时间戳 */
  timestamp: number;
  /** 音频载荷 */
  payload: Uint8Array;
}

/**
 * 协议头部大小（字节）
 */
const HEADER_SIZE = 16; // 2 + 2 + 4 + 4 + 4

/**
 * 编码为 BinaryProtocol2 格式
 * @param payload - 音频载荷数据
 * @param timestamp - 时间戳（毫秒级）
 * @param type - 数据类型（默认 opus）
 * @returns 编码后的 Buffer
 */
export function encodeBinaryProtocol2(
  payload: Uint8Array,
  timestamp: number,
  type: "opus" | "json" = "opus"
): Buffer {
  const buffer = Buffer.allocUnsafe(HEADER_SIZE + payload.length);

  // 写入协议版本（uint16，大端序）
  buffer.writeUInt16BE(2, 0);

  // 写入数据类型（uint16，大端序）
  buffer.writeUInt16BE(type === "opus" ? 0 : 1, 2);

  // 写入保留字段（uint32，大端序）
  buffer.writeUInt32BE(0, 4);

  // 写入时间戳（uint32，大端序）
  buffer.writeUInt32BE(timestamp, 8);

  // 写入载荷大小（uint32，大端序）
  buffer.writeUInt32BE(payload.length, 12);

  // 写入载荷数据
  buffer.set(payload, HEADER_SIZE);

  return buffer;
}

/**
 * 解析 BinaryProtocol2 数据
 * @param data - 待解析的数据
 * @returns 解析结果，如果数据格式不正确则返回 null
 */
export function parseBinaryProtocol2(
  data: Buffer
): BinaryProtocol2Parsed | null {
  // 检查数据长度是否至少包含头部
  if (data.length < HEADER_SIZE) {
    return null;
  }

  // 读取协议版本
  const version = data.readUInt16BE(0);
  if (version !== 2) {
    return null;
  }

  // 读取数据类型
  const typeValue = data.readUInt16BE(2);
  const type = typeValue === 0 ? ("opus" as const) : ("json" as const);

  // 读取时间戳
  const timestamp = data.readUInt32BE(8);

  // 读取载荷大小
  const payloadSize = data.readUInt32BE(12);

  // 检查载荷大小是否与实际数据长度匹配
  if (data.length < HEADER_SIZE + payloadSize) {
    return null;
  }

  // 提取载荷数据
  const payload = new Uint8Array(
    data.buffer,
    data.byteOffset + HEADER_SIZE,
    payloadSize
  );

  return {
    protocolVersion: version,
    type,
    timestamp,
    payload,
  };
}

/**
 * 检查是否为 BinaryProtocol2 格式
 * @param data - 待检查的数据
 * @returns 是否为 BinaryProtocol2 格式
 */
export function isBinaryProtocol2(data: Buffer): boolean {
  // 快速检查：数据长度必须至少包含头部
  if (data.length < HEADER_SIZE) {
    return false;
  }

  // 检查协议版本是否为 2
  const version = data.readUInt16BE(0);
  if (version !== 2) {
    return false;
  }

  // 读取载荷大小
  const payloadSize = data.readUInt32BE(12);

  // 检查载荷大小是否合理（不超过数据长度）
  if (data.length < HEADER_SIZE + payloadSize) {
    return false;
  }

  // 检查数据类型是否有效（0 或 1）
  const typeValue = data.readUInt16BE(2);
  if (typeValue !== 0 && typeValue !== 1) {
    return false;
  }

  return true;
}

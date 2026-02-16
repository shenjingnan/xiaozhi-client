/**
 * 音频协议 Stub 实现
 * 用于保持编译兼容性，不提供实际的音频处理功能
 *
 * 此文件仅用于 OTA 和硬件通信分支，
 * 完整的音频协议实现请参考 audio-protocol.ts
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
 * 检查是否为 BinaryProtocol2 格式
 * @param _data - 待检查的数据
 * @returns 始终返回 false，不识别任何协议
 */
export function isBinaryProtocol2(_data: Buffer): boolean {
  return false;
}

/**
 * 解析 BinaryProtocol2 数据
 * @param _data - 待解析的数据
 * @returns 始终返回 null，不解析任何数据
 */
export function parseBinaryProtocol2(
  _data: Buffer
): BinaryProtocol2Parsed | null {
  return null;
}

/**
 * 编码为 BinaryProtocol2 格式
 * @param _payload - 音频载荷数据
 * @param _timestamp - 时间戳
 * @param _type - 数据类型
 * @returns 空的 Buffer
 */
export function encodeBinaryProtocol2(
  _payload: Uint8Array,
  _timestamp: number,
  _type?: "opus" | "json"
): Buffer {
  return Buffer.alloc(0);
}

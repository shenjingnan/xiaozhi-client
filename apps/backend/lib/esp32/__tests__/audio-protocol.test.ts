/**
 * audio-protocol 单元测试
 * 测试 ESP32 二进制音频协议的编解码功能
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  detectAudioProtocol,
  encodeBinaryProtocol2,
  isBinaryProtocol2,
  isBinaryProtocol3,
  parseBinaryProtocol2,
  parseBinaryProtocol3,
  type AudioProtocolType,
  type BinaryProtocol2Parsed,
  type BinaryProtocol3Parsed,
} from "../audio-protocol.js";

describe("BinaryProtocol2 编解码", () => {
  describe("encodeBinaryProtocol2", () => {
    it("应该正确编码 Opus 音频数据", () => {
      const payload = new Uint8Array([0x01, 0x02, 0x03, 0x04, 0x05]);
      const timestamp = 1000;
      const result = encodeBinaryProtocol2(payload, timestamp, "opus");

      expect(result).toBeInstanceOf(Buffer);
      expect(result.length).toBe(16 + payload.length); // 头部16字节 + 载荷

      // 验证协议版本（字节0-1）
      expect(result.readUInt16BE(0)).toBe(2);

      // 验证数据类型（字节2-3），0 = opus
      expect(result.readUInt16BE(2)).toBe(0);

      // 验证保留字段（字节4-7）
      expect(result.readUInt32BE(4)).toBe(0);

      // 验证时间戳（字节8-11）
      expect(result.readUInt32BE(8)).toBe(timestamp);

      // 验证载荷大小（字节12-15）
      expect(result.readUInt32BE(12)).toBe(payload.length);

      // 验证载荷数据
      expect(result.subarray(16)).toEqual(Buffer.from(payload));
    });

    it("应该正确编码 JSON 数据", () => {
      const payload = new Uint8Array([0x7b, 0x22, 0x74, 0x65, 0x73, 0x74, 0x22, 0x7d]); // {"test"}
      const timestamp = 2000;
      const result = encodeBinaryProtocol2(payload, timestamp, "json");

      expect(result).toBeInstanceOf(Buffer);

      // 验证数据类型，1 = json
      expect(result.readUInt16BE(2)).toBe(1);
    });

    it("应该默认使用 Opus 类型", () => {
      const payload = new Uint8Array([0x01, 0x02]);
      const result = encodeBinaryProtocol2(payload, 1000);

      expect(result.readUInt16BE(2)).toBe(0); // 默认为 opus
    });

    it("应该正确编码空载荷", () => {
      const payload = new Uint8Array([]);
      const result = encodeBinaryProtocol2(payload, 0, "opus");

      expect(result.length).toBe(16); // 只有头部
      expect(result.readUInt32BE(12)).toBe(0); // 载荷大小为0
    });

    it("应该正确编码大载荷", () => {
      const payload = new Uint8Array(1000).fill(0xAB);
      const result = encodeBinaryProtocol2(payload, 5000, "opus");

      expect(result.length).toBe(16 + 1000);
      expect(result.readUInt32BE(12)).toBe(1000);
    });

    it("应该正确编码最大时间戳值", () => {
      const payload = new Uint8Array([0x01]);
      const maxTimestamp = 0xFFFFFFFF; // uint32 最大值
      const result = encodeBinaryProtocol2(payload, maxTimestamp, "opus");

      expect(result.readUInt32BE(8)).toBe(maxTimestamp);
    });
  });

  describe("parseBinaryProtocol2", () => {
    it("应该正确解析有效的 Protocol2 Opus 数据", () => {
      const payload = new Uint8Array([0x01, 0x02, 0x03]);
      const encoded = encodeBinaryProtocol2(payload, 1000, "opus");
      const result = parseBinaryProtocol2(encoded);

      expect(result).not.toBeNull();
      expect(result?.protocolVersion).toBe(2);
      expect(result?.type).toBe("opus");
      expect(result?.timestamp).toBe(1000);
      expect(result?.payload).toEqual(payload);
    });

    it("应该正确解析有效的 Protocol2 JSON 数据", () => {
      const payload = new Uint8Array([0x7b, 0x7d]); // {}
      const encoded = encodeBinaryProtocol2(payload, 2000, "json");
      const result = parseBinaryProtocol2(encoded);

      expect(result?.type).toBe("json");
      expect(result?.payload).toEqual(payload);
    });

    it("应该拒绝过短的数据", () => {
      const invalid = Buffer.from([0x00, 0x02]);
      const result = parseBinaryProtocol2(invalid);

      expect(result).toBeNull();
    });

    it("应该拒绝错误的协议版本", () => {
      const buffer = Buffer.alloc(20);
      buffer.writeUInt16BE(3, 0); // 协议版本为3

      const result = parseBinaryProtocol2(buffer);

      expect(result).toBeNull();
    });

    it("应该拒绝载荷大小不匹配的数据", () => {
      const payload = new Uint8Array([0x01, 0x02, 0x03]);
      const encoded = encodeBinaryProtocol2(payload, 1000, "opus");

      // 修改载荷大小字段，使其大于实际数据长度
      encoded.writeUInt32BE(9999, 12);

      const result = parseBinaryProtocol2(encoded);

      expect(result).toBeNull();
    });

    it("应该解析只有头部的数据", () => {
      const buffer = Buffer.alloc(16);
      buffer.writeUInt16BE(2, 0); // 版本
      buffer.writeUInt16BE(0, 2); // 类型 opus
      buffer.writeUInt32BE(0, 4); // 保留字段
      buffer.writeUInt32BE(1000, 8); // 时间戳
      buffer.writeUInt32BE(0, 12); // 载荷大小

      const result = parseBinaryProtocol2(buffer);

      expect(result).not.toBeNull();
      expect(result?.payload.length).toBe(0);
    });
  });

  describe("isBinaryProtocol2", () => {
    it("应该识别有效的 Protocol2 Opus 数据", () => {
      const payload = new Uint8Array([0x01, 0x02, 0x03]);
      const encoded = encodeBinaryProtocol2(payload, 1000, "opus");

      expect(isBinaryProtocol2(encoded)).toBe(true);
    });

    it("应该识别有效的 Protocol2 JSON 数据", () => {
      const payload = new Uint8Array([0x7b, 0x7d]);
      const encoded = encodeBinaryProtocol2(payload, 2000, "json");

      expect(isBinaryProtocol2(encoded)).toBe(true);
    });

    it("应该拒绝过短的数据", () => {
      const short = Buffer.from([0x00, 0x02]);

      expect(isBinaryProtocol2(short)).toBe(false);
    });

    it("应该拒绝错误版本的数据", () => {
      const buffer = Buffer.alloc(20);
      buffer.writeUInt16BE(3, 0); // 错误版本

      expect(isBinaryProtocol2(buffer)).toBe(false);
    });

    it("应该拒绝无效数据类型的数据", () => {
      const payload = new Uint8Array([0x01]);
      const encoded = encodeBinaryProtocol2(payload, 1000, "opus");

      // 修改数据类型为无效值
      encoded.writeUInt16BE(999, 2);

      expect(isBinaryProtocol2(encoded)).toBe(false);
    });

    it("应该拒绝载荷大小不匹配的数据", () => {
      const payload = new Uint8Array([0x01]);
      const encoded = encodeBinaryProtocol2(payload, 1000, "opus");

      // 修改载荷大小为不匹配的值
      encoded.writeUInt32BE(9999, 12);

      expect(isBinaryProtocol2(encoded)).toBe(false);
    });
  });
});

describe("BinaryProtocol3 解析", () => {
  describe("isBinaryProtocol3", () => {
    it("应该识别有效的 Protocol3 Opus 数据", () => {
      // 构造有效的 Protocol3 数据
      const payload = new Uint8Array([0x01, 0x02, 0x03]);
      const buffer = Buffer.alloc(4 + payload.length);
      buffer[0] = 0; // type = opus
      buffer[1] = 0; // reserved
      buffer.writeUInt16BE(payload.length, 2); // payload size
      buffer.set(payload, 4);

      expect(isBinaryProtocol3(buffer)).toBe(true);
    });

    it("应该识别有效的 Protocol3 JSON 数据", () => {
      const payload = new Uint8Array([0x7b, 0x7d]);
      const buffer = Buffer.alloc(4 + payload.length);
      buffer[0] = 1; // type = json
      buffer[1] = 0; // reserved
      buffer.writeUInt16BE(payload.length, 2);
      buffer.set(payload, 4);

      expect(isBinaryProtocol3(buffer)).toBe(true);
    });

    it("应该拒绝过短的数据", () => {
      const short = Buffer.from([0x00]);

      expect(isBinaryProtocol3(short)).toBe(false);
    });

    it("应该拒绝刚好只有头部的数据", () => {
      const header = Buffer.alloc(4);
      header[0] = 0; // type
      header[1] = 0; // reserved
      header.writeUInt16BE(10, 2); // payload size

      expect(isBinaryProtocol3(header)).toBe(false); // 缺少载荷
    });

    it("应该拒绝无效类型的数据", () => {
      const buffer = Buffer.alloc(5);
      buffer[0] = 99; // 无效类型
      buffer[1] = 0;
      buffer.writeUInt16BE(1, 2);

      expect(isBinaryProtocol3(buffer)).toBe(false);
    });

    it("应该拒绝载荷大小不匹配的数据", () => {
      const payload = new Uint8Array([0x01]);
      const buffer = Buffer.alloc(4 + payload.length);
      buffer[0] = 0;
      buffer[1] = 0;
      buffer.writeUInt16BE(999, 2); // 声明载荷大小为999
      buffer.set(payload, 4); // 但实际只有1字节

      expect(isBinaryProtocol3(buffer)).toBe(false);
    });
  });

  describe("parseBinaryProtocol3", () => {
    it("应该正确解析有效的 Protocol3 Opus 数据", () => {
      const payload = new Uint8Array([0x01, 0x02, 0x03]);
      const buffer = Buffer.alloc(4 + payload.length);
      buffer[0] = 0; // type = opus
      buffer[1] = 0; // reserved
      buffer.writeUInt16BE(payload.length, 2);
      buffer.set(payload, 4);

      const result = parseBinaryProtocol3(buffer);

      expect(result).not.toBeNull();
      expect(result?.protocolVersion).toBe(3);
      expect(result?.type).toBe("opus");
      expect(result?.timestamp).toBe(0); // 协议3没有时间戳
      expect(result?.payload).toEqual(payload);
    });

    it("应该正确解析有效的 Protocol3 JSON 数据", () => {
      const payload = new Uint8Array([0x7b, 0x7d]);
      const buffer = Buffer.alloc(4 + payload.length);
      buffer[0] = 1; // type = json
      buffer[1] = 0;
      buffer.writeUInt16BE(payload.length, 2);
      buffer.set(payload, 4);

      const result = parseBinaryProtocol3(buffer);

      expect(result?.type).toBe("json");
      expect(result?.payload).toEqual(payload);
    });

    it("应该拒绝过短的数据", () => {
      const short = Buffer.from([0x00, 0x00]);

      const result = parseBinaryProtocol3(short);

      expect(result).toBeNull();
    });

    it("应该拒绝载荷大小不匹配的数据", () => {
      const payload = new Uint8Array([0x01]);
      const buffer = Buffer.alloc(10);
      buffer[0] = 0;
      buffer[1] = 0;
      buffer.writeUInt16BE(100, 2); // 声明载荷大小为100
      buffer.set(payload, 4); // 但实际只有1字节

      const result = parseBinaryProtocol3(buffer);

      expect(result).toBeNull();
    });

    it("应该正确解析空载荷", () => {
      const buffer = Buffer.alloc(4);
      buffer[0] = 0; // type
      buffer[1] = 0; // reserved
      buffer.writeUInt16BE(0, 2); // payload size = 0

      const result = parseBinaryProtocol3(buffer);

      expect(result).not.toBeNull();
      expect(result?.payload.length).toBe(0);
    });
  });
});

describe("detectAudioProtocol 协议检测", () => {
  describe("Protocol2 检测", () => {
    it("应该检测到 Protocol2 Opus 数据", () => {
      const payload = new Uint8Array([0x01, 0x02]);
      const encoded = encodeBinaryProtocol2(payload, 1000, "opus");

      const result = detectAudioProtocol(encoded);

      expect(result).toBe("protocol2");
    });

    it("应该检测到 Protocol2 JSON 数据", () => {
      const payload = new Uint8Array([0x7b, 0x7d]);
      const encoded = encodeBinaryProtocol2(payload, 2000, "json");

      const result = detectAudioProtocol(encoded);

      expect(result).toBe("protocol2");
    });
  });

  describe("Protocol3 检测", () => {
    it("应该检测到 Protocol3 Opus 数据", () => {
      const payload = new Uint8Array([0x01, 0x02]);
      const buffer = Buffer.alloc(4 + payload.length);
      buffer[0] = 0; // type = opus
      buffer[1] = 0;
      buffer.writeUInt16BE(payload.length, 2);
      buffer.set(payload, 4);

      const result = detectAudioProtocol(buffer);

      expect(result).toBe("protocol3");
    });

    it("应该检测到 Protocol3 JSON 数据", () => {
      const payload = new Uint8Array([0x7b, 0x7d]);
      const buffer = Buffer.alloc(4 + payload.length);
      buffer[0] = 1; // type = json
      buffer[1] = 0;
      buffer.writeUInt16BE(payload.length, 2);
      buffer.set(payload, 4);

      const result = detectAudioProtocol(buffer);

      expect(result).toBe("protocol3");
    });
  });

  describe("Protocol1 检测（纯 Opus 数据）", () => {
    it("应该检测到有效的 Opus TOC 数据", () => {
      // 构造有效的 Opus TOC 字节
      // config=0, channels=0, frame=0 => 0x00
      const opusData = Buffer.from([0x00, 0x01, 0x02]);

      const result = detectAudioProtocol(opusData);

      expect(result).toBe("protocol1");
    });

    it("应该检测到不同 config 的 Opus 数据", () => {
      // config=23 (最大值), channels=1, frame=3 => 0xBC
      const opusData = Buffer.from([0xbc, 0x01, 0x02]);

      const result = detectAudioProtocol(opusData);

      expect(result).toBe("protocol1");
    });

    it("应该拒绝过短的数据为 Protocol1", () => {
      const short = Buffer.from([0x00]);

      const result = detectAudioProtocol(short);

      expect(result).toBe("unknown");
    });

    it("应该拒绝无效 config 的数据", () => {
      // config=24 (无效值)
      const invalid = Buffer.from([0xc0, 0x01]);

      const result = detectAudioProtocol(invalid);

      expect(result).toBe("unknown");
    });
  });

  describe("未知协议检测", () => {
    it("应该返回 unknown 对于随机数据", () => {
      const random = Buffer.from([0xFF, 0xFF, 0xFF, 0xFF]);

      const result = detectAudioProtocol(random);

      expect(result).toBe("unknown");
    });

    it("应该返回 unknown 对于空数据", () => {
      const empty = Buffer.alloc(0);

      const result = detectAudioProtocol(empty);

      expect(result).toBe("unknown");
    });

    it("应该返回 unknown 对于不完整的数据", () => {
      // 使用只有 1 字节的数据（比任何协议头部都短）
      const incomplete = Buffer.from([0xFF]);

      const result = detectAudioProtocol(incomplete);

      expect(result).toBe("unknown");
    });
  });

  describe("协议优先级", () => {
    it("应该优先检测 Protocol2 而非 Protocol3", () => {
      // 这两个协议的头部完全不同，不会有冲突
      // 这个测试验证检测顺序
      const payload = new Uint8Array([0x01]);
      const protocol2 = encodeBinaryProtocol2(payload, 1000, "opus");

      const result = detectAudioProtocol(protocol2);

      expect(result).toBe("protocol2");
    });
  });
});

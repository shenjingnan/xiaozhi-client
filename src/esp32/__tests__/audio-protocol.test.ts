/**
 * 音频协议编解码单元测试
 * 测试 BinaryProtocol2/3 的编码、解析、检测和协议自动识别
 */

import { describe, expect, it } from "vitest";
import {
  detectAudioProtocol,
  encodeBinaryProtocol2,
  isBinaryProtocol2,
  isBinaryProtocol3,
  parseBinaryProtocol2,
  parseBinaryProtocol3,
} from "../audio-protocol.js";

describe("encodeBinaryProtocol2", () => {
  it("编码 opus 类型", () => {
    const payload = new Uint8Array([0x01, 0x02, 0x03]);
    const result = encodeBinaryProtocol2(payload, 1000, "opus");

    expect(result.length).toBe(16 + 3); // HEADER_SIZE + payload
    expect(result.readUInt16BE(0)).toBe(2); // version = 2
    expect(result.readUInt16BE(2)).toBe(0); // type: opus = 0
    expect(result.readUInt32BE(8)).toBe(1000); // timestamp
    expect(result.readUInt32BE(12)).toBe(3); // payload size
  });

  it("编码 json 类型", () => {
    const payload = new Uint8Array([0x7b, 0x7d]); // {}
    const result = encodeBinaryProtocol2(payload, 0, "json");

    expect(result.readUInt16BE(2)).toBe(1); // type: json = 1
  });

  it("默认类型为 opus", () => {
    const payload = new Uint8Array([0xff]);
    const result = encodeBinaryProtocol2(payload, 42);

    expect(result.readUInt16BE(2)).toBe(0); // 默认 opus
  });

  it("空载荷正常编码", () => {
    const payload = new Uint8Array(0);
    const result = encodeBinaryProtocol2(payload, 999);

    expect(result.length).toBe(16); // 仅头部
    expect(result.readUInt32BE(12)).toBe(0); // payload size = 0
  });

  it("输出长度等于 HEADER_SIZE + payload", () => {
    const sizes = [0, 1, 10, 100, 1024];
    for (const size of sizes) {
      const payload = new Uint8Array(size);
      const result = encodeBinaryProtocol2(payload, 0);
      expect(result.length).toBe(16 + size);
    }
  });

  it("时间戳大端序写入", () => {
    const payload = new Uint8Array([0]);
    const timestamp = 0xdeadbeef;
    const result = encodeBinaryProtocol2(payload, timestamp);

    expect(result.readUInt32BE(8)).toBe(timestamp);
  });
});

describe("parseBinaryProtocol2", () => {
  it("正确解析 encode 结果", () => {
    const originalPayload = new Uint8Array([0xaa, 0xbb, 0xcc]);
    const encoded = encodeBinaryProtocol2(originalPayload, 12345, "opus");
    const parsed = parseBinaryProtocol2(encoded);

    expect(parsed).not.toBeNull();
    expect(parsed!.protocolVersion).toBe(2);
    expect(parsed!.type).toBe("opus");
    expect(parsed!.timestamp).toBe(12345);
    expect(parsed!.payload).toEqual(originalPayload);
  });

  it("数据不足头部返回 null", () => {
    const shortData = Buffer.from([0x00, 0x02]); // 只有 2 字节
    expect(parseBinaryProtocol2(shortData)).toBeNull();

    // 恰好 15 字节（差 1 字节）
    const almostData = Buffer.alloc(15);
    almostData.writeUInt16BE(2, 0);
    expect(parseBinaryProtocol2(almostData)).toBeNull();
  });

  it("版本非 2 返回 null", () => {
    const data = Buffer.alloc(20);
    data.writeUInt16BE(1, 0); // version = 1
    data.writeUInt16BE(0, 2);
    data.writeUInt32BE(4, 12); // payloadSize = 4
    expect(parseBinaryProtocol2(data)).toBeNull();

    data.writeUInt16BE(3, 0); // version = 3
    expect(parseBinaryProtocol2(data)).toBeNull();
  });

  it("opus/json 类型解析", () => {
    const opusPayload = new Uint8Array([0x01]);
    const opusEncoded = encodeBinaryProtocol2(opusPayload, 0, "opus");
    expect(parseBinaryProtocol2(opusEncoded)!.type).toBe("opus");

    const jsonPayload = new Uint8Array([0x7b]);
    const jsonEncoded = encodeBinaryProtocol2(jsonPayload, 0, "json");
    expect(parseBinaryProtocol2(jsonEncoded)!.type).toBe("json");
  });

  it("载荷越界返回 null", () => {
    const data = Buffer.alloc(17); // 头部 16 字节 + 1 字节 payload
    data.writeUInt16BE(2, 0);
    data.writeUInt16BE(0, 2);
    data.writeUInt32BE(100, 12); // 声称有 100 字节但实际只有 1 字节
    expect(parseBinaryProtocol2(data)).toBeNull();
  });

  it("payload 为 Uint8Array 视图", () => {
    const payload = new Uint8Array([0x11, 0x22, 0x33, 0x44]);
    const encoded = encodeBinaryProtocol2(payload, 0);
    const parsed = parseBinaryProtocol2(encoded)!;

    expect(parsed.payload).toBeInstanceOf(Uint8Array);
    expect(Array.from(parsed.payload)).toEqual([0x11, 0x22, 0x33, 0x44]);
  });
});

describe("isBinaryProtocol2", () => {
  it("有效数据返回 true", () => {
    const payload = new Uint8Array([0x01]);
    const valid = encodeBinaryProtocol2(payload, 0, "opus");
    expect(isBinaryProtocol2(valid)).toBe(true);
  });

  it("长度不足返回 false", () => {
    expect(isBinaryProtocol2(Buffer.alloc(15))).toBe(false);
    expect(isBinaryProtocol2(Buffer.alloc(0))).toBe(false);
  });

  it("版本不匹配返回 false", () => {
    const data = Buffer.alloc(20);
    data.writeUInt16BE(1, 0); // 错误版本
    data.writeUInt16BE(0, 2);
    data.writeUInt32BE(4, 12);
    expect(isBinaryProtocol2(data)).toBe(false);
  });

  it("无效类型值返回 false", () => {
    const data = Buffer.alloc(20);
    data.writeUInt16BE(2, 0);
    data.writeUInt16BE(99, 2); // 无效类型
    data.writeUInt32BE(4, 12);
    expect(isBinaryProtocol2(data)).toBe(false);
  });

  it("载荷越界返回 false", () => {
    const data = Buffer.alloc(17);
    data.writeUInt16BE(2, 0);
    data.writeUInt16BE(0, 2);
    data.writeUInt32BE(50, 12); // 越界
    expect(isBinaryProtocol2(data)).toBe(false);
  });
});

describe("isBinaryProtocol3 / parseBinaryProtocol3", () => {
  function buildProtocol3Data(type: number, payload: Buffer): Buffer {
    const header = Buffer.alloc(4);
    header[0] = type; // type byte
    header[1] = 0; // reserved
    header.writeUInt16BE(payload.length, 2); // payload size (big-endian)
    return Buffer.concat([header, payload]);
  }

  it("有效协议3检测", () => {
    const data = buildProtocol3Data(0, Buffer.from([0x01, 0x02]));
    expect(isBinaryProtocol3(data)).toBe(true);
  });

  it("长度不足4字节", () => {
    expect(isBinaryProtocol3(Buffer.alloc(3))).toBe(false);
    expect(isBinaryProtocol3(Buffer.alloc(0))).toBe(false);
  });

  it("无效 type 值", () => {
    const data = buildProtocol3Data(5, Buffer.from([0x01]));
    expect(isBinaryProtocol3(data)).toBe(false);
  });

  it("正确解析协议3", () => {
    const payload = new Uint8Array([0xaa, 0xbb, 0xcc]);
    const data = buildProtocol3Data(0, Buffer.from(payload));
    const parsed = parseBinaryProtocol3(data);

    expect(parsed).not.toBeNull();
    expect(parsed!.protocolVersion).toBe(3);
    expect(parsed!.type).toBe("opus");
    expect(parsed!.timestamp).toBe(0); // 协议3无时间戳
    expect(parsed!.payload).toEqual(payload);
  });

  it("协议3 json 类型解析", () => {
    const payload = new Uint8Array([0x7b, 0x7d]);
    const data = buildProtocol3Data(1, Buffer.from(payload));
    const parsed = parseBinaryProtocol3(data);

    expect(parsed!.type).toBe("json");
  });

  it("载荷越界返回 null", () => {
    const data = Buffer.alloc(5); // 4字节头 + 1字节数据
    data[0] = 0;
    data[1] = 0;
    data.writeUInt16BE(10, 2); // 声称10字节但实际只有1字节
    expect(parseBinaryProtocol3(data)).toBeNull();
  });
});

describe("detectAudioProtocol", () => {
  it("检测协议2", () => {
    const payload = new Uint8Array([0x01]);
    const protocol2Data = encodeBinaryProtocol2(payload, 0);
    expect(detectAudioProtocol(protocol2Data)).toBe("protocol2");
  });

  it("检测协议3", () => {
    const header = Buffer.alloc(4);
    header[0] = 0; // opus type
    header[1] = 0; // reserved
    header.writeUInt16BE(2, 2); // payload size
    const protocol3Data = Buffer.concat([header, Buffer.from([0x01, 0x02])]);
    expect(detectAudioProtocol(protocol3Data)).toBe("protocol3");
  });

  it("检测协议1（Opus TOC）", () => {
    // 有效 Opus TOC：config=0（<12），channels=0，frame=0 → 单帧 10ms
    const opusData = Buffer.from([0x08, 0x00]); // config=1, channels=0, frame=0
    expect(detectAudioProtocol(opusData)).toBe("protocol1");
  });

  it("无法识别返回 unknown", () => {
    // 随机二进制数据，不匹配任何协议
    const randomData = Buffer.from([0xff, 0xfe, 0xfd, 0xfc]);
    expect(detectAudioProtocol(randomData)).toBe("unknown");
  });

  it("Opus TOC config 范围检查", () => {
    // config > 23 应该不是有效的 Opus 数据
    const invalidConfig = Buffer.from([
      (23 << 3) | 0, // config=23（最大有效值）
      0x00,
    ]);
    expect(detectAudioProtocol(invalidConfig)).toBe("protocol1");

    const outOfRangeConfig = Buffer.from([
      (24 << 3) | 0, // config=24（超出范围）
      0x00,
    ]);
    expect(detectAudioProtocol(outOfRangeConfig)).toBe("unknown");
  });

  it("极短数据（<2字节）返回 unknown", () => {
    expect(detectAudioProtocol(Buffer.alloc(1))).toBe("unknown");
    expect(detectAudioProtocol(Buffer.alloc(0))).toBe("unknown");
  });
});

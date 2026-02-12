/**
 * ESP32 音频协议测试
 * 测试 BinaryProtocol2 协议的字节序、编码、解码功能
 */

import { describe, expect, it, vi } from "vitest";
import {
  encodeBinaryProtocol2,
  isBinaryProtocol2,
  parseBinaryProtocol2,
} from "../audio-protocol.js";

// Mock logger
vi.mock("@/Logger.js", () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

describe("BinaryProtocol2 音频协议", () => {
  const PROTOCOL_HEADER_SIZE = 16;

  describe("字节序验证", () => {
    it("uint16 应使用大端序编码 [高位在前]", () => {
      // 协议版本 0x0002 在大端序中应该是 [0x00, 0x02]
      const payload = new Uint8Array([0x01, 0x02, 0x03]);
      const buffer = encodeBinaryProtocol2(payload, 0, "opus");

      // 检查版本字段（偏移 0-1）
      expect(buffer[0]).toBe(0x00); // 高位字节在前
      expect(buffer[1]).toBe(0x02); // 低位字节在后
    });

    it("uint32 应使用大端序编码 [高位在前]", () => {
      // 时间戳 0x12345678 在大端序中应该是 [0x12, 0x34, 0x56, 0x78]
      const timestamp = 0x12345678;
      const payload = new Uint8Array([0x01, 0x02, 0x03]);
      const buffer = encodeBinaryProtocol2(payload, timestamp, "opus");

      // 检查时间戳字段（偏移 8-11）
      expect(buffer[8]).toBe(0x12); // 最高位字节
      expect(buffer[9]).toBe(0x34);
      expect(buffer[10]).toBe(0x56);
      expect(buffer[11]).toBe(0x78); // 最低位字节
    });

    it("载荷大小应使用大端序编码", () => {
      // 载荷大小 256 (0x00000100) 在大端序中应该是 [0x00, 0x00, 0x01, 0x00]
      const payload = new Uint8Array(256).fill(0xab);
      const buffer = encodeBinaryProtocol2(payload, 0, "opus");

      // 检查载荷大小字段（偏移 12-15）
      expect(buffer[12]).toBe(0x00);
      expect(buffer[13]).toBe(0x00);
      expect(buffer[14]).toBe(0x01);
      expect(buffer[15]).toBe(0x00);
    });

    it("解析时应正确读取大端序 uint16", () => {
      // 手动构造大端序版本号 = 2
      const buffer = Buffer.alloc(20);
      buffer[0] = 0x00;
      buffer[1] = 0x02; // version = 2 (BE)
      buffer[2] = 0x00;
      buffer[3] = 0x00; // type = 0 (BE)
      buffer.writeUInt32BE(0, 4); // reserved
      buffer.writeUInt32BE(0, 8); // timestamp
      buffer.writeUInt32BE(4, 12); // payload size = 4
      buffer[16] = 0x01;
      buffer[17] = 0x02;
      buffer[18] = 0x03;
      buffer[19] = 0x04;

      const result = parseBinaryProtocol2(buffer);
      expect(result).not.toBeNull();
      expect(result!.protocolVersion).toBe(2);
    });

    it("解析时应正确读取大端序 uint32", () => {
      const timestamp = 0x12345678;
      const buffer = Buffer.alloc(20);
      buffer.writeUInt16BE(2, 0); // version = 2
      buffer.writeUInt16BE(0, 2); // type = 0
      buffer.writeUInt32BE(0, 4); // reserved
      buffer.writeUInt32BE(timestamp, 8); // timestamp
      buffer.writeUInt32BE(4, 12); // payload size = 4
      buffer[16] = 0x01;
      buffer[17] = 0x02;
      buffer[18] = 0x03;
      buffer[19] = 0x04;

      const result = parseBinaryProtocol2(buffer);
      expect(result).not.toBeNull();
      expect(result!.timestamp).toBe(timestamp);
    });
  });

  describe("parseBinaryProtocol2", () => {
    describe("正常解析", () => {
      it("应该正确解析有效的 Opus 数据包", () => {
        const payload = new Uint8Array([0x01, 0x02, 0x03, 0x04]);
        const buffer = encodeBinaryProtocol2(payload, 12345, "opus");

        const result = parseBinaryProtocol2(buffer);

        expect(result).not.toBeNull();
        expect(result!.protocolVersion).toBe(2);
        expect(result!.type).toBe("opus");
        expect(result!.timestamp).toBe(12345);
        expect(new Uint8Array(result!.payload)).toEqual(payload);
      });

      it("应该正确解析有效的 JSON 数据包", () => {
        const payload = new Uint8Array([0x7b, 0x7d]); // {}
        const buffer = encodeBinaryProtocol2(payload, 99999, "json");

        const result = parseBinaryProtocol2(buffer);

        expect(result).not.toBeNull();
        expect(result!.protocolVersion).toBe(2);
        expect(result!.type).toBe("json");
        expect(result!.timestamp).toBe(99999);
        expect(new Uint8Array(result!.payload)).toEqual(payload);
      });
    });

    describe("错误处理", () => {
      it("长度不足 16 字节应返回 null", () => {
        const shortBuffer = Buffer.alloc(15);
        const result = parseBinaryProtocol2(shortBuffer);
        expect(result).toBeNull();
      });

      it("空 buffer 应返回 null", () => {
        const emptyBuffer = Buffer.alloc(0);
        const result = parseBinaryProtocol2(emptyBuffer);
        expect(result).toBeNull();
      });

      it("版本号非 2 应返回 null", () => {
        const buffer = Buffer.alloc(20);
        buffer.writeUInt16BE(1, 0); // version = 1 (非2)
        buffer.writeUInt16BE(0, 2);
        buffer.writeUInt32BE(0, 4);
        buffer.writeUInt32BE(0, 8);
        buffer.writeUInt32BE(4, 12);

        const result = parseBinaryProtocol2(buffer);
        expect(result).toBeNull();
      });

      it("版本号为 0 应返回 null", () => {
        const buffer = Buffer.alloc(20);
        buffer.writeUInt16BE(0, 0); // version = 0
        buffer.writeUInt16BE(0, 2);
        buffer.writeUInt32BE(0, 4);
        buffer.writeUInt32BE(0, 8);
        buffer.writeUInt32BE(4, 12);

        const result = parseBinaryProtocol2(buffer);
        expect(result).toBeNull();
      });

      it("载荷大小与实际不符应返回 null", () => {
        const buffer = Buffer.alloc(20);
        buffer.writeUInt16BE(2, 0); // version = 2
        buffer.writeUInt16BE(0, 2);
        buffer.writeUInt32BE(0, 4);
        buffer.writeUInt32BE(0, 8);
        buffer.writeUInt32BE(100, 12); // 声明载荷 100 字节，实际只有 4 字节

        const result = parseBinaryProtocol2(buffer);
        expect(result).toBeNull();
      });
    });

    describe("类型映射", () => {
      it("type=0 应解析为 opus", () => {
        const buffer = Buffer.alloc(20);
        buffer.writeUInt16BE(2, 0);
        buffer.writeUInt16BE(0, 2); // type = 0
        buffer.writeUInt32BE(0, 4);
        buffer.writeUInt32BE(0, 8);
        buffer.writeUInt32BE(4, 12);
        buffer[16] = 0x01;

        const result = parseBinaryProtocol2(buffer);
        expect(result!.type).toBe("opus");
      });

      it("type=1 应解析为 json", () => {
        const buffer = Buffer.alloc(20);
        buffer.writeUInt16BE(2, 0);
        buffer.writeUInt16BE(1, 2); // type = 1
        buffer.writeUInt32BE(0, 4);
        buffer.writeUInt32BE(0, 8);
        buffer.writeUInt32BE(4, 12);
        buffer[16] = 0x01;

        const result = parseBinaryProtocol2(buffer);
        expect(result!.type).toBe("json");
      });

      it("type=2 应默认为 opus", () => {
        const buffer = Buffer.alloc(20);
        buffer.writeUInt16BE(2, 0);
        buffer.writeUInt16BE(2, 2); // type = 2 (未知类型)
        buffer.writeUInt32BE(0, 4);
        buffer.writeUInt32BE(0, 8);
        buffer.writeUInt32BE(4, 12);
        buffer[16] = 0x01;

        const result = parseBinaryProtocol2(buffer);
        expect(result!.type).toBe("opus");
      });

      it("type=255 应默认为 opus", () => {
        const buffer = Buffer.alloc(20);
        buffer.writeUInt16BE(2, 0);
        buffer.writeUInt16BE(255, 2); // type = 255
        buffer.writeUInt32BE(0, 4);
        buffer.writeUInt32BE(0, 8);
        buffer.writeUInt32BE(4, 12);
        buffer[16] = 0x01;

        const result = parseBinaryProtocol2(buffer);
        expect(result!.type).toBe("opus");
      });
    });
  });

  describe("encodeBinaryProtocol2", () => {
    describe("正常编码", () => {
      it("应该正确编码 Opus 类型数据包", () => {
        const payload = new Uint8Array([0x01, 0x02, 0x03, 0x04]);
        const timestamp = 12345;

        const buffer = encodeBinaryProtocol2(payload, timestamp, "opus");

        // 验证协议头
        expect(buffer.length).toBe(PROTOCOL_HEADER_SIZE + payload.length);
        expect(buffer.readUInt16BE(0)).toBe(2); // version
        expect(buffer.readUInt16BE(2)).toBe(0); // type = opus
        expect(buffer.readUInt32BE(4)).toBe(0); // reserved
        expect(buffer.readUInt32BE(8)).toBe(timestamp);
        expect(buffer.readUInt32BE(12)).toBe(payload.length);

        // 验证载荷
        expect(buffer.slice(16)).toEqual(Buffer.from(payload));
      });

      it("应该正确编码 JSON 类型数据包", () => {
        const payload = new Uint8Array([0x7b, 0x7d]); // {}
        const timestamp = 99999;

        const buffer = encodeBinaryProtocol2(payload, timestamp, "json");

        // 验证协议头
        expect(buffer.readUInt16BE(2)).toBe(1); // type = json
        expect(buffer.readUInt32BE(8)).toBe(timestamp);
        expect(buffer.readUInt32BE(12)).toBe(payload.length);

        // 验证载荷
        expect(buffer.slice(16)).toEqual(Buffer.from(payload));
      });
    });

    describe("时间戳处理", () => {
      it("时间戳超过 uint32 最大值应正确截断", () => {
        const payload = new Uint8Array([0x01]);
        const overflowTimestamp = 4294967296 + 123; // 2^32 + 123

        const buffer = encodeBinaryProtocol2(payload, overflowTimestamp, "opus");

        // 验证时间戳被模运算截断
        expect(buffer.readUInt32BE(8)).toBe(123);
      });

      it("时间戳等于 uint32 最大值应正常处理", () => {
        const payload = new Uint8Array([0x01]);
        const maxTimestamp = 4294967295; // 2^32 - 1

        const buffer = encodeBinaryProtocol2(payload, maxTimestamp, "opus");

        expect(buffer.readUInt32BE(8)).toBe(maxTimestamp);
      });

      it("时间戳为 0 应正常处理", () => {
        const payload = new Uint8Array([0x01]);
        const buffer = encodeBinaryProtocol2(payload, 0, "opus");

        expect(buffer.readUInt32BE(8)).toBe(0);
      });
    });

    describe("载荷处理", () => {
      it("空载荷应正常处理", () => {
        const payload = new Uint8Array(0);
        const buffer = encodeBinaryProtocol2(payload, 0, "opus");

        expect(buffer.length).toBe(PROTOCOL_HEADER_SIZE);
        expect(buffer.readUInt32BE(12)).toBe(0);
      });

      it("大载荷应正常处理", () => {
        const payload = new Uint8Array(65536).fill(0xab); // 64KB
        const buffer = encodeBinaryProtocol2(payload, 0, "opus");

        expect(buffer.length).toBe(PROTOCOL_HEADER_SIZE + 65536);
        expect(buffer.readUInt32BE(12)).toBe(65536);
        // 验证载荷数据
        for (let i = 0; i < 65536; i++) {
          expect(buffer[PROTOCOL_HEADER_SIZE + i]).toBe(0xab);
        }
      });

      it("1KB 载荷应正常处理", () => {
        const payload = new Uint8Array(1024).fill(0xcd);
        const buffer = encodeBinaryProtocol2(payload, 0, "opus");

        expect(buffer.length).toBe(PROTOCOL_HEADER_SIZE + 1024);
        expect(buffer.readUInt32BE(12)).toBe(1024);
      });
    });

    describe("保留字段", () => {
      it("保留字段应始终为 0", () => {
        const payload = new Uint8Array([0x01]);
        const buffer = encodeBinaryProtocol2(payload, 0, "opus");

        expect(buffer.readUInt32BE(4)).toBe(0);
      });
    });
  });

  describe("编码-解码往返", () => {
    it("Opus 数据包编码后解码应得到原始数据", () => {
      const originalPayload = new Uint8Array([
        0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08, 0x09,
      ]);
      const originalTimestamp = 1234567890;

      const encoded = encodeBinaryProtocol2(
        originalPayload,
        originalTimestamp,
        "opus"
      );
      const decoded = parseBinaryProtocol2(encoded);

      expect(decoded).not.toBeNull();
      expect(decoded!.protocolVersion).toBe(2);
      expect(decoded!.type).toBe("opus");
      expect(decoded!.timestamp).toBe(originalTimestamp);
      expect(new Uint8Array(decoded!.payload)).toEqual(originalPayload);
    });

    it("JSON 数据包编码后解码应得到原始数据", () => {
      const originalPayload = new Uint8Array([
        0x7b, 0x22, 0x74, 0x65, 0x73, 0x74, 0x22, 0x3a, 0x31, 0x7d,
      ]); // {"test":1}
      const originalTimestamp = 9876543210;

      const encoded = encodeBinaryProtocol2(
        originalPayload,
        originalTimestamp,
        "json"
      );
      const decoded = parseBinaryProtocol2(encoded);

      expect(decoded).not.toBeNull();
      expect(decoded!.type).toBe("json");
      expect(decoded!.timestamp).toBe(originalTimestamp % 4294967296); // 注意截断
      expect(new Uint8Array(decoded!.payload)).toEqual(originalPayload);
    });

    it("空载荷编码后解码应得到空载荷", () => {
      const originalPayload = new Uint8Array(0);
      const originalTimestamp = 0;

      const encoded = encodeBinaryProtocol2(
        originalPayload,
        originalTimestamp,
        "opus"
      );
      const decoded = parseBinaryProtocol2(encoded);

      expect(decoded).not.toBeNull();
      expect(decoded!.payload.length).toBe(0);
    });

    it("大载荷编码后解码应得到原始数据", () => {
      const originalPayload = new Uint8Array(16384); // 16KB
      for (let i = 0; i < originalPayload.length; i++) {
        originalPayload[i] = i % 256;
      }
      const originalTimestamp = 1000000;

      const encoded = encodeBinaryProtocol2(
        originalPayload,
        originalTimestamp,
        "opus"
      );
      const decoded = parseBinaryProtocol2(encoded);

      expect(decoded).not.toBeNull();
      expect(decoded!.payload.length).toBe(originalPayload.length);
      expect(new Uint8Array(decoded!.payload)).toEqual(originalPayload);
    });

    it("溢出时间戳往返应保持截断后的值", () => {
      const originalPayload = new Uint8Array([0x01, 0x02, 0x03]);
      const overflowTimestamp = 4294967296 + 999; // 2^32 + 999
      const expectedTimestamp = 999; // 截断后的值

      const encoded = encodeBinaryProtocol2(
        originalPayload,
        overflowTimestamp,
        "opus"
      );
      const decoded = parseBinaryProtocol2(encoded);

      expect(decoded!.timestamp).toBe(expectedTimestamp);
    });
  });

  describe("isBinaryProtocol2", () => {
    it("有效协议数据应返回 true", () => {
      const payload = new Uint8Array([0x01, 0x02, 0x03]);
      const buffer = encodeBinaryProtocol2(payload, 0, "opus");

      expect(isBinaryProtocol2(buffer)).toBe(true);
    });

    it("版本号错误应返回 false", () => {
      const buffer = Buffer.alloc(16);
      buffer.writeUInt16BE(1, 0); // version = 1

      expect(isBinaryProtocol2(buffer)).toBe(false);
    });

    it("长度不足应返回 false", () => {
      const buffer = Buffer.alloc(15);

      expect(isBinaryProtocol2(buffer)).toBe(false);
    });

    it("空 buffer 应返回 false", () => {
      const buffer = Buffer.alloc(0);

      expect(isBinaryProtocol2(buffer)).toBe(false);
    });

    it("版本号为 0 应返回 false", () => {
      const buffer = Buffer.alloc(16);
      buffer.writeUInt16BE(0, 0); // version = 0

      expect(isBinaryProtocol2(buffer)).toBe(false);
    });

    it("版本号为 3 应返回 false", () => {
      const buffer = Buffer.alloc(16);
      buffer.writeUInt16BE(3, 0); // version = 3

      expect(isBinaryProtocol2(buffer)).toBe(false);
    });
  });

  describe("边界场景", () => {
    it("最小有效数据包（仅协议头+1字节载荷）", () => {
      const payload = new Uint8Array([0xff]);
      const buffer = encodeBinaryProtocol2(payload, 0, "opus");

      expect(buffer.length).toBe(17); // 16 + 1

      const decoded = parseBinaryProtocol2(buffer);
      expect(decoded).not.toBeNull();
      expect(new Uint8Array(decoded!.payload)).toEqual(payload);
    });

    it("载荷恰好填满缓冲区", () => {
      const payloadSize = 100;
      const payload = new Uint8Array(payloadSize);
      const buffer = encodeBinaryProtocol2(payload, 0, "opus");

      // 尝试解析精确长度的缓冲区
      const decoded = parseBinaryProtocol2(buffer);
      expect(decoded).not.toBeNull();
      expect(decoded!.payload.length).toBe(payloadSize);
    });

    it("解析比预期更大的缓冲区（多余数据应被忽略）", () => {
      const payload = new Uint8Array([0x01, 0x02, 0x03]);
      const encoded = encodeBinaryProtocol2(payload, 0, "opus");

      // 在编码后追加额外数据
      const largerBuffer = Buffer.concat([
        encoded,
        Buffer.from([0x99, 0x99, 0x99]),
      ]);

      const decoded = parseBinaryProtocol2(largerBuffer);
      expect(decoded).not.toBeNull();
      expect(decoded!.payload.length).toBe(3);
      expect(new Uint8Array(decoded!.payload)).toEqual(payload);
    });

    it("负数时间戳应抛出错误", () => {
      const payload = new Uint8Array([0x01]);
      // JavaScript 中负数取模结果为负数，writeUInt32BE 无法处理负数
      const negativeTimestamp = -1;

      // 负数时间戳不在实际使用场景中，验证它会抛出错误
      expect(() =>
        encodeBinaryProtocol2(payload, negativeTimestamp, "opus")
      ).toThrow(RangeError);
    });
  });

  describe("协议完整性验证", () => {
    it("完整协议包结构验证", () => {
      const payload = new Uint8Array([0xde, 0xad, 0xbe, 0xef]);
      const timestamp = 0x11223344;
      const buffer = encodeBinaryProtocol2(payload, timestamp, "json");

      // 验证完整的协议包结构
      // 偏移 0-1: version (uint16 BE)
      expect(buffer[0]).toBe(0x00);
      expect(buffer[1]).toBe(0x02);

      // 偏移 2-3: type (uint16 BE) = 1 for json
      expect(buffer[2]).toBe(0x00);
      expect(buffer[3]).toBe(0x01);

      // 偏移 4-7: reserved (uint32 BE)
      expect(buffer[4]).toBe(0x00);
      expect(buffer[5]).toBe(0x00);
      expect(buffer[6]).toBe(0x00);
      expect(buffer[7]).toBe(0x00);

      // 偏移 8-11: timestamp (uint32 BE)
      expect(buffer[8]).toBe(0x11);
      expect(buffer[9]).toBe(0x22);
      expect(buffer[10]).toBe(0x33);
      expect(buffer[11]).toBe(0x44);

      // 偏移 12-15: payload_size (uint32 BE)
      expect(buffer[12]).toBe(0x00);
      expect(buffer[13]).toBe(0x00);
      expect(buffer[14]).toBe(0x00);
      expect(buffer[15]).toBe(0x04);

      // 偏移 16+: payload
      expect(buffer[16]).toBe(0xde);
      expect(buffer[17]).toBe(0xad);
      expect(buffer[18]).toBe(0xbe);
      expect(buffer[19]).toBe(0xef);
    });
  });
});

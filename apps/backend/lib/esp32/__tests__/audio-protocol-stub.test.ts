/**
 * audio-protocol-stub 单元测试
 * 测试 ESP32 协议存根实现（用于兼容性）
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  encodeBinaryProtocol2,
  isBinaryProtocol2,
  parseBinaryProtocol2,
  type BinaryProtocol2Parsed,
} from "../audio-protocol-stub.js";

describe("audio-protocol-stub 存根实现", () => {
  describe("isBinaryProtocol2", () => {
    it("应该始终返回 false（存根实现）", () => {
      const testBuffer = Buffer.from([0x00, 0x02, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00]);

      const result = isBinaryProtocol2(testBuffer);

      expect(result).toBe(false);
    });

    it("应该对空数据返回 false", () => {
      const result = isBinaryProtocol2(Buffer.alloc(0));

      expect(result).toBe(false);
    });

    it("应该对任意数据返回 false", () => {
      const randomData = Buffer.from([0xFF, 0x00, 0xAA, 0x55]);

      const result = isBinaryProtocol2(randomData);

      expect(result).toBe(false);
    });
  });

  describe("parseBinaryProtocol2", () => {
    it("应该始终返回 null（存根实现）", () => {
      const testBuffer = Buffer.from([0x00, 0x02, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00]);

      const result = parseBinaryProtocol2(testBuffer);

      expect(result).toBeNull();
    });

    it("应该对空数据返回 null", () => {
      const result = parseBinaryProtocol2(Buffer.alloc(0));

      expect(result).toBeNull();
    });

    it("应该对有效格式返回 null（存根不解析）", () => {
      // 构造看起来有效的 Protocol2 数据
      const buffer = Buffer.alloc(20);
      buffer.writeUInt16BE(2, 0); // 版本
      buffer.writeUInt16BE(0, 2); // 类型 opus
      buffer.writeUInt32BE(0, 4); // 保留字段
      buffer.writeUInt32BE(1000, 8); // 时间戳
      buffer.writeUInt32BE(4, 12); // 载荷大小

      const result = parseBinaryProtocol2(buffer);

      expect(result).toBeNull();
    });
  });

  describe("encodeBinaryProtocol2", () => {
    it("应该返回空 Buffer（存根实现）", () => {
      const payload = new Uint8Array([0x01, 0x02, 0x03]);
      const timestamp = 1000;

      const result = encodeBinaryProtocol2(payload, timestamp, "opus");

      expect(result).toBeInstanceOf(Buffer);
      expect(result.length).toBe(0);
    });

    it("应该对 JSON 类型返回空 Buffer", () => {
      const payload = new Uint8Array([0x7b, 0x7d]);
      const timestamp = 2000;

      const result = encodeBinaryProtocol2(payload, timestamp, "json");

      expect(result).toBeInstanceOf(Buffer);
      expect(result.length).toBe(0);
    });

    it("应该对空载荷返回空 Buffer", () => {
      const payload = new Uint8Array([]);

      const result = encodeBinaryProtocol2(payload, 0, "opus");

      expect(result).toBeInstanceOf(Buffer);
      expect(result.length).toBe(0);
    });

    it("应该对大载荷返回空 Buffer", () => {
      const payload = new Uint8Array(10000).fill(0xAB);

      const result = encodeBinaryProtocol2(payload, 5000, "opus");

      expect(result).toBeInstanceOf(Buffer);
      expect(result.length).toBe(0);
    });

    it("应该在省略类型参数时返回空 Buffer", () => {
      const payload = new Uint8Array([0x01]);

      const result = encodeBinaryProtocol2(payload, 1000);

      expect(result).toBeInstanceOf(Buffer);
      expect(result.length).toBe(0);
    });
  });

  describe("存根行为一致性", () => {
    it("所有函数都应该不抛出异常", () => {
      const testBuffer = Buffer.from([0x01, 0x02]);
      const payload = new Uint8Array([0x03, 0x04]);

      expect(() => {
        isBinaryProtocol2(testBuffer);
        parseBinaryProtocol2(testBuffer);
        encodeBinaryProtocol2(payload, 1000, "opus");
      }).not.toThrow();
    });

    it("所有函数都应该返回稳定的结果", () => {
      const testBuffer = Buffer.from([0x01, 0x02]);
      const payload = new Uint8Array([0x03]);

      // 多次调用应该返回相同的结果
      expect(isBinaryProtocol2(testBuffer)).toBe(false);
      expect(isBinaryProtocol2(testBuffer)).toBe(false);

      expect(parseBinaryProtocol2(testBuffer)).toBeNull();
      expect(parseBinaryProtocol2(testBuffer)).toBeNull();

      const result1 = encodeBinaryProtocol2(payload, 1000);
      const result2 = encodeBinaryProtocol2(payload, 1000);
      expect(result1.equals(result2)).toBe(true);
    });
  });

  describe("类型兼容性", () => {
    it("返回值应该符合类型定义", () => {
      const testBuffer = Buffer.from([0x01, 0x02]);
      const payload = new Uint8Array([0x03]);

      // isBinaryProtocol2 返回 boolean
      const isResult: boolean = isBinaryProtocol2(testBuffer);
      expect(typeof isResult).toBe("boolean");

      // parseBinaryProtocol2 返回 BinaryProtocol2Parsed | null
      const parseResult: BinaryProtocol2Parsed | null = parseBinaryProtocol2(
        testBuffer
      );
      expect(parseResult).toBeNull();

      // encodeBinaryProtocol2 返回 Buffer
      const encodeResult: Buffer = encodeBinaryProtocol2(payload, 1000);
      expect(encodeResult).toBeInstanceOf(Buffer);
    });
  });
});

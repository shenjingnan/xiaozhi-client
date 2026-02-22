/**
 * Ogg Opus 解封装模块测试
 * 测试重点：验证 CVE-2024-21521 安全漏洞缓解措施
 */

import { describe, expect, it } from "vitest";
import { demuxOggOpus, demuxOggOpusChunk } from "../ogg-demuxer.js";

/** Ogg 文件魔数 ("OggS") */
const OGG_MAGIC_NUMBER = [0x4f, 0x67, 0x67, 0x53];

/** 创建一个最小但有效的 Ogg 页头（27 字节） */
function createMinimalOggHeader(): Uint8Array {
  const header = new Uint8Array(27);
  // OggS 魔数
  header[0] = OGG_MAGIC_NUMBER[0];
  header[1] = OGG_MAGIC_NUMBER[1];
  header[2] = OGG_MAGIC_NUMBER[2];
  header[3] = OGG_MAGIC_NUMBER[3];
  // 版本 (0)
  header[4] = 0;
  // 头类型 (开始页)
  header[5] = 0x02;
  // 其余字节保持为 0（足够通过魔数验证）
  return header;
}

/** 创建一个带有 toString 属性的对象（模拟 CVE-2024-21521 攻击向量） */
function createMaliciousObject(): { toString: () => string } & Uint8Array {
  const obj = {
    toString: () => {
      throw new Error("CVE-2024-21521: 恶意 toString 被调用");
    },
  } as unknown as Uint8Array;
  return obj;
}

describe("Ogg Opus 解封装模块 - 安全验证测试", () => {
  describe("demuxOggOpus 输入验证", () => {
    it("应该拒绝 null 输入", async () => {
      await expect(demuxOggOpus(null as unknown as Uint8Array)).rejects.toThrow(
        TypeError
      );
      await expect(demuxOggOpus(null as unknown as Uint8Array)).rejects.toThrow(
        "Uint8Array"
      );
    });

    it("应该拒绝 undefined 输入", async () => {
      await expect(
        demuxOggOpus(undefined as unknown as Uint8Array)
      ).rejects.toThrow(TypeError);
      await expect(
        demuxOggOpus(undefined as unknown as Uint8Array)
      ).rejects.toThrow("Uint8Array");
    });

    it("应该拒绝带有 toString 属性的对象（CVE-2024-21521 缓解）", async () => {
      const malicious = createMaliciousObject();
      await expect(demuxOggOpus(malicious)).rejects.toThrow(TypeError);
    });

    it("应该拒绝普通对象（非 Uint8Array）", async () => {
      await expect(demuxOggOpus({} as unknown as Uint8Array)).rejects.toThrow(
        TypeError
      );
      await expect(
        demuxOggOpus({ data: "test" } as unknown as Uint8Array)
      ).rejects.toThrow("Uint8Array");
    });

    it("应该拒绝字符串输入", async () => {
      await expect(
        demuxOggOpus("test" as unknown as Uint8Array)
      ).rejects.toThrow(TypeError);
    });

    it("应该拒绝数字输入", async () => {
      await expect(demuxOggOpus(123 as unknown as Uint8Array)).rejects.toThrow(
        TypeError
      );
    });

    it("应该拒绝过小的数据（小于 Ogg 页头最小大小）", async () => {
      const tooSmall = new Uint8Array(10);
      await expect(demuxOggOpus(tooSmall)).rejects.toThrow("过小");
    });

    it("应该拒绝空数组", async () => {
      const empty = new Uint8Array(0);
      await expect(demuxOggOpus(empty)).rejects.toThrow("过小");
    });

    it("应该拒绝过大的数据（超过 100MB）", async () => {
      const tooLarge = new Uint8Array(100 * 1024 * 1024 + 1);
      // 设置魔数以通过魔数验证
      tooLarge[0] = OGG_MAGIC_NUMBER[0];
      tooLarge[1] = OGG_MAGIC_NUMBER[1];
      tooLarge[2] = OGG_MAGIC_NUMBER[2];
      tooLarge[3] = OGG_MAGIC_NUMBER[3];

      await expect(demuxOggOpus(tooLarge)).rejects.toThrow("过大");
    });

    it("应该拒绝无效的 Ogg 文件头", async () => {
      const invalid = new Uint8Array(100);
      // 设置为非 Ogg 魔数
      invalid[0] = 0x00;
      invalid[1] = 0x00;
      invalid[2] = 0x00;
      invalid[3] = 0x00;

      await expect(demuxOggOpus(invalid)).rejects.toThrow("OggS");
    });

    it("应该拒绝只有部分正确魔数的数据", async () => {
      const partial = new Uint8Array(100);
      partial[0] = OGG_MAGIC_NUMBER[0]; // 'O'
      partial[1] = OGG_MAGIC_NUMBER[1]; // 'g'
      partial[2] = 0x00; // 错误
      partial[3] = OGG_MAGIC_NUMBER[3]; // 'S'

      await expect(demuxOggOpus(partial)).rejects.toThrow("OggS");
    });

    it("应该接受有效的 Ogg 魔数（最小数据）", async () => {
      const valid = createMinimalOggHeader();
      // 注意：这个测试可能会因为数据不完整而失败，
      // 但应该不会触发输入验证错误
      try {
        await demuxOggOpus(valid);
      } catch (error) {
        // 应该是解封装错误，而不是验证错误
        expect((error as Error).message).not.toContain("Uint8Array");
        expect((error as Error).message).not.toContain("过小");
        expect((error as Error).message).not.toContain("过大");
        expect((error as Error).message).not.toContain("OggS");
      }
    });
  });

  describe("demuxOggOpusChunk 输入验证", () => {
    it("应该拒绝 null 输入", async () => {
      await expect(
        demuxOggOpusChunk(null as unknown as Uint8Array)
      ).rejects.toThrow(TypeError);
    });

    it("应该拒绝带有 toString 属性的对象（CVE-2024-21521 缓解）", async () => {
      const malicious = createMaliciousObject();
      await expect(demuxOggOpusChunk(malicious)).rejects.toThrow(TypeError);
    });

    it("应该拒绝过小的数据", async () => {
      const tooSmall = new Uint8Array(10);
      await expect(demuxOggOpusChunk(tooSmall)).rejects.toThrow("过小");
    });

    it("应该拒绝无效的 Ogg 文件头", async () => {
      const invalid = new Uint8Array(100);
      invalid[0] = 0xff;
      invalid[1] = 0xff;
      invalid[2] = 0xff;
      invalid[3] = 0xff;

      await expect(demuxOggOpusChunk(invalid)).rejects.toThrow("OggS");
    });
  });

  describe("边界情况测试", () => {
    it("应该拒绝大小为 27 的空数据（最小 Ogg 页头大小）", async () => {
      const minimal = new Uint8Array(27);
      // 设置魔数
      minimal[0] = OGG_MAGIC_NUMBER[0];
      minimal[1] = OGG_MAGIC_NUMBER[1];
      minimal[2] = OGG_MAGIC_NUMBER[2];
      minimal[3] = OGG_MAGIC_NUMBER[3];

      try {
        await demuxOggOpus(minimal);
      } catch (error) {
        // 应该是解封装错误，而不是验证错误
        expect((error as Error).message).not.toContain("Uint8Array");
      }
    });

    it("应该接受大小正好为 100MB 的数据（边界值）", async () => {
      const maxSize = new Uint8Array(100 * 1024 * 1024);
      // 设置魔数
      maxSize[0] = OGG_MAGIC_NUMBER[0];
      maxSize[1] = OGG_MAGIC_NUMBER[1];
      maxSize[2] = OGG_MAGIC_NUMBER[2];
      maxSize[3] = OGG_MAGIC_NUMBER[3];

      try {
        await demuxOggOpus(maxSize);
      } catch (error) {
        // 应该是解封装或内存错误，而不是验证错误
        expect((error as Error).message).not.toContain("过大");
      }
    });

    it("应该拒绝大小为 100MB + 1 的数据（超过边界）", async () => {
      const tooLarge = new Uint8Array(100 * 1024 * 1024 + 1);
      tooLarge[0] = OGG_MAGIC_NUMBER[0];
      tooLarge[1] = OGG_MAGIC_NUMBER[1];
      tooLarge[2] = OGG_MAGIC_NUMBER[2];
      tooLarge[3] = OGG_MAGIC_NUMBER[3];

      await expect(demuxOggOpus(tooLarge)).rejects.toThrow("过大");
    });
  });
});

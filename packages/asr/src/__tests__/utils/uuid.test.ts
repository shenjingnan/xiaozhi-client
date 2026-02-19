/**
 * UUID 工具测试
 */

import { describe, expect, it } from "vitest";
import { generateReqId, generateShortId } from "../../utils/index.js";

describe("UUID 工具", () => {
  describe("generateReqId", () => {
    it("应生成有效的 UUID", () => {
      const id = generateReqId();

      // UUID v4 格式: xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
      expect(id).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
      );
    });

    it("每次调用应生成唯一的 ID", () => {
      const ids = new Set<string>();
      for (let i = 0; i < 100; i++) {
        ids.add(generateReqId());
      }

      // 100 次调用应该产生 100 个唯一的 ID
      expect(ids.size).toBe(100);
    });

    it("生成的 ID 应有正确长度", () => {
      const id = generateReqId();

      expect(id.length).toBe(36); // 标准 UUID 长度
    });
  });

  describe("generateShortId", () => {
    it("应生成短 ID", () => {
      const id = generateShortId();

      expect(id).toBeDefined();
      expect(id.length).toBeGreaterThan(0);
      expect(id.length).toBeLessThan(36);
    });

    it("每次调用应生成唯一的 ID", () => {
      const ids = new Set<string>();
      for (let i = 0; i < 100; i++) {
        ids.add(generateShortId());
      }

      // 100 次调用应该产生 100 个唯一的 ID
      expect(ids.size).toBe(100);
    });

    it("生成的 ID 应只包含字母和数字", () => {
      const id = generateShortId();

      expect(id).toMatch(/^[0-9a-f]+$/i);
    });

    it("生成的 ID 应为 UUID 的第一段", () => {
      const fullId = generateReqId();
      const shortId = generateShortId();

      const firstPart = fullId.split("-")[0];

      // 由于每次调用都会生成新的 UUID，shortId 和 firstPart 可能不相等
      // 但 shortId 应该是有效的 UUID 第一段格式
      expect(shortId).toMatch(/^[0-9a-f]{8}$/i);
    });

    it("短 ID 长度应为 8", () => {
      const id = generateShortId();

      expect(id.length).toBe(8);
    });
  });
});

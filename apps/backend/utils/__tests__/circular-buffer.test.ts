import { beforeEach, describe, expect, it } from "vitest";
import { CircularBuffer } from "../circular-buffer.js";

describe("CircularBuffer", () => {
  let buffer: CircularBuffer<number>;

  beforeEach(() => {
    buffer = new CircularBuffer<number>(5);
  });

  describe("constructor", () => {
    it("应该创建指定容量的缓冲区", () => {
      expect(buffer.getCapacity()).toBe(5);
      expect(buffer.getSize()).toBe(0);
      expect(buffer.isEmpty()).toBe(true);
      expect(buffer.isFull()).toBe(false);
    });
  });

  describe("push", () => {
    it("应该添加元素到空缓冲区", () => {
      buffer.push(1);
      expect(buffer.getSize()).toBe(1);
      expect(buffer.isEmpty()).toBe(false);
      expect(buffer.peekFirst()).toBe(1);
      expect(buffer.peekLast()).toBe(1);
    });

    it("应该按顺序添加多个元素", () => {
      buffer.push(1);
      buffer.push(2);
      buffer.push(3);
      expect(buffer.getSize()).toBe(3);
      expect(buffer.peekFirst()).toBe(1);
      expect(buffer.peekLast()).toBe(3);
    });

    it("应该在缓冲区满时自动覆盖最旧元素", () => {
      buffer.push(1);
      buffer.push(2);
      buffer.push(3);
      buffer.push(4);
      buffer.push(5);
      expect(buffer.isFull()).toBe(true);
      expect(buffer.peekFirst()).toBe(1);
      expect(buffer.peekLast()).toBe(5);

      // 添加第 6 个元素，应该覆盖第 1 个元素
      buffer.push(6);
      expect(buffer.getSize()).toBe(5);
      expect(buffer.peekFirst()).toBe(2); // 最旧元素现在是 2
      expect(buffer.peekLast()).toBe(6);
    });

    it("应该正确处理连续覆盖多个元素", () => {
      // 填满缓冲区
      for (let i = 1; i <= 5; i++) {
        buffer.push(i);
      }

      // 覆盖 3 个元素
      buffer.push(6);
      buffer.push(7);
      buffer.push(8);

      expect(buffer.toArray()).toEqual([3, 4, 5, 6, 7, 8].slice(1)); // [4, 5, 6, 7, 8]
      // 修正预期：应该是 [3, 4, 5, 6, 7, 8] 的最后 5 个，即 [4, 5, 6, 7, 8]
      // 但实际上覆盖后应该是：push(6) 后是 [2,3,4,5,6], push(7) 后是 [3,4,5,6,7], push(8) 后是 [4,5,6,7,8]
      expect(buffer.toArray()).toEqual([4, 5, 6, 7, 8]);
    });
  });

  describe("popFirst", () => {
    it("应该从空缓冲区返回 undefined", () => {
      expect(buffer.popFirst()).toBeUndefined();
      expect(buffer.getSize()).toBe(0);
    });

    it("应该移除并返回最旧的元素", () => {
      buffer.push(1);
      buffer.push(2);
      buffer.push(3);

      const first = buffer.popFirst();
      expect(first).toBe(1);
      expect(buffer.getSize()).toBe(2);
      expect(buffer.peekFirst()).toBe(2);
    });

    it("应该正确处理连续 popFirst", () => {
      buffer.push(1);
      buffer.push(2);
      buffer.push(3);

      expect(buffer.popFirst()).toBe(1);
      expect(buffer.popFirst()).toBe(2);
      expect(buffer.popFirst()).toBe(3);
      expect(buffer.isEmpty()).toBe(true);
    });
  });

  describe("peekFirst 和 peekLast", () => {
    it("应该从空缓冲区返回 undefined", () => {
      expect(buffer.peekFirst()).toBeUndefined();
      expect(buffer.peekLast()).toBeUndefined();
    });

    it("应该正确返回第一个和最后一个元素", () => {
      buffer.push(1);
      buffer.push(2);
      buffer.push(3);

      expect(buffer.peekFirst()).toBe(1);
      expect(buffer.peekLast()).toBe(3);
    });

    it("应该在单个元素时返回相同的值", () => {
      buffer.push(42);
      expect(buffer.peekFirst()).toBe(42);
      expect(buffer.peekLast()).toBe(42);
    });
  });

  describe("toArray", () => {
    it("应该返回空数组", () => {
      expect(buffer.toArray()).toEqual([]);
    });

    it("应该按顺序返回所有元素", () => {
      buffer.push(1);
      buffer.push(2);
      buffer.push(3);
      expect(buffer.toArray()).toEqual([1, 2, 3]);
    });

    it("应该在覆盖元素后正确返回", () => {
      // 填满并覆盖
      for (let i = 1; i <= 7; i++) {
        buffer.push(i);
      }
      // 缓冲区容量 5，应该保留最后 5 个元素
      expect(buffer.toArray()).toEqual([3, 4, 5, 6, 7]);
    });
  });

  describe("迭代器", () => {
    it("应该支持 for-of 迭代", () => {
      buffer.push(1);
      buffer.push(2);
      buffer.push(3);

      const result: number[] = [];
      for (const item of buffer) {
        result.push(item);
      }
      expect(result).toEqual([1, 2, 3]);
    });

    it("应该在空缓冲区时不产生任何元素", () => {
      const result: number[] = [];
      for (const item of buffer) {
        result.push(item);
      }
      expect(result).toEqual([]);
    });
  });

  describe("clear", () => {
    it("应该清空缓冲区", () => {
      buffer.push(1);
      buffer.push(2);
      buffer.push(3);

      buffer.clear();
      expect(buffer.isEmpty()).toBe(true);
      expect(buffer.getSize()).toBe(0);
      expect(buffer.toArray()).toEqual([]);
    });

    it("应该允许清空后重新添加元素", () => {
      buffer.push(1);
      buffer.clear();
      buffer.push(2);
      expect(buffer.getSize()).toBe(1);
      expect(buffer.peekFirst()).toBe(2);
    });
  });

  describe("边界情况", () => {
    it("应该正确处理容量为 1 的缓冲区", () => {
      const smallBuffer = new CircularBuffer<number>(1);
      smallBuffer.push(1);
      expect(smallBuffer.isFull()).toBe(true);
      expect(smallBuffer.peekFirst()).toBe(1);

      smallBuffer.push(2);
      expect(smallBuffer.getSize()).toBe(1);
      expect(smallBuffer.peekFirst()).toBe(2);
    });

    it("应该正确处理大量元素的连续操作", () => {
      const largeBuffer = new CircularBuffer<number>(100);

      // 添加 200 个元素
      for (let i = 0; i < 200; i++) {
        largeBuffer.push(i);
      }

      // 应该保留最后 100 个元素
      expect(largeBuffer.getSize()).toBe(100);
      expect(largeBuffer.peekFirst()).toBe(100);
      expect(largeBuffer.peekLast()).toBe(199);

      // 移除 50 个元素
      for (let i = 0; i < 50; i++) {
        largeBuffer.popFirst();
      }

      expect(largeBuffer.getSize()).toBe(50);
      expect(largeBuffer.peekFirst()).toBe(150);
    });
  });

  describe("性能特性", () => {
    it("push 操作应该是 O(1)", () => {
      // 添加大量元素测试性能
      const start = Date.now();
      for (let i = 0; i < 10000; i++) {
        buffer.push(i);
      }
      const elapsed = Date.now() - start;

      // 10000 次 push 应该在 100ms 内完成
      expect(elapsed).toBeLessThan(100);
    });

    it("popFirst 操作应该是 O(1)", () => {
      // 填满缓冲区
      for (let i = 0; i < 5; i++) {
        buffer.push(i);
      }

      const start = Date.now();
      while (!buffer.isEmpty()) {
        buffer.popFirst();
      }
      const elapsed = Date.now() - start;

      // 5 次 popFirst 应该在 10ms 内完成
      expect(elapsed).toBeLessThan(10);
    });
  });
});

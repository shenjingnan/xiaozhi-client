/**
 * AudioBuffer 单元测试
 */

import { describe, expect, it, beforeEach, vi } from "vitest";
import { AudioBuffer, BufferFullError } from "@/audio/AudioBuffer.js";

describe("AudioBuffer", () => {
  let buffer: AudioBuffer;

  beforeEach(() => {
    buffer = new AudioBuffer({ maxBufferSize: 1024 });
  });

  describe("基础功能", () => {
    it("应该正确推入和取出数据", () => {
      const data = Buffer.from("hello");
      buffer.push(data);
      expect(buffer.shift()).toEqual(data);
    });

    it("应该按 FIFO 顺序取出数据", () => {
      const data1 = Buffer.from("first");
      const data2 = Buffer.from("second");
      const data3 = Buffer.from("third");

      buffer.push(data1);
      buffer.push(data2);
      buffer.push(data3);

      expect(buffer.shift()).toEqual(data1);
      expect(buffer.shift()).toEqual(data2);
      expect(buffer.shift()).toEqual(data3);
    });

    it("应该返回 undefined 当缓冲区为空时", () => {
      expect(buffer.shift()).toBeUndefined();
    });

    it("应该正确追踪当前缓冲区大小", () => {
      expect(buffer.size()).toBe(0);

      buffer.push(Buffer.alloc(100));
      expect(buffer.size()).toBe(100);

      buffer.push(Buffer.alloc(200));
      expect(buffer.size()).toBe(300);

      buffer.shift();
      expect(buffer.size()).toBe(200);
    });

    it("应该正确追踪数据块数量", () => {
      expect(buffer.length()).toBe(0);

      buffer.push(Buffer.alloc(100));
      expect(buffer.length()).toBe(1);

      buffer.push(Buffer.alloc(100));
      buffer.push(Buffer.alloc(100));
      expect(buffer.length()).toBe(3);

      buffer.shift();
      expect(buffer.length()).toBe(2);
    });
  });

  describe("容量限制", () => {
    it("应该在缓冲区满时抛出 BufferFullError", () => {
      const smallBuffer = new AudioBuffer({ maxBufferSize: 100 });

      smallBuffer.push(Buffer.alloc(50));
      smallBuffer.push(Buffer.alloc(30));

      expect(() => {
        smallBuffer.push(Buffer.alloc(30)); // 总共 110 > 100
      }).toThrow(BufferFullError);
    });

    it("应该正确报告 isFull 状态", () => {
      const smallBuffer = new AudioBuffer({ maxBufferSize: 100 });

      expect(smallBuffer.isFull()).toBe(false);

      smallBuffer.push(Buffer.alloc(100));
      expect(smallBuffer.isFull()).toBe(true);

      smallBuffer.shift();
      expect(smallBuffer.isFull()).toBe(false);
    });

    it("BufferFullError 应包含当前大小和最大大小", () => {
      const smallBuffer = new AudioBuffer({ maxBufferSize: 100 });
      smallBuffer.push(Buffer.alloc(80));

      try {
        smallBuffer.push(Buffer.alloc(50));
        expect.fail("应该抛出 BufferFullError");
      } catch (error) {
        expect(error).toBeInstanceOf(BufferFullError);
        expect((error as BufferFullError).currentSize).toBe(80);
        expect((error as BufferFullError).maxSize).toBe(100);
      }
    });
  });

  describe("状态检查", () => {
    it("应该正确返回状态信息", () => {
      expect(buffer.getState()).toEqual({
        currentSize: 0,
        chunkCount: 0,
        ended: false,
        full: false,
      });

      buffer.push(Buffer.alloc(100));
      expect(buffer.getState()).toEqual({
        currentSize: 100,
        chunkCount: 1,
        ended: false,
        full: false,
      });
    });

    it("应该正确检查是否为空", () => {
      expect(buffer.isEmpty()).toBe(true);

      buffer.push(Buffer.alloc(100));
      expect(buffer.isEmpty()).toBe(false);

      buffer.shift();
      expect(buffer.isEmpty()).toBe(true);
    });
  });

  describe("结束标记", () => {
    it("应该在结束后无法推入数据", () => {
      buffer.end();

      expect(() => {
        buffer.push(Buffer.from("test"));
      }).toThrow("缓冲区已结束，无法推入更多数据");
    });

    it("应该正确追踪结束状态", () => {
      expect(buffer.isEnded()).toBe(false);

      buffer.end();
      expect(buffer.isEnded()).toBe(true);
    });

    it("结束后仍可取出数据", () => {
      const data = Buffer.from("test");
      buffer.push(data);
      buffer.end();

      expect(buffer.shift()).toEqual(data);
    });

    it("结束后状态应显示已结束", () => {
      buffer.end();

      expect(buffer.getState().ended).toBe(true);
    });
  });

  describe("peek 操作", () => {
    it("应该查看最早的数据块但不移除", () => {
      const data1 = Buffer.from("first");
      const data2 = Buffer.from("second");

      buffer.push(data1);
      buffer.push(data2);

      expect(buffer.peek()).toEqual(data1);
      expect(buffer.length()).toBe(2);
    });

    it("应该在缓冲区为空时返回 undefined", () => {
      expect(buffer.peek()).toBeUndefined();
    });
  });

  describe("异步等待", () => {
    it("应该在有数据时立即返回", async () => {
      buffer.push(Buffer.alloc(100));

      const startTime = Date.now();
      await buffer.waitForData();
      const elapsed = Date.now() - startTime;

      expect(elapsed).toBeLessThan(10);
    });

    it("应该在结束后立即返回", async () => {
      buffer.end();

      const startTime = Date.now();
      await buffer.waitForData();
      const elapsed = Date.now() - startTime;

      expect(elapsed).toBeLessThan(10);
    });

    it("应该等待直到有数据可用", async () => {
      let resolved = false;

      // 启动异步等待
      const waitPromise = buffer.waitForData().then(() => {
        resolved = true;
      });

      // 等待一小段时间确保 Promise 在等待
      await new Promise((resolve) => setTimeout(resolve, 10));
      expect(resolved).toBe(false);

      // 推入数据
      buffer.push(Buffer.alloc(100));

      // 等待 Promise 解析
      await waitPromise;
      expect(resolved).toBe(true);
    });

    it("应该同时通知所有等待者", async () => {
      const waiters = [
        buffer.waitForData(),
        buffer.waitForData(),
        buffer.waitForData(),
      ];

      // 推入数据应该触发所有等待者
      buffer.push(Buffer.alloc(100));

      await Promise.all(waiters);
      // 如果到达这里，说明所有等待者都被通知了
      expect(true).toBe(true);
    });
  });

  describe("清空和重置", () => {
    it("应该正确清空缓冲区", () => {
      buffer.push(Buffer.alloc(100));
      buffer.push(Buffer.alloc(200));

      buffer.clear();

      expect(buffer.isEmpty()).toBe(true);
      expect(buffer.size()).toBe(0);
      expect(buffer.length()).toBe(0);
    });

    it("清空后应保持结束标记", () => {
      buffer.push(Buffer.alloc(100));
      buffer.end();

      buffer.clear();

      expect(buffer.isEnded()).toBe(true);
    });

    it("应该正确重置缓冲区", () => {
      buffer.push(Buffer.alloc(100));
      buffer.end();

      buffer.reset();

      expect(buffer.isEmpty()).toBe(true);
      expect(buffer.isEnded()).toBe(false);
      expect(buffer.size()).toBe(0);
    });

    it("重置后应该可以再次推入数据", () => {
      buffer.push(Buffer.alloc(100));
      buffer.end();

      buffer.reset();

      expect(() => {
        buffer.push(Buffer.alloc(100));
      }).not.toThrow();
    });
  });

  describe("边界情况", () => {
    it("应该正确处理空数据块", () => {
      expect(() => {
        buffer.push(Buffer.alloc(0));
      }).not.toThrow();

      expect(buffer.length()).toBe(1);
      expect(buffer.size()).toBe(0);
    });

    it("应该正确处理刚好填满缓冲区", () => {
      const smallBuffer = new AudioBuffer({ maxBufferSize: 100 });

      expect(() => {
        smallBuffer.push(Buffer.alloc(100));
      }).not.toThrow();

      expect(smallBuffer.isFull()).toBe(true);
    });

    it("应该在多次取出后保持状态一致", () => {
      const data1 = Buffer.from("a");
      const data2 = Buffer.from("b");
      const data3 = Buffer.from("c");

      buffer.push(data1);
      buffer.push(data2);
      buffer.push(data3);

      buffer.shift();
      buffer.shift();

      expect(buffer.length()).toBe(1);
      expect(buffer.size()).toBe(1);
      expect(buffer.peek()).toEqual(data3);
    });
  });

  describe("默认配置", () => {
    it("应该使用 10MB 默认最大缓冲区大小", () => {
      const defaultBuffer = new AudioBuffer();

      // 10MB = 10 * 1024 * 1024
      const expectedMaxSize = 10 * 1024 * 1024;
      expect(defaultBuffer.getState().full).toBe(false);

      // 推入接近 10MB 的数据
      defaultBuffer.push(Buffer.alloc(expectedMaxSize - 100));
      expect(defaultBuffer.getState().full).toBe(false);

      defaultBuffer.push(Buffer.alloc(100));
      expect(defaultBuffer.getState().full).toBe(true);
    });
  });

  describe("并发操作", () => {
    it("应该正确处理并发推入和取出", async () => {
      const operations: Promise<void>[] = [];

      // 并发推入
      for (let i = 0; i < 10; i++) {
        operations.push(
          new Promise((resolve) => {
            buffer.push(Buffer.alloc(50));
            resolve();
          })
        );
      }

      // 并发取出
      for (let i = 0; i < 10; i++) {
        operations.push(
          new Promise((resolve) => {
            buffer.shift();
            resolve();
          })
        );
      }

      await Promise.all(operations);

      // 最终状态应该是空的
      expect(buffer.isEmpty()).toBe(true);
    });
  });
});

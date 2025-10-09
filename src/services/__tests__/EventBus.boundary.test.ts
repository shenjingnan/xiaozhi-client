#!/usr/bin/env node

/**
 * MCP服务管理边界情况测试（简化版）
 *
 * 本测试文件包含关键边界情况和异常场景的测试，
 * 确保系统在极端情况下仍能稳定运行。
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Mock } from "vitest";
import { EventBus } from "../EventBus.js";

describe("事件系统边界情况测试", () => {
  let eventBus: EventBus;

  beforeEach(() => {
    eventBus = new EventBus();
  });

  afterEach(() => {
    eventBus.destroy();
  });

  describe("高频事件处理测试", () => {
    it("应该处理高频事件发送", async () => {
      const handler = vi.fn();
      eventBus.onEvent("high-frequency", handler);

      // 快速发送100个事件
      const eventPromises = Array(100)
        .fill(0)
        .map((_, index) =>
          eventBus.emitEvent("high-frequency", {
            id: index,
            timestamp: Date.now(),
          })
        );

      await Promise.all(eventPromises);

      // 等待事件处理完成
      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(handler).toHaveBeenCalledTimes(100);
    });

    it("应该处理大量监听器注册", () => {
      const handlers: Array<Mock> = [];

      // 注册60个监听器（低于最大监听器数量）
      for (let i = 0; i < 60; i++) {
        const handler = vi.fn();
        handlers.push(handler);
        eventBus.onEvent("bulk-test", handler);
      }

      // 发送一个事件
      eventBus.emitEvent("bulk-test", {
        id: 1,
        timestamp: Date.now(),
      });

      // 所有监听器都应该被调用
      for (const handler of handlers) {
        expect(handler).toHaveBeenCalledTimes(1);
      }
    });
  });

  describe("错误处理测试", () => {
    it("应该处理监听器抛出的异常", () => {
      const throwingHandler = vi.fn().mockImplementation(() => {
        throw new Error("Listener error");
      });
      const normalHandler = vi.fn();

      eventBus.onEvent("error-test", throwingHandler);
      eventBus.onEvent("error-test", normalHandler);

      // 发送事件（EventBus.emitEvent会在监听器抛出异常时返回false）
      const result = eventBus.emitEvent("error-test", {
        error: "test error",
        timestamp: Date.now(),
      });
      expect(result).toBe(false); // 事件发送失败，因为监听器抛出异常

      // 当监听器抛出异常时，EventEmitter会停止调用后续监听器
      // 所以normalHandler不应该被调用
      expect(normalHandler).not.toHaveBeenCalled();
    });

    it("应该处理大型事件数据", () => {
      const handler = vi.fn();
      eventBus.onEvent("large-data-test", handler);

      // 创建大型数据对象
      const largeData = {
        array: Array(100)
          .fill(0)
          .map((_, i) => ({ id: i, data: "x".repeat(100) })),
        string: "a".repeat(10000),
        nested: {
          level1: {
            level2: {
              level3: {
                data: Array(10).fill("deep"),
              },
            },
          },
        },
      };

      expect(() => {
        eventBus.emitEvent("large-data-test", {
          data: largeData,
          timestamp: Date.now(),
        });
      }).not.toThrow();

      // 验证handler被调用，并且传入了正确的参数
      expect(handler).toHaveBeenCalled();
      expect(handler).toHaveBeenCalledWith({
        data: largeData,
        timestamp: expect.any(Number),
      });
    });
  });

  describe("内存管理测试", () => {
    it("应该正确清理已销毁的事件总线", () => {
      const handler = vi.fn();
      eventBus.onEvent("destroy-test", handler);
      eventBus.destroy();

      // 销毁后发送事件应该不会调用监听器
      eventBus.emitEvent("destroy-test", {
        message: "test",
        timestamp: Date.now(),
      });
      expect(handler).not.toHaveBeenCalled();

      // 销毁后应该可以正常添加监听器（EventBus的destroy方法只是清理监听器和状态，不会阻止后续操作）
      expect(() => {
        eventBus.onEvent("test:remove", vi.fn());
      }).not.toThrow();
    });

    it("应该处理事件链和级联事件", () => {
      const executionOrder: string[] = [];

      const handler1 = vi.fn().mockImplementation(() => {
        executionOrder.push("handler1");
        eventBus.emitEvent("chain-event-2", {
          value: 2,
          timestamp: Date.now(),
        });
      });

      const handler2 = vi.fn().mockImplementation(() => {
        executionOrder.push("handler2");
        eventBus.emitEvent("chain-event-3", {
          value: 3,
          timestamp: Date.now(),
        });
      });

      const handler3 = vi.fn().mockImplementation(() => {
        executionOrder.push("handler3");
      });

      eventBus.onEvent("chain:start", handler1);
      eventBus.onEvent("chain-event-2", handler2);
      eventBus.onEvent("chain-event-3", handler3);

      // 触发事件链
      eventBus.emitEvent("chain:start", {
        value: 1,
        timestamp: Date.now(),
      });

      expect(executionOrder).toEqual(["handler1", "handler2", "handler3"]);
    });
  });

  describe("性能边界测试", () => {
    it("应该测量事件发送性能", () => {
      const handler = vi.fn();
      eventBus.onEvent("performance-test", handler);

      const iterations = 1000;
      const startTime = performance.now();

      for (let i = 0; i < iterations; i++) {
        eventBus.emitEvent("test:performance", {
          id: i,
          timestamp: Date.now(),
        });
      }

      const endTime = performance.now();
      const duration = endTime - startTime;

      // 1000次事件发送应该在合理时间内完成（小于100ms）
      expect(duration).toBeLessThan(100);
      expect(handler).toHaveBeenCalledTimes(iterations);
    });
  });
});

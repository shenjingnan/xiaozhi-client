/**
 * ByteDance TTS 控制器测试
 */

import { ByteDanceTTSController } from "@/platforms/bytedance/TTSController.js";
import { describe, expect, it, vi } from "vitest";
import WebSocket from "ws";

// 定义监听器函数类型
type ListenerFn = (...args: unknown[]) => void;

// Mock WebSocket
vi.mock("ws", () => ({
  default: vi.fn().mockImplementation(() => {
    const mockWs = {
      _listeners: new Map<string, Set<ListenerFn>>(),
      on: vi.fn(function (
        this: typeof mockWs,
        event: string,
        listener: ListenerFn
      ) {
        if (!this._listeners.has(event)) {
          this._listeners.set(event, new Set());
        }
        this._listeners.get(event)!.add(listener);
        return this;
      }),
      removeAllListeners: vi.fn(function (this: typeof mockWs, event?: string) {
        if (event) {
          this._listeners.delete(event);
        } else {
          this._listeners.clear();
        }
        return this;
      }),
      close: vi.fn(function (this: typeof mockWs) {
        this._listeners.clear();
      }),
      listenerCount: vi.fn(function (this: typeof mockWs, event: string) {
        return this._listeners.get(event)?.size ?? 0;
      }),
    };
    return mockWs;
  }),
}));

describe("ByteDanceTTSController", () => {
  const mockConfig = {
    app: {
      appid: "test_appid",
      accessToken: "test_token",
    },
    audio: {
      voice_type: "S_70000",
      encoding: "wav" as const,
    },
  };

  describe("close() 方法内存泄漏修复", () => {
    it("应在调用 close() 时移除所有 WebSocket 事件监听器", () => {
      const controller = new ByteDanceTTSController(mockConfig);

      // 模拟 synthesizeStream 中的 WebSocket 创建和监听器注册
      const testWs = new WebSocket("wss://test.endpoint.com");
      testWs.on("open", () => {});
      testWs.on("error", () => {});

      // 验证监听器已注册
      expect(testWs.listenerCount("open")).toBe(1);
      expect(testWs.listenerCount("error")).toBe(1);

      // 通过反射访问私有 ws 属性进行测试
      (controller as unknown as { ws: WebSocket | null }).ws = testWs;

      // 调用 close 方法
      controller.close();

      // 验证 removeAllListeners 被调用
      expect(testWs.removeAllListeners).toHaveBeenCalled();

      // 验证监听器已被移除
      expect(testWs.listenerCount("open")).toBe(0);
      expect(testWs.listenerCount("error")).toBe(0);

      // 验证 close 被调用
      expect(testWs.close).toHaveBeenCalled();

      // 验证 ws 被设为 null
      expect((controller as unknown as { ws: WebSocket | null }).ws).toBeNull();
    });

    it("应在 ws 为 null 时不抛出错误", () => {
      const controller = new ByteDanceTTSController(mockConfig);

      // 确保 ws 为 null
      expect((controller as unknown as { ws: WebSocket | null }).ws).toBeNull();

      // 调用 close 不应抛出错误
      expect(() => controller.close()).not.toThrow();
    });

    it("应在调用 close() 后设置 isStreamClosed 为 true", () => {
      const controller = new ByteDanceTTSController(mockConfig);

      // 通过反射访问私有属性
      const isStreamClosed = () =>
        (controller as unknown as { isStreamClosed: boolean }).isStreamClosed;

      expect(isStreamClosed()).toBe(false);

      controller.close();

      expect(isStreamClosed()).toBe(true);
    });

    it("应正确处理多次调用 close()", () => {
      const controller = new ByteDanceTTSController(mockConfig);

      const testWs = new WebSocket("wss://test.endpoint.com");
      testWs.on("open", () => {});
      testWs.on("error", () => {});

      (controller as unknown as { ws: WebSocket | null }).ws = testWs;

      // 第一次调用 close
      controller.close();
      expect(testWs.removeAllListeners).toHaveBeenCalledTimes(1);
      expect(testWs.close).toHaveBeenCalledTimes(1);

      // 第二次调用 close（ws 已经是 null）
      controller.close();
      expect(testWs.removeAllListeners).toHaveBeenCalledTimes(1);
      expect(testWs.close).toHaveBeenCalledTimes(1);
    });
  });

  describe("close() 方法与 synthesizeStream/synthesize 的交互", () => {
    it("应在流式合成完成后正确清理资源", async () => {
      const controller = new ByteDanceTTSController(mockConfig);

      // 由于 synthesizeStream 需要实际的 WebSocket 连接，
      // 这里只测试 close 方法的清理逻辑
      const testWs = new WebSocket("wss://test.endpoint.com");
      testWs.on("open", () => {});
      testWs.on("error", () => {});
      testWs.on("message", () => {});

      (controller as unknown as { ws: WebSocket | null }).ws = testWs;

      // 模拟流式合成完成后的清理
      controller.close();

      // 验证所有监听器都被移除
      expect(testWs.listenerCount("open")).toBe(0);
      expect(testWs.listenerCount("error")).toBe(0);
      expect(testWs.listenerCount("message")).toBe(0);
    });

    it("应在非流式合成完成后正确清理资源", async () => {
      const controller = new ByteDanceTTSController(mockConfig);

      const testWs = new WebSocket("wss://test.endpoint.com");
      testWs.on("open", () => {});
      testWs.on("error", () => {});

      (controller as unknown as { ws: WebSocket | null }).ws = testWs;

      // 模拟非流式合成完成后的清理
      controller.close();

      // 验证所有监听器都被移除
      expect(testWs.listenerCount("open")).toBe(0);
      expect(testWs.listenerCount("error")).toBe(0);
    });
  });
});

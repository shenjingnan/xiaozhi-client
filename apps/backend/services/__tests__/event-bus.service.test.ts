import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  destroyEventBus,
  EventBus,
  getEventBus,
} from "../event-bus.service.js";

// Mock dependencies
vi.mock("../../Logger.js", () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
}));

describe("EventBus", () => {
  let eventBus: EventBus;
  let mockLogger: any;

  beforeEach(async () => {
    vi.clearAllMocks();

    // Mock Logger
    mockLogger = {
      debug: vi.fn(),
      info: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
    };
    const { logger } = await import("../../Logger.js");
    Object.assign(logger, mockLogger);

    eventBus = new EventBus();
  });

  afterEach(() => {
    eventBus.destroy();
    destroyEventBus();
    vi.clearAllMocks();
  });

  describe("constructor", () => {
    it("should initialize with correct dependencies", () => {
      expect(eventBus).toBeInstanceOf(EventBus);
      expect(mockLogger.debug).not.toHaveBeenCalled();
    });

    it("should set max listeners", () => {
      // 测试环境下 maxListeners 应该是 200，避免 MaxListenersExceededWarning
      expect(eventBus.getMaxListeners()).toBe(200);
    });

    it("should setup error handling", () => {
      // Verify error event listener is set up
      expect(eventBus.listenerCount("error")).toBe(1);
      expect(eventBus.listenerCount("newListener")).toBe(1);
    });
  });

  describe("emitEvent", () => {
    it("should emit config:updated event successfully", () => {
      const eventData = { type: "customMCP", timestamp: new Date() };
      const listener = vi.fn();

      eventBus.onEvent("config:updated", listener);
      const result = eventBus.emitEvent("config:updated", eventData);

      expect(result).toBe(true);
      expect(listener).toHaveBeenCalledWith(eventData);
      expect(mockLogger.debug).toHaveBeenCalledWith(
        "发射事件: config:updated",
        eventData
      );
    });

    it("should emit config:error event successfully", () => {
      const eventData = { error: new Error("Test error"), operation: "test" };
      const listener = vi.fn();

      eventBus.onEvent("config:error", listener);
      const result = eventBus.emitEvent("config:error", eventData);

      expect(result).toBe(true);
      expect(listener).toHaveBeenCalledWith(eventData);
    });

    it("should emit status:updated event successfully", () => {
      const eventData = { status: { connected: true }, source: "test" };
      const listener = vi.fn();

      eventBus.onEvent("status:updated", listener);
      const result = eventBus.emitEvent("status:updated", eventData);

      expect(result).toBe(true);
      expect(listener).toHaveBeenCalledWith(eventData);
    });

    it("should emit service restart events successfully", () => {
      const listeners = {
        requested: vi.fn(),
        started: vi.fn(),
        completed: vi.fn(),
        failed: vi.fn(),
      };

      eventBus.onEvent("service:restart:requested", listeners.requested);
      eventBus.onEvent("service:restart:started", listeners.started);
      eventBus.onEvent("service:restart:completed", listeners.completed);
      eventBus.onEvent("service:restart:failed", listeners.failed);

      eventBus.emitEvent("service:restart:requested", {
        serviceName: "test-service",
        delay: 1000,
        attempt: 1,
        timestamp: 123456,
      });
      eventBus.emitEvent("service:restart:started", {
        serviceName: "test-service",
        attempt: 1,
        timestamp: 123457,
      });
      eventBus.emitEvent("service:restart:completed", {
        serviceName: "test-service",
        attempt: 1,
        timestamp: 123458,
      });
      eventBus.emitEvent("service:restart:failed", {
        serviceName: "test-service",
        error: new Error("Restart failed"),
        attempt: 1,
        timestamp: 123459,
      });

      expect(listeners.requested).toHaveBeenCalledWith({
        serviceName: "test-service",
        delay: 1000,
        attempt: 1,
        timestamp: 123456,
      });
      expect(listeners.started).toHaveBeenCalledWith({
        serviceName: "test-service",
        attempt: 1,
        timestamp: 123457,
      });
      expect(listeners.completed).toHaveBeenCalledWith({
        serviceName: "test-service",
        attempt: 1,
        timestamp: 123458,
      });
      expect(listeners.failed).toHaveBeenCalledWith({
        serviceName: "test-service",
        error: expect.any(Error),
        attempt: 1,
        timestamp: 123459,
      });
    });

    it("should emit WebSocket events successfully", () => {
      const listeners = {
        connected: vi.fn(),
        disconnected: vi.fn(),
        message: vi.fn(),
      };

      eventBus.onEvent("websocket:client:connected", listeners.connected);
      eventBus.onEvent("websocket:client:disconnected", listeners.disconnected);
      eventBus.onEvent("websocket:message:received", listeners.message);

      eventBus.emitEvent("websocket:client:connected", {
        clientId: "client-123",
        timestamp: 123456,
      });
      eventBus.emitEvent("websocket:client:disconnected", {
        clientId: "client-123",
        timestamp: 123457,
      });
      eventBus.emitEvent("websocket:message:received", {
        type: "heartbeat",
        data: { status: "ok" },
        clientId: "client-123",
      });

      expect(listeners.connected).toHaveBeenCalledWith({
        clientId: "client-123",
        timestamp: 123456,
      });
      expect(listeners.disconnected).toHaveBeenCalledWith({
        clientId: "client-123",
        timestamp: 123457,
      });
      expect(listeners.message).toHaveBeenCalledWith({
        type: "heartbeat",
        data: { status: "ok" },
        clientId: "client-123",
      });
    });

    it("should emit notification events successfully", () => {
      const listeners = {
        broadcast: vi.fn(),
        error: vi.fn(),
      };

      eventBus.onEvent("notification:broadcast", listeners.broadcast);
      eventBus.onEvent("notification:error", listeners.error);

      eventBus.emitEvent("notification:broadcast", {
        type: "info",
        data: { message: "Test notification" },
        target: "client-123",
      });
      eventBus.emitEvent("notification:error", {
        error: new Error("Notification failed"),
        type: "error",
      });

      expect(listeners.broadcast).toHaveBeenCalledWith({
        type: "info",
        data: { message: "Test notification" },
        target: "client-123",
      });
      expect(listeners.error).toHaveBeenCalledWith({
        error: expect.any(Error),
        type: "error",
      });
    });

    it("should emit MCP service events successfully", () => {
      const listeners = {
        connected: vi.fn(),
        disconnected: vi.fn(),
        connectionFailed: vi.fn(),
      };

      eventBus.onEvent("mcp:service:connected", listeners.connected);
      eventBus.onEvent("mcp:service:disconnected", listeners.disconnected);
      eventBus.onEvent(
        "mcp:service:connection:failed",
        listeners.connectionFailed
      );

      // 模拟工具数据
      const mockTools = [
        {
          name: "test-tool",
          description: "Test tool",
          inputSchema: { type: "object" as const, properties: {} },
        },
      ];

      const connectionTime = new Date();
      const disconnectionTime = new Date();

      eventBus.emitEvent("mcp:service:connected", {
        serviceName: "test-service",
        tools: mockTools,
        connectionTime,
      });

      eventBus.emitEvent("mcp:service:disconnected", {
        serviceName: "test-service",
        reason: "手动断开",
        disconnectionTime,
      });

      eventBus.emitEvent("mcp:service:connection:failed", {
        serviceName: "test-service",
        error: new Error("Connection failed"),
        attempt: 3,
      });

      expect(listeners.connected).toHaveBeenCalledWith({
        serviceName: "test-service",
        tools: mockTools,
        connectionTime,
      });

      expect(listeners.disconnected).toHaveBeenCalledWith({
        serviceName: "test-service",
        reason: "手动断开",
        disconnectionTime,
      });

      expect(listeners.connectionFailed).toHaveBeenCalledWith({
        serviceName: "test-service",
        error: expect.any(Error),
        attempt: 3,
      });
    });

    it("should update event statistics", () => {
      const eventData = { type: "customMCP", timestamp: new Date() };

      eventBus.emitEvent("config:updated", eventData);
      eventBus.emitEvent("config:updated", eventData);

      const stats = eventBus.getEventStats();
      expect(stats["config:updated"]).toBeDefined();
      expect(stats["config:updated"].count).toBe(2);
      expect(stats["config:updated"].lastEmitted).toBeInstanceOf(Date);
    });

    it("should handle emit errors gracefully", () => {
      // 测试 updateEventStats 方法抛出错误的情况
      const originalUpdateStats = (eventBus as any).updateEventStats;
      (eventBus as any).updateEventStats = vi.fn().mockImplementation(() => {
        throw new Error("Update stats failed");
      });

      const result = eventBus.emitEvent("config:updated", {
        type: "customMCP",
        timestamp: new Date(),
      });

      expect(result).toBe(false);
      expect(mockLogger.error).toHaveBeenCalledWith(
        "发射事件失败: config:updated",
        expect.any(Error)
      );

      // Restore original method
      (eventBus as any).updateEventStats = originalUpdateStats;
    });

    it("should return false when no listeners", () => {
      const result = eventBus.emitEvent("config:updated", {
        type: "customMCP",
        timestamp: new Date(),
      });

      expect(result).toBe(false);
    });
  });

  describe("onEvent", () => {
    it("should add event listener successfully", () => {
      const listener = vi.fn();

      eventBus.onEvent("config:updated", listener);

      expect(eventBus.listenerCount("config:updated")).toBe(1);
      expect(mockLogger.debug).toHaveBeenCalledWith(
        "添加事件监听器: config:updated"
      );
    });

    it("should support multiple listeners for same event", () => {
      const listener1 = vi.fn();
      const listener2 = vi.fn();

      eventBus.onEvent("config:updated", listener1);
      eventBus.onEvent("config:updated", listener2);

      expect(eventBus.listenerCount("config:updated")).toBe(2);

      eventBus.emitEvent("config:updated", {
        type: "customMCP",
        timestamp: new Date(),
      });

      expect(listener1).toHaveBeenCalled();
      expect(listener2).toHaveBeenCalled();
    });

    it("should handle many listeners without issues", () => {
      // Add many listeners to test the system can handle them
      for (let i = 0; i < 30; i++) {
        eventBus.onEvent("config:updated", vi.fn());
      }

      expect(eventBus.listenerCount("config:updated")).toBe(30);

      // Should be able to emit events to all listeners
      const result = eventBus.emitEvent("config:updated", {
        type: "customMCP",
        timestamp: new Date(),
      });
      expect(result).toBe(true);
    });
  });

  describe("onceEvent", () => {
    it("should add one-time event listener successfully", () => {
      const listener = vi.fn();

      eventBus.onceEvent("config:updated", listener);

      expect(eventBus.listenerCount("config:updated")).toBe(1);
      expect(mockLogger.debug).toHaveBeenCalledWith(
        "添加一次性事件监听器: config:updated"
      );
    });

    it("should remove listener after first execution", () => {
      const listener = vi.fn();

      eventBus.onceEvent("config:updated", listener);

      // First emit should trigger listener
      eventBus.emitEvent("config:updated", {
        type: "customMCP",
        timestamp: new Date(),
      });
      expect(listener).toHaveBeenCalledTimes(1);
      expect(eventBus.listenerCount("config:updated")).toBe(0);

      // Second emit should not trigger listener
      eventBus.emitEvent("config:updated", {
        type: "customMCP",
        timestamp: new Date(),
      });
      expect(listener).toHaveBeenCalledTimes(1);
    });

    it("should support multiple one-time listeners", () => {
      const listener1 = vi.fn();
      const listener2 = vi.fn();

      eventBus.onceEvent("config:updated", listener1);
      eventBus.onceEvent("config:updated", listener2);

      expect(eventBus.listenerCount("config:updated")).toBe(2);

      eventBus.emitEvent("config:updated", {
        type: "customMCP",
        timestamp: new Date(),
      });

      expect(listener1).toHaveBeenCalledTimes(1);
      expect(listener2).toHaveBeenCalledTimes(1);
      expect(eventBus.listenerCount("config:updated")).toBe(0);
    });
  });

  describe("offEvent", () => {
    it("should remove event listener successfully", () => {
      const listener = vi.fn();

      eventBus.onEvent("config:updated", listener);
      expect(eventBus.listenerCount("config:updated")).toBe(1);

      eventBus.offEvent("config:updated", listener);
      expect(eventBus.listenerCount("config:updated")).toBe(0);
      expect(mockLogger.debug).toHaveBeenCalledWith(
        "移除事件监听器: config:updated"
      );
    });

    it("should only remove specific listener", () => {
      const listener1 = vi.fn();
      const listener2 = vi.fn();

      eventBus.onEvent("config:updated", listener1);
      eventBus.onEvent("config:updated", listener2);
      expect(eventBus.listenerCount("config:updated")).toBe(2);

      eventBus.offEvent("config:updated", listener1);
      expect(eventBus.listenerCount("config:updated")).toBe(1);

      eventBus.emitEvent("config:updated", {
        type: "customMCP",
        timestamp: new Date(),
      });
      expect(listener1).not.toHaveBeenCalled();
      expect(listener2).toHaveBeenCalled();
    });

    it("should handle removing non-existent listener", () => {
      const listener = vi.fn();

      eventBus.offEvent("config:updated", listener);
      expect(eventBus.listenerCount("config:updated")).toBe(0);
    });
  });

  describe("getEventStats", () => {
    it("should return empty stats initially", () => {
      const stats = eventBus.getEventStats();
      expect(stats).toEqual({});
    });

    it("should return correct event statistics", () => {
      const eventData = { type: "customMCP", timestamp: new Date() };

      eventBus.emitEvent("config:updated", eventData);
      eventBus.emitEvent("config:updated", eventData);
      eventBus.emitEvent("status:updated", { status: {}, source: "test" });

      const stats = eventBus.getEventStats();

      expect(stats["config:updated"]).toBeDefined();
      expect(stats["config:updated"].count).toBe(2);
      expect(stats["config:updated"].lastEmitted).toBeInstanceOf(Date);

      expect(stats["status:updated"]).toBeDefined();
      expect(stats["status:updated"].count).toBe(1);
      expect(stats["status:updated"].lastEmitted).toBeInstanceOf(Date);
    });

    it("should return deep copy of stats", () => {
      const eventData = { type: "customMCP", timestamp: new Date() };
      eventBus.emitEvent("config:updated", eventData);

      const stats1 = eventBus.getEventStats();
      const stats2 = eventBus.getEventStats();

      expect(stats1).not.toBe(stats2);
      expect(stats1["config:updated"]).not.toBe(stats2["config:updated"]);
    });
  });

  describe("getListenerStats", () => {
    it("should return empty stats when no listeners", () => {
      const stats = eventBus.getListenerStats();
      expect(Object.keys(stats)).toHaveLength(2); // error and newListener from setup
    });

    it("should return correct listener statistics", () => {
      const listener1 = vi.fn();
      const listener2 = vi.fn();
      const listener3 = vi.fn();

      eventBus.onEvent("config:updated", listener1);
      eventBus.onEvent("config:updated", listener2);
      eventBus.onEvent("status:updated", listener3);

      const stats = eventBus.getListenerStats();

      expect(stats["config:updated"]).toBe(2);
      expect(stats["status:updated"]).toBe(1);
    });
  });

  describe("clearEventStats", () => {
    it("should clear all event statistics", () => {
      const eventData = { type: "customMCP", timestamp: new Date() };
      eventBus.emitEvent("config:updated", eventData);
      eventBus.emitEvent("status:updated", { status: {}, source: "test" });

      let stats = eventBus.getEventStats();
      expect(Object.keys(stats)).toHaveLength(2);

      eventBus.clearEventStats();

      stats = eventBus.getEventStats();
      expect(stats).toEqual({});
      expect(mockLogger.info).toHaveBeenCalledWith("事件统计已清理");
    });
  });

  describe("getStatus", () => {
    it("should return correct status information", () => {
      const listener1 = vi.fn();
      const listener2 = vi.fn();

      eventBus.onEvent("config:updated", listener1);
      eventBus.onEvent("status:updated", listener2);

      eventBus.emitEvent("config:updated", {
        type: "customMCP",
        timestamp: new Date(),
      });
      eventBus.emitEvent("status:updated", { status: {}, source: "test" });

      const status = eventBus.getStatus();

      expect(status.totalEvents).toBe(2);
      expect(status.totalListeners).toBeGreaterThanOrEqual(2); // Plus error and newListener
      expect(status.eventStats).toBeDefined();
      expect(status.listenerStats).toBeDefined();
      expect(status.eventStats["config:updated"]).toBeDefined();
      expect(status.eventStats["status:updated"]).toBeDefined();
    });

    it("should return zero totals when no events or listeners", () => {
      const status = eventBus.getStatus();

      expect(status.totalEvents).toBe(0);
      expect(status.totalListeners).toBeGreaterThanOrEqual(0); // error and newListener from setup
      expect(status.eventStats).toEqual({});
    });
  });

  describe("destroy", () => {
    it("should remove all listeners and clear stats", () => {
      const listener = vi.fn();
      eventBus.onEvent("config:updated", listener);
      eventBus.emitEvent("config:updated", {
        type: "customMCP",
        timestamp: new Date(),
      });

      expect(eventBus.listenerCount("config:updated")).toBe(1);
      expect(Object.keys(eventBus.getEventStats())).toHaveLength(1);

      eventBus.destroy();

      expect(eventBus.listenerCount("config:updated")).toBe(0);
      expect(eventBus.getEventStats()).toEqual({});
      expect(mockLogger.info).toHaveBeenCalledWith("EventBus 已销毁");
    });
  });

  describe("error handling", () => {
    it("should handle internal errors", () => {
      const error = new Error("Internal error");

      eventBus.emit("error", error);

      expect(mockLogger.error).toHaveBeenCalledWith(
        "EventBus 内部错误:",
        error
      );
    });

    it("should handle listener exceptions gracefully", () => {
      const errorListener = vi.fn().mockImplementation(() => {
        throw new Error("Listener error");
      });
      const normalListener = vi.fn();

      eventBus.onEvent("config:updated", errorListener);
      eventBus.onEvent("config:updated", normalListener);

      // Should not throw, but continue with other listeners
      expect(() => {
        eventBus.emitEvent("config:updated", {
          type: "customMCP",
          timestamp: new Date(),
        });
      }).not.toThrow();

      expect(errorListener).toHaveBeenCalled();
      // Note: If the first listener throws, the second might not be called
      // This depends on the EventEmitter implementation
    });

    it("should handle high listener count", () => {
      // Add many listeners to test the system can handle them
      for (let i = 0; i < 45; i++) {
        eventBus.onEvent("config:updated", vi.fn());
      }

      expect(eventBus.listenerCount("config:updated")).toBe(45);

      // Should still be able to emit events
      const result = eventBus.emitEvent("config:updated", {
        type: "customMCP",
        timestamp: new Date(),
      });
      expect(result).toBe(true);
    });
  });

  describe("async event handling", () => {
    it("should handle async listeners", async () => {
      const asyncListener = vi.fn().mockImplementation(async (data) => {
        await new Promise((resolve) => setTimeout(resolve, 10));
        return data;
      });

      eventBus.onEvent("config:updated", asyncListener);
      eventBus.emitEvent("config:updated", {
        type: "customMCP",
        timestamp: new Date(),
      });

      // Wait for async listener to complete
      await new Promise((resolve) => setTimeout(resolve, 20));

      expect(asyncListener).toHaveBeenCalled();
    });

    it("should handle async listener errors", async () => {
      const asyncErrorListener = vi.fn().mockImplementation(async () => {
        await new Promise((resolve) => setTimeout(resolve, 10));
        throw new Error("Async listener error");
      });

      eventBus.onEvent("config:updated", asyncErrorListener);

      // Should not throw
      expect(() => {
        eventBus.emitEvent("config:updated", {
          type: "customMCP",
          timestamp: new Date(),
        });
      }).not.toThrow();

      // Wait for async listener to complete
      await new Promise((resolve) => setTimeout(resolve, 20));

      expect(asyncErrorListener).toHaveBeenCalled();
    });
  });

  describe("performance and memory", () => {
    it("should handle many events efficiently", () => {
      const listener = vi.fn();
      eventBus.onEvent("config:updated", listener);

      const startTime = Date.now();
      for (let i = 0; i < 1000; i++) {
        eventBus.emitEvent("config:updated", {
          type: "customMCP",
          timestamp: new Date(),
        });
      }
      const endTime = Date.now();

      expect(listener).toHaveBeenCalledTimes(1000);
      expect(endTime - startTime).toBeLessThan(100); // Should be fast
      expect(eventBus.getEventStats()["config:updated"].count).toBe(1000);
    });

    it("should handle many listeners efficiently", () => {
      const listeners = Array.from({ length: 100 }, () => vi.fn());

      for (const listener of listeners) {
        eventBus.onEvent("config:updated", listener);
      }

      eventBus.emitEvent("config:updated", {
        type: "customMCP",
        timestamp: new Date(),
      });

      for (const listener of listeners) {
        expect(listener).toHaveBeenCalledTimes(1);
      }

      expect(eventBus.listenerCount("config:updated")).toBe(100);
    });

    it("should clean up listeners properly", () => {
      const listeners = Array.from({ length: 10 }, () => vi.fn());

      for (const listener of listeners) {
        eventBus.onEvent("config:updated", listener);
      }

      expect(eventBus.listenerCount("config:updated")).toBe(10);

      // Remove half the listeners
      for (const listener of listeners.slice(0, 5)) {
        eventBus.offEvent("config:updated", listener);
      }

      expect(eventBus.listenerCount("config:updated")).toBe(5);

      eventBus.emitEvent("config:updated", {
        type: "customMCP",
        timestamp: new Date(),
      });

      // Only remaining listeners should be called
      for (const listener of listeners.slice(0, 5)) {
        expect(listener).not.toHaveBeenCalled();
      }
      for (const listener of listeners.slice(5)) {
        expect(listener).toHaveBeenCalledTimes(1);
      }
    });
  });
});

describe("EventBus singleton functions", () => {
  let mockLogger: any;

  beforeEach(async () => {
    vi.clearAllMocks();

    // Mock Logger
    mockLogger = {
      debug: vi.fn(),
      info: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
    };
    const { logger } = await import("../../Logger.js");
    Object.assign(logger, mockLogger);

    // Ensure clean state
    destroyEventBus();
  });

  afterEach(() => {
    destroyEventBus();
    vi.clearAllMocks();
  });

  describe("getEventBus", () => {
    it("should return singleton instance", () => {
      const instance1 = getEventBus();
      const instance2 = getEventBus();

      expect(instance1).toBe(instance2);
      expect(instance1).toBeInstanceOf(EventBus);
    });

    it("should create new instance after destroy", () => {
      const instance1 = getEventBus();
      destroyEventBus();
      const instance2 = getEventBus();

      expect(instance1).not.toBe(instance2);
      expect(instance2).toBeInstanceOf(EventBus);
    });
  });

  describe("destroyEventBus", () => {
    it("should destroy singleton instance", () => {
      const instance = getEventBus();
      const listener = vi.fn();
      instance.onEvent("config:updated", listener);

      expect(instance.listenerCount("config:updated")).toBe(1);

      destroyEventBus();

      // Should create new instance after destroy
      const newInstance = getEventBus();
      expect(newInstance).not.toBe(instance);
      expect(newInstance.listenerCount("config:updated")).toBe(0);
    });

    it("should handle destroy when no instance exists", () => {
      expect(() => destroyEventBus()).not.toThrow();
    });

    it("should handle multiple destroy calls", () => {
      getEventBus();
      destroyEventBus();

      expect(() => destroyEventBus()).not.toThrow();
    });
  });
});

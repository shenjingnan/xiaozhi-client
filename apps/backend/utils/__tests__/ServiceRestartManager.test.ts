#!/usr/bin/env node

/**
 * ServiceRestartManager 功能验证测试
 * 验证 ConcurrencyController 移除后的 ServiceRestartManager 功能完整性
 */

import { getEventBus } from "@services/event-bus.service.js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  RestartStrategy,
  ServiceHealthStatus,
  ServiceRestartManager,
} from "../ServiceRestartManager.js";

describe("ServiceRestartManager 功能验证", () => {
  let serviceRestartManager: ServiceRestartManager;
  let eventBus: any;

  beforeEach(() => {
    // 重置事件总线单例
    (global as any).eventBusInstance = null;
    eventBus = getEventBus();

    // 创建新的 ServiceRestartManager 实例
    serviceRestartManager = new ServiceRestartManager({
      strategy: RestartStrategy.EXPONENTIAL_BACKOFF,
      maxAttempts: 3,
      initialDelay: 100,
      maxDelay: 1000,
      backoffMultiplier: 2,
      fixedInterval: 200,
      enableJitter: false, // 关闭抖动以便测试
      jitterAmount: 0,
    });
  });

  afterEach(() => {
    serviceRestartManager.destroy();
    eventBus.removeAllListeners();

    // 清理所有定时器，防止测试间干扰
    return new Promise((resolve) => {
      // 让所有微任务完成
      setTimeout(() => {
        resolve(null);
      }, 0);
    });
  });

  describe("基本功能测试", () => {
    it("应该正确获取服务健康状态", () => {
      const health = serviceRestartManager.getServiceHealth("test-service");
      expect(health).toBe(ServiceHealthStatus.UNKNOWN);
    });

    it("应该正确获取所有服务健康状态", () => {
      const allHealth = serviceRestartManager.getAllServiceHealth();
      expect(allHealth).toEqual({});
    });
  });

  describe("事件监听测试", () => {
    it("应该监听服务断开连接事件", async () => {
      const eventSpy = vi.fn();
      eventBus.onEvent("service:restart:requested", eventSpy);

      // 模拟服务断开连接
      eventBus.emitEvent("mcp:service:disconnected", {
        serviceName: "test-service",
        reason: "connection_lost",
        disconnectionTime: new Date(),
      });

      // 等待异步处理
      await new Promise((resolve) => setTimeout(resolve, 50));

      // 验证重启请求事件被触发
      expect(eventSpy).toHaveBeenCalled();
      const eventData = eventSpy.mock.calls[0][0];
      expect(eventData.serviceName).toBe("test-service");
      expect(eventData.reason).toBe("connection_lost");
    });

    it("应该监听服务连接失败事件", async () => {
      const eventSpy = vi.fn();
      eventBus.onEvent("service:restart:requested", eventSpy);

      // 模拟连接失败
      eventBus.emitEvent("mcp:service:connection:failed", {
        serviceName: "test-service",
        error: new Error("Connection failed"),
        attempt: 1,
      });

      // 等待异步处理
      await new Promise((resolve) => setTimeout(resolve, 50));

      // 验证重启请求事件被触发
      expect(eventSpy).toHaveBeenCalled();
    });

    it("应该监听服务连接成功事件", async () => {
      // 先让服务变为不健康状态
      eventBus.emitEvent("mcp:service:disconnected", {
        serviceName: "test-service",
        reason: "connection_lost",
        disconnectionTime: new Date(),
      });

      await new Promise((resolve) => setTimeout(resolve, 50));

      // 模拟服务连接成功
      eventBus.emitEvent("mcp:service:connected", {
        serviceName: "test-service",
        tools: [],
        connectionTime: new Date(),
      });

      await new Promise((resolve) => setTimeout(resolve, 50));

      // 验证服务恢复健康状态
      const health = serviceRestartManager.getServiceHealth("test-service");
      expect(health).toBe(ServiceHealthStatus.HEALTHY);
    });
  });

  describe("手动重启测试", () => {
    it("应该正确触发手动重启", async () => {
      const eventSpy = vi.fn();
      eventBus.onEvent("service:restart:started", eventSpy);

      // 监听重启执行事件并立即发送完成事件以避免超时重试
      eventBus.onEvent("service:restart:execute", (data: any) => {
        // 立即发送完成事件来模拟重启成功
        eventBus.emitEvent("service:restart:completed", {
          serviceName: data.serviceName,
          reason: data.reason,
          attempt: data.attempt,
          timestamp: Date.now(),
        });
      });

      await serviceRestartManager.triggerManualRestart(
        "test-service",
        "manual restart test"
      );

      // 验证重启开始事件被触发
      expect(eventSpy).toHaveBeenCalled();
      const eventData = eventSpy.mock.calls[0][0];
      expect(eventData.serviceName).toBe("test-service");
      expect(eventData.reason).toBe("manual restart test");
    });

    it("应该在手动重启时更新健康状态", async () => {
      // 监听重启执行事件并立即发送完成事件以避免超时重试
      eventBus.onEvent("service:restart:execute", (data: any) => {
        // 立即发送完成事件来模拟重启成功
        eventBus.emitEvent("service:restart:completed", {
          serviceName: data.serviceName,
          reason: data.reason,
          attempt: data.attempt,
          timestamp: Date.now(),
        });
      });

      await serviceRestartManager.triggerManualRestart("test-service");

      const health = serviceRestartManager.getServiceHealth("test-service");
      expect(health).toBe(ServiceHealthStatus.UNHEALTHY);
    });
  });

  describe("健康状态管理测试", () => {
    it("应该正确跟踪健康状态变化", async () => {
      const healthSpy = vi.fn();
      eventBus.onEvent("service:health:changed", healthSpy);

      // 模拟健康状态变化
      eventBus.emitEvent("mcp:service:disconnected", {
        serviceName: "test-service",
        reason: "connection_lost",
        disconnectionTime: new Date(),
      });

      await new Promise((resolve) => setTimeout(resolve, 50));

      // 验证健康状态变化事件
      expect(healthSpy).toHaveBeenCalled();
      const healthData = healthSpy.mock.calls[0][0];
      expect(healthData.serviceName).toBe("test-service");
      expect(healthData.newStatus).toBe(ServiceHealthStatus.UNHEALTHY);
    });

    it("应该正确重置服务状态", () => {
      // 先设置一些状态
      eventBus.emitEvent("mcp:service:disconnected", {
        serviceName: "test-service",
        reason: "connection_lost",
        disconnectionTime: new Date(),
      });

      return new Promise((resolve) => {
        setTimeout(() => {
          // 重置服务状态
          serviceRestartManager.resetServiceStatus("test-service");

          // 验证状态被重置
          const health = serviceRestartManager.getServiceHealth("test-service");
          expect(health).toBe(ServiceHealthStatus.UNKNOWN);

          resolve(null);
        }, 100);
      });
    });
  });

  describe("重启统计测试", () => {
    it("应该正确处理空统计", () => {
      const stats = serviceRestartManager.getRestartStats(
        "non-existent-service"
      );

      expect(stats.totalRestarts).toBe(0);
      expect(stats.successfulRestarts).toBe(0);
      expect(stats.failedRestarts).toBe(0);
      expect(stats.successRate).toBe(0);
    });
  });

  describe("错误处理和边界情况测试", () => {
    it("应该正确处理最大重试次数", async () => {
      const failSpy = vi.fn();
      eventBus.onEvent("service:restart:failed", failSpy);

      // 创建一个最大尝试次数为1的管理器
      const limitedManager = new ServiceRestartManager({
        maxAttempts: 1,
        initialDelay: 10,
        enableJitter: false,
      });

      try {
        // 触发多次失败
        eventBus.emitEvent("mcp:service:connection:failed", {
          serviceName: "test-service",
          error: new Error("Connection failed"),
          attempt: 1,
        });

        // 等待处理
        await new Promise((resolve) => setTimeout(resolve, 100));

        // 再次触发失败
        eventBus.emitEvent("mcp:service:connection:failed", {
          serviceName: "test-service",
          error: new Error("Connection failed"),
          attempt: 2,
        });

        await new Promise((resolve) => setTimeout(resolve, 100));

        // 验证服务被标记为降级状态
        const health = limitedManager.getServiceHealth("test-service");
        expect(health).toBe(ServiceHealthStatus.DEGRADED);
      } finally {
        limitedManager.destroy();
      }
    });
  });

  describe("并发控制移除验证测试", () => {
    it("应该直接执行重启而不使用并发控制", async () => {
      const executeSpy = vi.fn();

      // 监听重启执行事件
      eventBus.onEvent("service:restart:execute", executeSpy);

      // 触发手动重启
      await serviceRestartManager.triggerManualRestart(
        "test-service",
        "concurrency test"
      );

      // 验证重启执行事件被直接触发（没有并发控制）
      expect(executeSpy).toHaveBeenCalled();
      const eventData = executeSpy.mock.calls[0][0];
      expect(eventData.serviceName).toBe("test-service");
      expect(eventData.reason).toBe("concurrency test");
    });

    it("应该能够处理多个并发重启请求", async () => {
      // 清理之前可能的残留事件监听器
      eventBus.removeAllListeners();

      const executeSpy = vi.fn();

      // 监听重启执行事件并立即发送完成事件以避免超时重试
      eventBus.onEvent("service:restart:execute", (data: any) => {
        executeSpy(data);
        // 立即发送完成事件来模拟重启成功
        eventBus.emitEvent("service:restart:completed", {
          serviceName: data.serviceName,
          reason: data.reason,
          attempt: data.attempt,
          timestamp: Date.now(),
        });
      });

      // 同时触发多个重启请求
      const restartPromises = [
        serviceRestartManager.triggerManualRestart("service1", "restart 1"),
        serviceRestartManager.triggerManualRestart("service2", "restart 2"),
        serviceRestartManager.triggerManualRestart("service3", "restart 3"),
      ];

      await Promise.all(restartPromises);

      // 验证所有目标服务的重启请求都被处理（过滤掉可能的残留调用）
      const targetServiceCalls = executeSpy.mock.calls.filter((call) =>
        ["service1", "service2", "service3"].includes(call[0].serviceName)
      );
      expect(targetServiceCalls).toHaveLength(3);

      // 验证所有服务都触发了重启
      const serviceNames = targetServiceCalls.map(
        (call) => call[0].serviceName
      );
      expect(serviceNames).toContain("service1");
      expect(serviceNames).toContain("service2");
      expect(serviceNames).toContain("service3");
    });
  });
});

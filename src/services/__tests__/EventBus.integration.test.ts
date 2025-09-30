#!/usr/bin/env node

/**
 * 事件系统集成测试
 * 测试EventBus、ToolSyncManager、ServiceRestartManager等组件的事件交互
 */

import type { Tool } from "@modelcontextprotocol/sdk/types.js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ConfigManager } from "../../configManager.js";
import { logger } from "../../Logger.js";
import { getEventBus } from "../../services/EventBus.js";
import { ToolSyncManager } from "../../services/ToolSyncManager.js";
import { globalServiceRestartManager } from "../../utils/ServiceRestartManager.js";

// 模拟ConfigManager
const createMockConfigManager = () => {
  const config = {
    mcpServers: {},
    customMCP: [],
  };

  return {
    getConfig: () => config,
    updateMcpServer: (name: string, serverConfig: any) => {
      config.mcpServers[name] = serverConfig;
    },
    removeMcpServer: (name: string) => {
      delete config.mcpServers[name];
    },
    getCustomMCPTools: () => config.customMCP,
    addCustomMCPTools: async (tools: any[]) => {
      config.customMCP.push(...tools);
    },
    updateCustomMCPTools: async (tools: any[]) => {
      config.customMCP = tools;
    },
    getServerToolsConfig: (serviceName: string) => {
      return config.mcpServers[serviceName]?.tools || {};
    },
  };
};

describe("事件系统集成测试", () => {
  let eventBus: any;
  let configManager: any;
  let toolSyncManager: ToolSyncManager;
  let logger: any;

  beforeEach(() => {
    // 重置单例
    (global as any).eventBusInstance = null;

    eventBus = getEventBus();
    configManager = createMockConfigManager();
    logger = logger.withTag("EventIntegrationTest");

    toolSyncManager = new ToolSyncManager(configManager, logger);

    // 重置服务重启管理器
    globalServiceRestartManager.destroy();
  });

  afterEach(() => {
    // 清理
    eventBus.removeAllListeners();
    globalServiceRestartManager.destroy();
  });

  describe("MCP服务事件流测试", () => {
    it("应该正确处理服务添加事件链", async () => {
      // 设置监听器
      const eventLog: string[] = [];

      eventBus.onEvent("mcp:server:added", (data) => {
        eventLog.push(`server_added:${data.serverName}`);
      });

      eventBus.onEvent("tool-sync:request-service-tools", (data) => {
        eventLog.push(`sync_requested:${data.serviceName}`);
      });

      // 模拟服务添加事件
      eventBus.emitEvent("mcp:server:added", {
        serverName: "test-server",
        config: { command: "node", args: ["server.js"] },
        tools: ["tool1", "tool2"],
        timestamp: new Date(),
      });

      // 等待异步处理
      await new Promise((resolve) => setTimeout(resolve, 100));

      // 验证事件链
      expect(eventLog).toContain("server_added:test-server");
    });

    it("应该正确处理服务移除事件链", async () => {
      // 先添加一些工具
      await configManager.addCustomMCPTools([
        {
          name: "test-server__tool1",
          description: "Test tool 1",
          inputSchema: {},
          handler: {
            type: "mcp",
            config: { serviceName: "test-server", toolName: "tool1" },
          },
        },
      ]);

      // 设置监听器
      const eventLog: string[] = [];

      eventBus.onEvent("mcp:server:removed", (data) => {
        eventLog.push(`server_removed:${data.serverName}`);
      });

      eventBus.onEvent("tool-sync:service-tools-removed", (data) => {
        eventLog.push(`tools_removed:${data.serverName}:${data.removedCount}`);
      });

      // 模拟服务移除事件
      eventBus.emitEvent("mcp:server:removed", {
        serverName: "test-server",
        affectedTools: ["test-server__tool1"],
        timestamp: new Date(),
      });

      // 等待异步处理
      await new Promise((resolve) => setTimeout(resolve, 100));

      // 验证事件链
      expect(eventLog).toContain("server_removed:test-server");
    });

    it("应该正确处理服务状态变化事件", async () => {
      const statusChanges: Array<{
        serverName: string;
        oldStatus: string;
        newStatus: string;
      }> = [];

      eventBus.onEvent("mcp:server:status_changed", (data) => {
        statusChanges.push({
          serverName: data.serverName,
          oldStatus: data.oldStatus,
          newStatus: data.newStatus,
        });
      });

      // 模拟状态变化
      eventBus.emitEvent("mcp:server:status_changed", {
        serverName: "test-server",
        oldStatus: "disconnected",
        newStatus: "connected",
        timestamp: new Date(),
        reason: "connection_established",
      });

      // 模拟断开连接
      eventBus.emitEvent("mcp:server:status_changed", {
        serverName: "test-server",
        oldStatus: "connected",
        newStatus: "disconnected",
        timestamp: new Date(),
        reason: "connection_lost",
      });

      // 验证状态变化记录
      expect(statusChanges).toHaveLength(2);
      expect(statusChanges[0].newStatus).toBe("connected");
      expect(statusChanges[1].newStatus).toBe("disconnected");
    });
  });

  describe("服务重启事件流测试", () => {
    it("应该正确处理服务重启事件链", async () => {
      const restartEvents: Array<{
        type: string;
        serviceName: string;
        attempt: number;
      }> = [];

      // 监听所有重启相关事件
      eventBus.onEvent("service:restart:requested", (data) => {
        restartEvents.push({
          type: "requested",
          serviceName: data.serviceName,
          attempt: data.attempt,
        });
      });

      eventBus.onEvent("service:restart:started", (data) => {
        restartEvents.push({
          type: "started",
          serviceName: data.serviceName,
          attempt: data.attempt,
        });
      });

      eventBus.onEvent("service:restart:completed", (data) => {
        restartEvents.push({
          type: "completed",
          serviceName: data.serviceName,
          attempt: data.attempt,
        });
      });

      // 模拟服务断开连接，触发重启
      eventBus.emitEvent("mcp:service:disconnected", {
        serviceName: "restart-test-server",
        reason: "connection_lost",
        disconnectionTime: new Date(),
      });

      // 等待异步处理
      await new Promise((resolve) => setTimeout(resolve, 1500));

      // 验证重启事件流程
      expect(restartEvents.length).toBeGreaterThan(0);

      const requestedEvent = restartEvents.find((e) => e.type === "requested");
      expect(requestedEvent).toBeDefined();
      expect(requestedEvent?.serviceName).toBe("restart-test-server");
    });

    it("应该正确处理健康状态变化事件", async () => {
      const healthChanges: Array<{
        serviceName: string;
        oldStatus: string;
        newStatus: string;
      }> = [];

      eventBus.onEvent("service:health:changed", (data) => {
        healthChanges.push({
          serviceName: data.serviceName,
          oldStatus: data.oldStatus,
          newStatus: data.newStatus,
        });
      });

      // 模拟健康状态变化
      eventBus.emitEvent("service:health:changed", {
        serviceName: "health-test-server",
        oldStatus: "healthy",
        newStatus: "unhealthy",
        timestamp: Date.now(),
      });

      // 模拟恢复健康
      eventBus.emitEvent("service:health:changed", {
        serviceName: "health-test-server",
        oldStatus: "unhealthy",
        newStatus: "healthy",
        timestamp: Date.now(),
      });

      // 验证健康状态变化
      expect(healthChanges).toHaveLength(2);
      expect(healthChanges[0].newStatus).toBe("unhealthy");
      expect(healthChanges[1].newStatus).toBe("healthy");
    });
  });

  describe("工具同步事件流测试", () => {
    it("应该正确处理配置更新事件", async () => {
      const syncEvents: Array<{
        type: string;
        serviceName?: string;
      }> = [];

      eventBus.onEvent("tool-sync:server-tools-updated", (data) => {
        syncEvents.push({
          type: "server-tools-updated",
          serviceName: data.serviceName,
        });
      });

      eventBus.onEvent("tool-sync:general-config-updated", (data) => {
        syncEvents.push({ type: "general-config-updated" });
      });

      // 模拟配置更新
      eventBus.emitEvent("config:updated", {
        type: "customMCP",
        timestamp: new Date(),
      });

      // 模拟服务器工具配置更新
      eventBus.emitEvent("config:updated", {
        type: "serverTools",
        serviceName: "test-server",
        timestamp: new Date(),
      });

      // 等待异步处理
      await new Promise((resolve) => setTimeout(resolve, 100));

      // 验证同步事件
      expect(syncEvents).toContainEqual({ type: "general-config-updated" });
      expect(syncEvents).toContainEqual({
        type: "server-tools-updated",
        serviceName: "test-server",
      });
    });

    it("应该正确处理工具同步完成事件", async () => {
      const toolSyncEvents: Array<{
        type: string;
        serviceName: string;
        toolCount?: number;
      }> = [];

      eventBus.onEvent("tool-sync:service-tools-removed", (data) => {
        toolSyncEvents.push({
          type: "service-tools-removed",
          serviceName: data.serviceName,
          toolCount: data.removedCount,
        });
      });

      // 模拟工具移除
      eventBus.emitEvent("tool-sync:service-tools-removed", {
        serviceName: "sync-test-server",
        removedCount: 3,
        timestamp: new Date(),
      });

      // 等待异步处理
      await new Promise((resolve) => setTimeout(resolve, 50));

      // 验证工具同步事件
      expect(toolSyncEvents).toContainEqual({
        type: "service-tools-removed",
        serviceName: "sync-test-server",
        toolCount: 3,
      });
    });
  });

  describe("事件总线性能测试", () => {
    it("应该能够处理大量并发事件", async () => {
      const eventCount = 1000;
      const receivedEvents: number[] = [];

      eventBus.onEvent("test:performance", (data) => {
        receivedEvents.push(data.id);
      });

      // 发送大量事件
      const startTime = Date.now();
      for (let i = 0; i < eventCount; i++) {
        eventBus.emitEvent("test:performance", {
          id: i,
          timestamp: Date.now(),
        });
      }

      // 等待处理完成
      await new Promise((resolve) => setTimeout(resolve, 1000));

      const endTime = Date.now();
      const duration = endTime - startTime;

      // 验证所有事件都被接收
      expect(receivedEvents.length).toBe(eventCount);

      // 验证事件顺序（应该是有序的）
      for (let i = 0; i < eventCount; i++) {
        expect(receivedEvents[i]).toBe(i);
      }

      console.log(`处理 ${eventCount} 个事件耗时: ${duration}ms`);

      // 性能应该合理（1000个事件应该在1秒内完成）
      expect(duration).toBeLessThan(2000);
    });

    it("应该能够处理复杂的事件链", async () => {
      const complexEvents: string[] = [];

      // 设置复杂的事件链
      eventBus.onEvent("chain:start", (data) => {
        complexEvents.push(`start:${data.id}`);

        // 触发下一个事件
        eventBus.emitEvent("chain:middle", {
          id: data.id,
          step: 2,
          timestamp: Date.now(),
        });
      });

      eventBus.onEvent("chain:middle", (data) => {
        complexEvents.push(`middle:${data.id}:${data.step}`);

        // 触发最终事件
        eventBus.emitEvent("chain:end", {
          id: data.id,
          step: 3,
          timestamp: Date.now(),
        });
      });

      eventBus.onEvent("chain:end", (data) => {
        complexEvents.push(`end:${data.id}:${data.step}`);
      });

      // 启动多个事件链
      for (let i = 0; i < 10; i++) {
        eventBus.emitEvent("chain:start", {
          id: i,
          timestamp: Date.now(),
        });
      }

      // 等待处理完成
      await new Promise((resolve) => setTimeout(resolve, 500));

      // 验证复杂事件链
      expect(complexEvents.length).toBe(30); // 10个链 × 3个事件

      // 验证每个完整的链
      for (let i = 0; i < 10; i++) {
        expect(complexEvents).toContain(`start:${i}`);
        expect(complexEvents).toContain(`middle:${i}:2`);
        expect(complexEvents).toContain(`end:${i}:3`);
      }
    });
  });

  describe("事件错误处理测试", () => {
    it("应该正确处理监听器错误", async () => {
      const errorEvents: any[] = [];

      // 监听EventBus错误
      eventBus.on("error", (error) => {
        errorEvents.push(error);
      });

      // 添加一个会抛出错误的监听器
      eventBus.onEvent("test:error", () => {
        throw new Error("Test listener error");
      });

      // 添加一个正常的监听器
      const normalEvents: any[] = [];
      eventBus.onEvent("test:error", (data) => {
        normalEvents.push(data);
      });

      // 发射事件
      eventBus.emitEvent("test:error", {
        id: 1,
        timestamp: Date.now(),
      });

      // 等待处理
      await new Promise((resolve) => setTimeout(resolve, 100));

      // 验证正常监听器仍然工作
      expect(normalEvents).toHaveLength(1);
      expect(normalEvents[0].id).toBe(1);

      // 错误应该被捕获和处理
      expect(errorEvents.length).toBeGreaterThan(0);
    });

    it("应该能够移除监听器", async () => {
      const events: any[] = [];

      const listener = (data: any) => {
        events.push(data);
      };

      // 添加监听器
      eventBus.onEvent("test:remove", listener);

      // 发射事件
      eventBus.emitEvent("test:remove", { id: 1 });

      // 移除监听器
      eventBus.offEvent("test:remove", listener);

      // 再次发射事件
      eventBus.emitEvent("test:remove", { id: 2 });

      // 等待处理
      await new Promise((resolve) => setTimeout(resolve, 50));

      // 验证只有第一个事件被接收
      expect(events).toHaveLength(1);
      expect(events[0].id).toBe(1);
    });
  });
});

/**
 * toolSorters 工具函数测试
 */

import type { EnhancedToolInfo } from "@/lib/mcp/index.js";
import { describe, expect, it } from "vitest";
import { sortTools, toolSorters } from "./toolSorters";

// 创建模拟工具数据
function createMockTool(
  overrides: Partial<EnhancedToolInfo> = {}
): EnhancedToolInfo {
  return {
    name: "test-server__test-tool",
    originalName: "test-tool",
    serviceName: "test-server",
    description: "测试工具",
    inputSchema: { type: "object" },
    enabled: true,
    usageCount: 0,
    lastUsedTime: "2024-01-01 00:00:00",
    ...overrides,
  };
}

describe("toolSorters", () => {
  describe("按名称排序", () => {
    it("应该按服务名排序", () => {
      const tools = [
        createMockTool({
          serviceName: "服务B",
          originalName: "tool1",
          name: "服务B__tool1",
        }),
        createMockTool({
          serviceName: "服务A",
          originalName: "tool2",
          name: "服务A__tool2",
        }),
        createMockTool({
          serviceName: "服务C",
          originalName: "tool3",
          name: "服务C__tool3",
        }),
      ];

      const sorted = [...tools].sort(toolSorters.name);

      expect(sorted[0].serviceName).toBe("服务A");
      expect(sorted[1].serviceName).toBe("服务B");
      expect(sorted[2].serviceName).toBe("服务C");
    });

    it("服务名相同时应该按工具名排序", () => {
      const tools = [
        createMockTool({
          serviceName: "服务A",
          originalName: "tool2",
          name: "服务A__tool2",
        }),
        createMockTool({
          serviceName: "服务A",
          originalName: "tool1",
          name: "服务A__tool1",
        }),
        createMockTool({
          serviceName: "服务A",
          originalName: "tool3",
          name: "服务A__tool3",
        }),
      ];

      const sorted = [...tools].sort(toolSorters.name);

      expect(sorted[0].originalName).toBe("tool1");
      expect(sorted[1].originalName).toBe("tool2");
      expect(sorted[2].originalName).toBe("tool3");
    });

    it("应该正确处理中文排序", () => {
      const tools = [
        createMockTool({
          serviceName: "张三",
          originalName: "tool1",
          name: "张三__tool1",
        }),
        createMockTool({
          serviceName: "李四",
          originalName: "tool2",
          name: "李四__tool2",
        }),
        createMockTool({
          serviceName: "王五",
          originalName: "tool3",
          name: "王五__tool3",
        }),
      ];

      const sorted = [...tools].sort(toolSorters.name);

      // 中文拼音排序：李四 < 王五 < 张三
      expect(sorted[0].serviceName).toBe("李四");
      expect(sorted[1].serviceName).toBe("王五");
      expect(sorted[2].serviceName).toBe("张三");
    });
  });

  describe("按启用状态排序", () => {
    it("已启用的工具应该排在前面", () => {
      const tools = [
        createMockTool({
          enabled: false,
          originalName: "tool1",
          name: "server__tool1",
        }),
        createMockTool({
          enabled: true,
          originalName: "tool2",
          name: "server__tool2",
        }),
        createMockTool({
          enabled: false,
          originalName: "tool3",
          name: "server__tool3",
        }),
      ];

      const sorted = [...tools].sort(toolSorters.enabled);

      expect(sorted[0].enabled).toBe(true);
      expect(sorted[1].enabled).toBe(false);
      expect(sorted[2].enabled).toBe(false);
    });

    it("同状态下应该按名称排序", () => {
      const tools = [
        createMockTool({
          enabled: true,
          serviceName: "服务B",
          originalName: "tool1",
          name: "服务B__tool1",
        }),
        createMockTool({
          enabled: true,
          serviceName: "服务A",
          originalName: "tool2",
          name: "服务A__tool2",
        }),
      ];

      const sorted = [...tools].sort(toolSorters.enabled);

      expect(sorted[0].serviceName).toBe("服务A");
      expect(sorted[1].serviceName).toBe("服务B");
    });
  });

  describe("按使用次数排序", () => {
    it("使用次数多的工具应该排在前面", () => {
      const tools = [
        createMockTool({
          usageCount: 5,
          originalName: "tool1",
          name: "server__tool1",
        }),
        createMockTool({
          usageCount: 10,
          originalName: "tool2",
          name: "server__tool2",
        }),
        createMockTool({
          usageCount: 1,
          originalName: "tool3",
          name: "server__tool3",
        }),
      ];

      const sorted = [...tools].sort(toolSorters.usageCount);

      expect(sorted[0].usageCount).toBe(10);
      expect(sorted[1].usageCount).toBe(5);
      expect(sorted[2].usageCount).toBe(1);
    });

    it("使用次数相同时应该按名称排序", () => {
      const tools = [
        createMockTool({
          usageCount: 5,
          serviceName: "服务B",
          originalName: "tool1",
          name: "服务B__tool1",
        }),
        createMockTool({
          usageCount: 5,
          serviceName: "服务A",
          originalName: "tool2",
          name: "服务A__tool2",
        }),
      ];

      const sorted = [...tools].sort(toolSorters.usageCount);

      expect(sorted[0].serviceName).toBe("服务A");
      expect(sorted[1].serviceName).toBe("服务B");
    });
  });

  describe("按最近使用时间排序", () => {
    it("最近使用的工具应该排在前面", () => {
      const tools = [
        createMockTool({
          lastUsedTime: "2024-01-01 00:00:00",
          originalName: "tool1",
          name: "server__tool1",
        }),
        createMockTool({
          lastUsedTime: "2024-01-03 00:00:00",
          originalName: "tool2",
          name: "server__tool2",
        }),
        createMockTool({
          lastUsedTime: "2024-01-02 00:00:00",
          originalName: "tool3",
          name: "server__tool3",
        }),
      ];

      const sorted = [...tools].sort(toolSorters.lastUsedTime);

      expect(sorted[0].lastUsedTime).toBe("2024-01-03 00:00:00");
      expect(sorted[1].lastUsedTime).toBe("2024-01-02 00:00:00");
      expect(sorted[2].lastUsedTime).toBe("2024-01-01 00:00:00");
    });

    it("未使用时间的工具应该排在后面", () => {
      const tools = [
        createMockTool({
          lastUsedTime: "2024-01-01 00:00:00",
          originalName: "tool1",
          name: "server__tool1",
        }),
        createMockTool({
          lastUsedTime: "",
          originalName: "tool2",
          name: "server__tool2",
        }),
        createMockTool({
          lastUsedTime: "2024-01-02 00:00:00",
          originalName: "tool3",
          name: "server__tool3",
        }),
      ];

      const sorted = [...tools].sort(toolSorters.lastUsedTime);

      // 有时间的应该排在前面，没有时间的排在后面
      expect(sorted[2].lastUsedTime).toBe("");
    });

    it("时间相同时应该按名称排序", () => {
      const tools = [
        createMockTool({
          lastUsedTime: "2024-01-01 00:00:00",
          serviceName: "服务B",
          originalName: "tool1",
          name: "服务B__tool1",
        }),
        createMockTool({
          lastUsedTime: "2024-01-01 00:00:00",
          serviceName: "服务A",
          originalName: "tool2",
          name: "服务A__tool2",
        }),
      ];

      const sorted = [...tools].sort(toolSorters.lastUsedTime);

      expect(sorted[0].serviceName).toBe("服务A");
      expect(sorted[1].serviceName).toBe("服务B");
    });
  });

  describe("边界情况处理", () => {
    it("应该正确处理 null/undefined 值", () => {
      const tools = [
        createMockTool({
          lastUsedTime: null as unknown as string,
          originalName: "tool1",
          name: "server__tool1",
        }),
        createMockTool({
          lastUsedTime: undefined as unknown as string,
          originalName: "tool2",
          name: "server__tool2",
        }),
        createMockTool({
          lastUsedTime: "2024-01-01 00:00:00",
          originalName: "tool3",
          name: "server__tool3",
        }),
      ];

      const sorted = [...tools].sort(toolSorters.lastUsedTime);

      // 有时间的应该排在前面
      expect(sorted[0].lastUsedTime).toBe("2024-01-01 00:00:00");
    });

    it("空数组应该返回空数组", () => {
      const sorted = sortTools([], { field: "name" });
      expect(sorted).toEqual([]);
    });

    it("单个元素数组应该返回原数组", () => {
      const tools = [createMockTool()];
      const sorted = sortTools(tools, { field: "name" });
      expect(sorted).toEqual(tools);
    });
  });

  describe("sortTools 函数", () => {
    it("应该正确应用排序配置", () => {
      const tools = [
        createMockTool({
          usageCount: 5,
          originalName: "tool1",
          name: "server__tool1",
        }),
        createMockTool({
          usageCount: 10,
          originalName: "tool2",
          name: "server__tool2",
        }),
      ];

      const sorted = sortTools(tools, { field: "usageCount" });

      expect(sorted[0].usageCount).toBe(10);
      expect(sorted[1].usageCount).toBe(5);
    });

    it("不应该修改原数组", () => {
      const tools = [
        createMockTool({
          serviceName: "服务B",
          originalName: "tool1",
          name: "服务B__tool1",
        }),
        createMockTool({
          serviceName: "服务A",
          originalName: "tool2",
          name: "服务A__tool2",
        }),
      ];

      const originalOrder = [...tools];
      sortTools(tools, { field: "name" });

      expect(tools).toEqual(originalOrder);
    });
  });
});

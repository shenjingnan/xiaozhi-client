#!/usr/bin/env node

/**
 * CustomMCPHandler 集成测试
 * 测试与实际配置文件的集成
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { configManager } from "../../configManager.js";
import { CustomMCPHandler } from "../CustomMCPHandler.js";

// Mock logger
vi.mock("../../Logger.js", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

describe("CustomMCPHandler 集成测试", () => {
  let handler: InstanceType<typeof CustomMCPHandler>;

  beforeEach(() => {
    handler = new CustomMCPHandler();
    vi.clearAllMocks();
  });

  describe("与实际配置文件集成", () => {
    it("应该能够读取实际配置文件中的 customMCP 工具", () => {
      // 不使用 mock，直接读取实际配置
      const customTools = configManager.getCustomMCPTools();

      // 验证能够读取到工具
      expect(Array.isArray(customTools)).toBe(true);

      // 如果配置文件中有工具，验证其结构
      if (customTools.length > 0) {
        const tool = customTools[0];
        expect(tool).toHaveProperty("name");
        expect(tool).toHaveProperty("description");
        expect(tool).toHaveProperty("inputSchema");
        expect(tool).toHaveProperty("handler");
        expect(tool.handler).toHaveProperty("type");
      }
    });

    it("应该能够初始化并加载实际配置中的工具", () => {
      // 使用实际配置初始化
      handler.initialize();

      const customTools = configManager.getCustomMCPTools();
      expect(handler.getToolCount()).toBe(customTools.length);

      // 验证工具名称匹配
      const handlerToolNames = handler.getToolNames();
      const configToolNames = customTools.map((tool) => tool.name);
      expect(handlerToolNames).toEqual(configToolNames);
    });

    it("应该能够获取标准 MCP 格式的工具列表", () => {
      handler.initialize();

      const tools = handler.getTools();
      expect(Array.isArray(tools)).toBe(true);

      // 验证每个工具都有必需的字段
      for (const tool of tools) {
        expect(tool).toHaveProperty("name");
        expect(tool).toHaveProperty("description");
        expect(tool).toHaveProperty("inputSchema");
        expect(typeof tool.name).toBe("string");
        expect(typeof tool.description).toBe("string");
        expect(typeof tool.inputSchema).toBe("object");
      }
    });

    it("应该能够检查工具是否存在", () => {
      handler.initialize();

      const customTools = configManager.getCustomMCPTools();

      if (customTools.length > 0) {
        const firstTool = customTools[0];
        expect(handler.hasTool(firstTool.name)).toBe(true);
      }

      expect(handler.hasTool("nonexistent_tool")).toBe(false);
    });

    it("应该能够获取工具详细信息", () => {
      handler.initialize();

      const customTools = configManager.getCustomMCPTools();

      if (customTools.length > 0) {
        const firstTool = customTools[0];
        const toolInfo = handler.getToolInfo(firstTool.name);

        expect(toolInfo).toEqual(firstTool);
      }
    });

    it("应该能够尝试调用实际配置中的工具", async () => {
      handler.initialize();

      const customTools = configManager.getCustomMCPTools();

      if (customTools.length > 0) {
        const firstTool = customTools[0];

        // 尝试调用工具（应该返回"功能正在开发中"的消息）
        const result = await handler.callTool(firstTool.name, {});

        expect(result).toHaveProperty("content");
        expect(result).toHaveProperty("isError");
        expect(Array.isArray(result.content)).toBe(true);
        expect(result.content.length).toBeGreaterThan(0);
        expect(result.content[0]).toHaveProperty("type", "text");
        expect(result.content[0]).toHaveProperty("text");
        expect(typeof result.content[0].text).toBe("string");
      }
    });

    it("应该正确处理配置验证", () => {
      // 验证配置管理器的验证功能
      const hasValidTools = configManager.hasValidCustomMCPTools();
      expect(typeof hasValidTools).toBe("boolean");

      if (hasValidTools) {
        const customTools = configManager.getCustomMCPTools();
        expect(customTools.length).toBeGreaterThan(0);

        // 验证每个工具都通过验证
        const isValid = configManager.validateCustomMCPTools(customTools);
        expect(isValid).toBe(true);
      }
    });

    it("应该能够清理资源", () => {
      handler.initialize();
      const initialCount = handler.getToolCount();

      handler.cleanup();

      expect(handler.getToolCount()).toBe(0);
      expect(handler.getToolNames()).toEqual([]);
    });
  });

  describe("错误处理", () => {
    it("应该优雅处理配置读取错误", () => {
      // 临时替换 configManager 方法来模拟错误
      const originalMethod = configManager.getCustomMCPTools;
      configManager.getCustomMCPTools = vi.fn().mockImplementation(() => {
        throw new Error("配置读取失败");
      });

      expect(() => handler.initialize()).toThrow("配置读取失败");

      // 恢复原方法
      configManager.getCustomMCPTools = originalMethod;
    });

    it("应该处理空配置", () => {
      // 临时替换 configManager 方法来返回空数组
      const originalMethod = configManager.getCustomMCPTools;
      configManager.getCustomMCPTools = vi.fn().mockReturnValue([]);

      handler.initialize();

      expect(handler.getToolCount()).toBe(0);
      expect(handler.getTools()).toEqual([]);
      expect(handler.getToolNames()).toEqual([]);

      // 恢复原方法
      configManager.getCustomMCPTools = originalMethod;
    });
  });

  describe("性能测试", () => {
    it("应该能够快速初始化", () => {
      const startTime = Date.now();
      handler.initialize();
      const endTime = Date.now();

      // 初始化应该在 100ms 内完成
      expect(endTime - startTime).toBeLessThan(100);
    });

    it("应该能够快速获取工具列表", () => {
      handler.initialize();

      const startTime = Date.now();
      const tools = handler.getTools();
      const endTime = Date.now();

      // 获取工具列表应该在 10ms 内完成
      expect(endTime - startTime).toBeLessThan(10);
      expect(Array.isArray(tools)).toBe(true);
    });
  });
});

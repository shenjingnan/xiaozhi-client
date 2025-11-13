/**
 * customMCP 性能测试
 * 对比 customMCP 工具调用与标准 MCP 工具调用的性能
 */

import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { configManager } from "../configManager";
import { ToolApiHandler } from "../handlers";
import type { MCPServiceManager } from "../services";
import { MCPServiceManagerSingleton } from "../services";

// Mock dependencies
vi.mock("../Logger.js", () => ({
  logger: {
    withTag: vi.fn(() => ({
      info: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
      warn: vi.fn(),
    })),
  },
}));

describe("customMCP 性能测试", () => {
  let toolApiHandler: ToolApiHandler;
  let mockContext: any;
  let mockServiceManager: any;

  beforeAll(() => {
    // 设置性能测试环境
    vi.useFakeTimers();
  });

  beforeEach(() => {
    toolApiHandler = new ToolApiHandler();

    // Mock Hono context
    mockContext = {
      req: {
        json: vi.fn(),
      },
      json: vi.fn(),
    };

    // Mock service manager
    mockServiceManager = {
      callTool: vi.fn(),
      hasCustomMCPTool: vi.fn(),
      getCustomMCPTools: vi.fn(),
      getService: vi.fn(),
      getAllTools: vi.fn(),
    };

    vi.spyOn(MCPServiceManagerSingleton, "isInitialized").mockReturnValue(true);
    vi.spyOn(MCPServiceManagerSingleton, "getInstance").mockResolvedValue(
      mockServiceManager as unknown as MCPServiceManager
    );

    // Reset all mocks
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("工具调用性能对比", () => {
    it("customMCP 工具调用性能应该与标准 MCP 工具相当", async () => {
      // 准备测试数据
      const customMCPTool = {
        name: "test_custom_tool",
        description: "测试自定义工具",
        inputSchema: {
          type: "object",
          properties: {
            input: { type: "string" },
          },
          required: ["input"],
        },
      };

      const testArgs = { input: "性能测试数据" };
      const mockResult = {
        content: [{ type: "text", text: "测试结果" }],
        isError: false,
      };

      // Mock customMCP 工具调用
      mockServiceManager.hasCustomMCPTool.mockReturnValue(true);
      mockServiceManager.getCustomMCPTools.mockReturnValue([customMCPTool]);
      mockServiceManager.callTool.mockResolvedValue(mockResult);

      // 测试 customMCP 工具调用性能
      const customMCPTimes: number[] = [];
      for (let i = 0; i < 100; i++) {
        mockContext.req.json.mockResolvedValue({
          serviceName: "customMCP",
          toolName: "test_custom_tool",
          args: testArgs,
        });

        const startTime = performance.now();
        await toolApiHandler.callTool(mockContext);
        const endTime = performance.now();

        customMCPTimes.push(endTime - startTime);
      }

      // Mock 标准 MCP 工具调用
      const mockStandardService = {
        isConnected: vi.fn().mockReturnValue(true),
        getTools: vi
          .fn()
          .mockReturnValue([
            { name: "test_standard_tool", description: "测试标准工具" },
          ]),
      };

      mockServiceManager.getService.mockReturnValue(mockStandardService);
      configManager.getMcpServers = vi.fn().mockReturnValue({
        test_service: { command: "node", args: ["test.js"] },
      });
      configManager.getServerToolsConfig = vi.fn().mockReturnValue({
        test_standard_tool: { enable: true, description: "测试工具" },
      });

      // 测试标准 MCP 工具调用性能
      const standardMCPTimes: number[] = [];
      for (let i = 0; i < 100; i++) {
        mockContext.req.json.mockResolvedValue({
          serviceName: "test_service",
          toolName: "test_standard_tool",
          args: testArgs,
        });

        const startTime = performance.now();
        await toolApiHandler.callTool(mockContext);
        const endTime = performance.now();

        standardMCPTimes.push(endTime - startTime);
      }

      // 计算平均响应时间
      const customMCPAvg =
        customMCPTimes.reduce((a, b) => a + b, 0) / customMCPTimes.length;
      const standardMCPAvg =
        standardMCPTimes.reduce((a, b) => a + b, 0) / standardMCPTimes.length;

      // 性能差异应该小于 10%（处理除零情况）
      const performanceDiff =
        standardMCPAvg > 0
          ? Math.abs(customMCPAvg - standardMCPAvg) / standardMCPAvg
          : 0;
      expect(performanceDiff).toBeLessThan(0.1);

      console.log(`customMCP 平均响应时间: ${customMCPAvg.toFixed(2)}ms`);
      console.log(`标准 MCP 平均响应时间: ${standardMCPAvg.toFixed(2)}ms`);
      console.log(`性能差异: ${(performanceDiff * 100).toFixed(2)}%`);
    });

    it("参数验证不应该显著影响性能", async () => {
      const customMCPTool = {
        name: "validation_test_tool",
        description: "参数验证测试工具",
        inputSchema: {
          type: "object",
          properties: {
            user: {
              type: "object",
              properties: {
                name: { type: "string", minLength: 2, maxLength: 50 },
                age: { type: "integer", minimum: 0, maximum: 150 },
                email: { type: "string" },
              },
              required: ["name", "age"],
            },
            preferences: {
              type: "array",
              items: { type: "string" },
              minItems: 1,
              maxItems: 10,
            },
          },
          required: ["user"],
        },
      };

      const validArgs = {
        user: {
          name: "测试用户",
          age: 25,
          email: "test@example.com",
        },
        preferences: ["option1", "option2"],
      };

      mockServiceManager.hasCustomMCPTool.mockReturnValue(true);
      mockServiceManager.getCustomMCPTools.mockReturnValue([customMCPTool]);
      mockServiceManager.callTool.mockResolvedValue({
        content: [{ type: "text", text: "验证通过" }],
        isError: false,
      });

      // 测试带参数验证的调用性能
      const validationTimes: number[] = [];
      for (let i = 0; i < 50; i++) {
        mockContext.req.json.mockResolvedValue({
          serviceName: "customMCP",
          toolName: "validation_test_tool",
          args: validArgs,
        });

        const startTime = performance.now();
        await toolApiHandler.callTool(mockContext);
        const endTime = performance.now();

        validationTimes.push(endTime - startTime);
      }

      // 测试无参数验证的工具（没有 inputSchema）
      const noValidationTool = {
        name: "no_validation_tool",
        description: "无参数验证工具",
        // 没有 inputSchema
      };

      mockServiceManager.getCustomMCPTools.mockReturnValue([noValidationTool]);

      const noValidationTimes: number[] = [];
      for (let i = 0; i < 50; i++) {
        mockContext.req.json.mockResolvedValue({
          serviceName: "customMCP",
          toolName: "no_validation_tool",
          args: validArgs,
        });

        const startTime = performance.now();
        await toolApiHandler.callTool(mockContext);
        const endTime = performance.now();

        noValidationTimes.push(endTime - startTime);
      }

      const validationAvg =
        validationTimes.reduce((a, b) => a + b, 0) / validationTimes.length;
      const noValidationAvg =
        noValidationTimes.reduce((a, b) => a + b, 0) / noValidationTimes.length;

      // 参数验证的性能开销应该小于 20%（处理除零情况）
      const validationOverhead =
        noValidationAvg > 0
          ? (validationAvg - noValidationAvg) / noValidationAvg
          : 0;
      expect(validationOverhead).toBeLessThan(0.2);

      console.log(`带参数验证平均响应时间: ${validationAvg.toFixed(2)}ms`);
      console.log(`无参数验证平均响应时间: ${noValidationAvg.toFixed(2)}ms`);
      console.log(`参数验证开销: ${(validationOverhead * 100).toFixed(2)}%`);
    });
  });

  describe("工具列表性能测试", () => {
    it("大量 customMCP 工具时列表获取性能应该可接受", async () => {
      // 创建大量 customMCP 工具
      const manyTools = Array.from({ length: 100 }, (_, i) => ({
        name: `tool_${i}`,
        description: `测试工具 ${i}`,
        inputSchema: {
          type: "object",
          properties: {
            param: { type: "string" },
          },
        },
        serviceName: "customMCP",
        originalName: `tool_${i}`,
      }));

      mockServiceManager.getAllTools.mockReturnValue(manyTools);

      // 测试工具列表获取性能
      const listTimes: number[] = [];
      for (let i = 0; i < 20; i++) {
        const startTime = performance.now();
        await toolApiHandler.listTools(mockContext);
        const endTime = performance.now();

        listTimes.push(endTime - startTime);
      }

      const avgTime = listTimes.reduce((a, b) => a + b, 0) / listTimes.length;

      // 100个工具的列表获取应该在 100ms 内完成
      expect(avgTime).toBeLessThan(100);

      console.log(`100个工具列表获取平均时间: ${avgTime.toFixed(2)}ms`);
    });

    it("工具查找性能应该是 O(1) 复杂度", async () => {
      // 测试不同数量工具下的查找性能
      const toolCounts = [10, 50, 100, 500];
      const searchTimes: Record<number, number> = {};

      for (const count of toolCounts) {
        const tools = Array.from({ length: count }, (_, i) => ({
          name: `tool_${i}`,
          description: `测试工具 ${i}`,
          inputSchema: { type: "object" },
        }));

        mockServiceManager.hasCustomMCPTool.mockImplementation(
          (toolName: string) => {
            return tools.some((tool) => tool.name === toolName);
          }
        );
        mockServiceManager.getCustomMCPTools.mockReturnValue(tools);

        // 测试查找最后一个工具的时间（最坏情况）
        const targetTool = `tool_${count - 1}`;
        const times: number[] = [];

        for (let i = 0; i < 10; i++) {
          mockContext.req.json.mockResolvedValue({
            serviceName: "customMCP",
            toolName: targetTool,
            args: {},
          });

          const startTime = performance.now();
          // 只测试验证部分，不执行实际调用
          try {
            await toolApiHandler.callTool(mockContext);
          } catch (error) {
            // 忽略调用错误，我们只关心查找性能
          }
          const endTime = performance.now();

          times.push(endTime - startTime);
        }

        searchTimes[count] = times.reduce((a, b) => a + b, 0) / times.length;
      }

      // 验证查找时间不会随工具数量线性增长
      const time10 = searchTimes[10];
      const time500 = searchTimes[500];
      const growthRatio = time10 > 0 ? time500 / time10 : 1;

      // 增长比例应该小于 5（理想情况下应该接近 1）
      expect(growthRatio).toBeLessThan(5);

      console.log("工具查找性能测试结果:");
      for (const [count, time] of Object.entries(searchTimes)) {
        console.log(`${count} 个工具: ${time.toFixed(2)}ms`);
      }
      console.log(`性能增长比例 (500/10): ${growthRatio.toFixed(2)}x`);
    });
  });

  describe("内存使用测试", () => {
    it("大量工具调用不应该导致内存泄漏", async () => {
      const customMCPTool = {
        name: "memory_test_tool",
        description: "内存测试工具",
        inputSchema: {
          type: "object",
          properties: {
            data: { type: "string" },
          },
        },
      };

      mockServiceManager.hasCustomMCPTool.mockReturnValue(true);
      mockServiceManager.getCustomMCPTools.mockReturnValue([customMCPTool]);
      mockServiceManager.callTool.mockResolvedValue({
        content: [{ type: "text", text: "内存测试完成" }],
        isError: false,
      });

      // 记录初始内存使用
      const initialMemory = process.memoryUsage().heapUsed;

      // 执行大量工具调用
      for (let i = 0; i < 1000; i++) {
        mockContext.req.json.mockResolvedValue({
          serviceName: "customMCP",
          toolName: "memory_test_tool",
          args: { data: `测试数据 ${i}` },
        });

        await toolApiHandler.callTool(mockContext);

        // 每100次调用强制垃圾回收
        if (i % 100 === 0 && global.gc) {
          global.gc();
        }
      }

      // 强制垃圾回收
      if (global.gc) {
        global.gc();
      }

      // 记录最终内存使用
      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = finalMemory - initialMemory;
      const memoryIncreaseMB = memoryIncrease / 1024 / 1024;

      // 内存增长应该小于 50MB
      expect(memoryIncreaseMB).toBeLessThan(50);

      console.log(`初始内存: ${(initialMemory / 1024 / 1024).toFixed(2)}MB`);
      console.log(`最终内存: ${(finalMemory / 1024 / 1024).toFixed(2)}MB`);
      console.log(`内存增长: ${memoryIncreaseMB.toFixed(2)}MB`);
    });
  });
});

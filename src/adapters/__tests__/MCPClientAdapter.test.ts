/**
 * MCPClientAdapter 测试
 * 验证适配器的功能和兼容性
 */

import type { Tool } from "@modelcontextprotocol/sdk/types.js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { MCPServiceConfig } from "../../services/MCPService.js";
import { MCPService, MCPTransportType } from "../../services/MCPService.js";
import { MCPClientAdapter } from "../MCPClientAdapter.js";

// Mock MCPService
vi.mock("../../services/MCPService.js", async (importOriginal) => {
  const actual = (await importOriginal()) as any;
  return {
    ...actual,
    MCPService: vi.fn().mockImplementation(() => ({
      connect: vi.fn().mockResolvedValue(undefined),
      disconnect: vi.fn().mockResolvedValue(undefined),
      getTools: vi.fn().mockReturnValue([]),
      callTool: vi.fn().mockResolvedValue({
        content: [{ type: "text", text: '{"result": "success"}' }],
        isError: false,
      }),
      getStatus: vi.fn().mockReturnValue({
        name: "test-service",
        connected: true,
        initialized: true,
        transportType: "stdio",
        toolCount: 0,
        reconnectAttempts: 0,
        connectionState: "connected",
        pingEnabled: true,
        pingFailureCount: 0,
        isPinging: false,
      }),
      isConnected: vi.fn().mockReturnValue(true),
    })),
  };
});

describe("MCPClientAdapter", () => {
  let adapter: MCPClientAdapter;
  let mockMCPService: any;
  const testConfig: MCPServiceConfig = {
    name: "test-service",
    type: MCPTransportType.STDIO,
    command: "node",
    args: ["test.js"],
  };

  beforeEach(() => {
    vi.clearAllMocks();
    adapter = new MCPClientAdapter("test-service", testConfig);
    // 获取 mock 的 MCPService 实例
    mockMCPService = (adapter as any).mcpService;

    // 确保所有方法都是 mock 函数
    if (!mockMCPService.connect?.mockReturnValue) {
      mockMCPService.connect = vi.fn().mockResolvedValue(undefined);
    }
    if (!mockMCPService.disconnect?.mockReturnValue) {
      mockMCPService.disconnect = vi.fn().mockResolvedValue(undefined);
    }
    if (!mockMCPService.getTools?.mockReturnValue) {
      mockMCPService.getTools = vi.fn().mockReturnValue([]);
    }
    if (!mockMCPService.callTool?.mockReturnValue) {
      mockMCPService.callTool = vi.fn().mockResolvedValue({
        content: [{ type: "text", text: '{"result": "success"}' }],
        isError: false,
      });
    }
    if (!mockMCPService.getStatus?.mockReturnValue) {
      mockMCPService.getStatus = vi.fn().mockReturnValue({
        name: "test-service",
        connected: true,
        initialized: true,
        transportType: "stdio",
        toolCount: 0,
        reconnectAttempts: 0,
        connectionState: "connected",
        pingEnabled: true,
        pingFailureCount: 0,
        isPinging: false,
      });
    }
    if (!mockMCPService.isConnected?.mockReturnValue) {
      mockMCPService.isConnected = vi.fn().mockReturnValue(true);
    }
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("构造函数", () => {
    it("应该正确创建适配器实例", () => {
      expect(adapter).toBeInstanceOf(MCPClientAdapter);
      expect(adapter.initialized).toBe(false);
      expect(adapter.tools).toEqual([]);
      expect(adapter.originalTools).toEqual([]);
    });

    it("应该使用正确的配置创建 MCPService", () => {
      expect(MCPService).toHaveBeenCalledWith({
        ...testConfig,
        name: "test-service",
      });
    });
  });

  describe("start 方法", () => {
    it("应该成功启动服务", async () => {
      const mockTools: Tool[] = [
        {
          name: "calculate",
          description: "Calculate numbers",
          inputSchema: { type: "object", properties: {} },
        },
      ];
      mockMCPService.getTools.mockReturnValue(mockTools);

      await adapter.start();

      expect(mockMCPService.connect).toHaveBeenCalledOnce();
      expect(adapter.initialized).toBe(true);
      expect(adapter.originalTools).toEqual(mockTools);
      expect(adapter.tools).toHaveLength(1);
      expect(adapter.tools[0].name).toBe("test_service_xzcli_calculate");
    });

    it("应该在连接失败时抛出错误", async () => {
      const error = new Error("Connection failed");
      mockMCPService.connect.mockRejectedValue(error);

      await expect(adapter.start()).rejects.toThrow("Connection failed");
      expect(adapter.initialized).toBe(false);
    });
  });

  describe("refreshTools 方法", () => {
    it("应该正确刷新工具列表", async () => {
      const mockTools: Tool[] = [
        {
          name: "add",
          description: "Add numbers",
          inputSchema: { type: "object", properties: {} },
        },
        {
          name: "subtract",
          description: "Subtract numbers",
          inputSchema: { type: "object", properties: {} },
        },
      ];
      mockMCPService.getTools.mockReturnValue(mockTools);

      await adapter.refreshTools();

      expect(adapter.originalTools).toEqual(mockTools);
      expect(adapter.tools).toHaveLength(2);
      expect(adapter.tools[0].name).toBe("test_service_xzcli_add");
      expect(adapter.tools[1].name).toBe("test_service_xzcli_subtract");
    });

    it("应该在获取工具失败时抛出错误", async () => {
      const error = new Error("Failed to get tools");
      mockMCPService.getTools.mockImplementation(() => {
        throw error;
      });

      await expect(adapter.refreshTools()).rejects.toThrow(
        "Failed to get tools"
      );
    });
  });

  describe("callTool 方法", () => {
    beforeEach(async () => {
      const mockTools: Tool[] = [
        {
          name: "calculate",
          description: "Calculate numbers",
          inputSchema: { type: "object", properties: {} },
        },
      ];
      mockMCPService.getTools.mockReturnValue(mockTools);
      await adapter.start();
    });

    it("应该成功调用工具", async () => {
      const args = { a: 1, b: 2 };
      const expectedResult = { result: "success" };
      mockMCPService.callTool.mockResolvedValue({
        content: [{ type: "text", text: JSON.stringify(expectedResult) }],
        isError: false,
      });

      const result = await adapter.callTool(
        "test_service_xzcli_calculate",
        args
      );

      expect(mockMCPService.callTool).toHaveBeenCalledWith("calculate", args);
      expect(result).toEqual(expectedResult);
    });

    it("应该在工具名称无效时抛出错误", async () => {
      await expect(adapter.callTool("invalid_tool_name", {})).rejects.toThrow(
        "无效的工具名称格式: invalid_tool_name"
      );
    });

    it("应该在工具调用失败时抛出错误", async () => {
      const error = new Error("Tool execution failed");
      mockMCPService.callTool.mockRejectedValue(error);

      await expect(
        adapter.callTool("test_service_xzcli_calculate", {})
      ).rejects.toThrow("Tool execution failed");
    });

    it("应该处理错误结果", async () => {
      mockMCPService.callTool.mockResolvedValue({
        content: [{ type: "text", text: "Error occurred" }],
        isError: true,
      });

      await expect(
        adapter.callTool("test_service_xzcli_calculate", {})
      ).rejects.toThrow("Error occurred");
    });
  });

  describe("stop 方法", () => {
    it("应该成功停止服务", async () => {
      await adapter.start();
      await adapter.stop();

      expect(mockMCPService.disconnect).toHaveBeenCalledOnce();
      expect(adapter.initialized).toBe(false);
      expect(adapter.tools).toEqual([]);
      expect(adapter.originalTools).toEqual([]);
    });

    it("应该在断开连接失败时抛出错误", async () => {
      const error = new Error("Disconnect failed");
      mockMCPService.disconnect.mockRejectedValue(error);

      await expect(adapter.stop()).rejects.toThrow("Disconnect failed");
    });
  });

  describe("getOriginalToolName 方法", () => {
    it("应该正确解析带前缀的工具名称", () => {
      const originalName = adapter.getOriginalToolName(
        "test_service_xzcli_calculate"
      );
      expect(originalName).toBe("calculate");
    });

    it("应该处理带连字符的服务名称", () => {
      const adapterWithHyphen = new MCPClientAdapter(
        "test-service-name",
        testConfig
      );
      const originalName = adapterWithHyphen.getOriginalToolName(
        "test_service_name_xzcli_calculate"
      );
      expect(originalName).toBe("calculate");
    });

    it("应该在前缀不匹配时返回 null", () => {
      const originalName = adapter.getOriginalToolName(
        "wrong_prefix_calculate"
      );
      expect(originalName).toBeNull();
    });

    it("应该在没有前缀时返回 null", () => {
      const originalName = adapter.getOriginalToolName("calculate");
      expect(originalName).toBeNull();
    });
  });

  describe("工具前缀生成", () => {
    it("应该为普通服务名生成正确的前缀", () => {
      const adapter = new MCPClientAdapter("calculator", testConfig);
      const prefixedName = (adapter as any).generatePrefixedToolName("add");
      expect(prefixedName).toBe("calculator_xzcli_add");
    });

    it("应该为带连字符的服务名生成正确的前缀", () => {
      const adapter = new MCPClientAdapter("my-calculator-service", testConfig);
      const prefixedName = (adapter as any).generatePrefixedToolName("add");
      expect(prefixedName).toBe("my_calculator_service_xzcli_add");
    });
  });

  describe("结果转换", () => {
    it("应该正确转换 JSON 文本结果", () => {
      const result = {
        content: [{ type: "text", text: '{"value": 42}' }],
        isError: false,
      };
      const converted = (adapter as any).convertToolCallResult(result);
      expect(converted).toEqual({ value: 42 });
    });

    it("应该正确转换纯文本结果", () => {
      const result = {
        content: [{ type: "text", text: "Hello World" }],
        isError: false,
      };
      const converted = (adapter as any).convertToolCallResult(result);
      expect(converted).toBe("Hello World");
    });

    it("应该正确转换多内容结果", () => {
      const result = {
        content: [
          { type: "text", text: "First part" },
          { type: "text", text: "Second part" },
        ],
        isError: false,
      };
      const converted = (adapter as any).convertToolCallResult(result);
      expect(converted).toEqual(result.content);
    });

    it("应该在空内容时返回空对象", () => {
      const result = {
        content: [],
        isError: false,
      };
      const converted = (adapter as any).convertToolCallResult(result);
      expect(converted).toEqual({});
    });
  });

  describe("扩展方法", () => {
    it("应该返回服务状态", () => {
      const status = adapter.getServiceStatus();
      expect(status.name).toBe("test-service");
      expect(status.connected).toBe(true);
    });

    it("应该返回底层 MCPService 实例", () => {
      const service = adapter.getMCPService();
      expect(service).toBe(mockMCPService);
    });
  });
});

/**
 * ToolCallService 测试
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { ToolCallService } from "./ToolCallService.js";

// Mock fetch for HTTP API calls
global.fetch = vi.fn();

// Mock ProcessManager
const mockGetServiceStatus = vi.fn().mockReturnValue({ running: false, pid: null });

vi.mock("../cli/services/ProcessManager.js", () => ({
  ProcessManagerImpl: vi.fn().mockImplementation(() => ({
    getServiceStatus: mockGetServiceStatus,
  })),
}));

describe("ToolCallService", () => {
  let toolCallService: ToolCallService;

  beforeEach(() => {
    // Reset all mocks before each test
    vi.clearAllMocks();
    // Reset the mock to default behavior
    mockGetServiceStatus.mockReturnValue({ running: false, pid: null });
    toolCallService = new ToolCallService();
  });

  describe("parseJsonArgs", () => {
    it("应该正确解析有效的 JSON 字符串", () => {
      const jsonString = '{"a": 10, "b": 20}';
      const result = toolCallService.parseJsonArgs(jsonString);
      expect(result).toEqual({ a: 10, b: 20 });
    });

    it("应该正确解析空对象", () => {
      const jsonString = "{}";
      const result = toolCallService.parseJsonArgs(jsonString);
      expect(result).toEqual({});
    });

    it("应该正确解析复杂的 JSON 对象", () => {
      const jsonString =
        '{"user": {"name": "test", "age": 25}, "items": [1, 2, 3]}';
      const result = toolCallService.parseJsonArgs(jsonString);
      expect(result).toEqual({
        user: { name: "test", age: 25 },
        items: [1, 2, 3],
      });
    });

    it("应该在 JSON 格式错误时抛出错误", () => {
      const invalidJson = "invalid-json";
      expect(() => toolCallService.parseJsonArgs(invalidJson)).toThrow(
        "参数格式错误，请使用有效的 JSON 格式"
      );
    });

    it("应该在 JSON 语法错误时抛出错误", () => {
      const invalidJson = '{"a": 10, "b":}';
      expect(() => toolCallService.parseJsonArgs(invalidJson)).toThrow(
        "参数格式错误，请使用有效的 JSON 格式"
      );
    });
  });

  describe("formatOutput", () => {
    it("应该正确格式化工具调用结果", () => {
      const result = {
        content: [
          {
            type: "text",
            text: "30",
          },
        ],
      };

      const formatted = toolCallService.formatOutput(result);
      const expected = JSON.stringify(result);
      expect(formatted).toBe(expected);
    });

    it("应该正确格式化包含错误的结果", () => {
      const result = {
        content: [
          {
            type: "text",
            text: "Error occurred",
          },
        ],
        isError: true,
      };

      const formatted = toolCallService.formatOutput(result);
      const expected = JSON.stringify(result);
      expect(formatted).toBe(expected);
    });

    it("应该正确格式化复杂的结果对象", () => {
      const result = {
        content: [
          {
            type: "text",
            text: "Result 1",
          },
          {
            type: "json",
            text: '{"data": "value"}',
          },
        ],
      };

      const formatted = toolCallService.formatOutput(result);
      const expected = JSON.stringify(result);
      expect(formatted).toBe(expected);
    });
  });

  describe("getServiceStatus", () => {
    it("应该在进程未运行时返回正确状态", async () => {
      // ProcessManager is already mocked to return service not running
      const status = await toolCallService.getServiceStatus();
      expect(status).toBe("服务未启动");
    });

    it("应该在进程运行但 Web API 不可访问时返回正确状态", async () => {
      // Mock ProcessManager to return service running for this test
      mockGetServiceStatus.mockReturnValueOnce({
        running: true,
        pid: 12345,
      });

      // Mock fetch to simulate connection failure
      const mockFetch = vi.mocked(fetch);
      mockFetch.mockRejectedValueOnce(new Error("Connection failed"));

      const status = await toolCallService.getServiceStatus();
      expect(status).toBe("服务进程运行中 (PID: 12345)，但无法连接到 Web API");
    });

    it("应该在服务完全正常时返回正确状态", async () => {
      // Mock ProcessManager to return service running for this test
      mockGetServiceStatus.mockReturnValueOnce({
        running: true,
        pid: 12345,
      });

      // Mock fetch to simulate successful API response
      const mockFetch = vi.mocked(fetch);
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: { totalTools: 5 },
        }),
      } as Response);

      const status = await toolCallService.getServiceStatus();
      expect(status).toBe("服务已启动 (PID: 12345, 5 个工具可用)");
    });
  });

  describe("callTool", () => {
    it("应该通过 HTTP API 成功调用工具", async () => {
      // Mock ProcessManager to return service running for this test
      mockGetServiceStatus.mockReturnValueOnce({
        running: true,
        pid: 12345,
      });

      // Mock successful status check
      const mockFetch = vi.mocked(fetch);
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ success: true }),
        } as Response)
        // Mock successful tool call
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            success: true,
            data: {
              content: [{ type: "text", text: "3" }],
            },
          }),
        } as Response);

      const result = await toolCallService.callTool(
        "calculator",
        "calculator",
        {
          javascript_expression: "1+2",
        }
      );

      expect(result).toEqual({
        content: [{ type: "text", text: "3" }],
      });

      // Verify the correct API endpoint was called
      expect(mockFetch).toHaveBeenCalledWith(
        "http://localhost:9999/api/tools/call",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            serviceName: "calculator",
            toolName: "calculator",
            args: { javascript_expression: "1+2" },
          }),
        }
      );
    });

    it("应该在 HTTP API 调用失败时抛出错误", async () => {
      // Mock ProcessManager to return service running for this test
      mockGetServiceStatus.mockReturnValueOnce({
        running: true,
        pid: 12345,
      });

      // Mock successful status check but failed tool call
      const mockFetch = vi.mocked(fetch);
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ success: true }),
        } as Response)
        // Mock failed tool call
        .mockResolvedValueOnce({
          ok: false,
          status: 500,
          statusText: "Internal Server Error",
          json: async () => ({
            success: false,
            error: { message: "工具调用失败" },
          }),
        } as Response);

      await expect(
        toolCallService.callTool("calculator", "calculator", {
          javascript_expression: "1+2",
        })
      ).rejects.toThrow("工具调用失败");
    });
  });
});

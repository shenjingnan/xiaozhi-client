/**
 * MCPService 会话过期处理和重试机制测试
 * 测试新增的会话过期检测和自动重连功能
 */

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Logger } from "../../Logger.js";
import {
  MCPService,
  type MCPServiceConfig,
  MCPTransportType,
} from "../MCPService.js";
import { TransportFactory } from "../TransportFactory.js";

// Mock dependencies
vi.mock("@modelcontextprotocol/sdk/client/index.js");
vi.mock("@modelcontextprotocol/sdk/client/sse.js");
vi.mock("../../Logger.js");
vi.mock("../TransportFactory.js");

describe("MCPService 会话过期处理和重试机制", () => {
  let mockClient: any;
  let mockTransport: any;
  let mockLogger: any;
  let service: MCPService;
  let config: MCPServiceConfig;

  beforeEach(() => {
    vi.clearAllMocks();

    // Mock Client
    mockClient = {
      connect: vi.fn(),
      close: vi.fn(),
      listTools: vi.fn(),
      callTool: vi.fn(),
    };
    vi.mocked(Client).mockImplementation(() => mockClient);

    // Mock SSEClientTransport
    mockTransport = {};
    vi.mocked(SSEClientTransport).mockImplementation(() => mockTransport);

    // Mock TransportFactory
    vi.mocked(TransportFactory).validateConfig = vi.fn();
    vi.mocked(TransportFactory).create = vi.fn().mockReturnValue(mockTransport);

    // Mock Logger
    mockLogger = {
      info: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
      debug: vi.fn(),
      withTag: vi.fn().mockReturnThis(),
    };
    vi.mocked(Logger).mockImplementation(() => mockLogger);

    // ModelScope SSE 配置
    config = {
      name: "test-modelscope-service",
      type: MCPTransportType.MODELSCOPE_SSE,
      url: "https://mcp.api-inference.modelscope.net/test/sse",
      apiKey: "test-api-key",
    };

    service = new MCPService(config);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("isSessionExpiredError 私有方法测试", () => {
    // 通过反射访问私有方法进行测试
    const getIsSessionExpiredError = (service: MCPService) => {
      return (service as any).isSessionExpiredError.bind(service);
    };

    it("应该正确识别HTTP 401 SessionExpired错误", () => {
      const errorMessage =
        'Error POSTing to endpoint (HTTP 401): {"RequestId":"d98c565a-dc43-4969-9604-59e986bb526f","Code":"SessionExpired","Message":"session 418fa2f92d8f4411b378da98ed22dfea is expired"}';
      const isSessionExpiredError = getIsSessionExpiredError(service);

      expect(isSessionExpiredError(errorMessage)).toBe(true);
    });

    it("应该正确识别包含session expired的错误", () => {
      const errorMessage = "The session has expired, please reconnect";
      const isSessionExpiredError = getIsSessionExpiredError(service);

      expect(isSessionExpiredError(errorMessage)).toBe(true);
    });

    it("应该正确识别不是会话过期的错误", () => {
      const errorMessage = "Network connection failed";
      const isSessionExpiredError = getIsSessionExpiredError(service);

      expect(isSessionExpiredError(errorMessage)).toBe(false);
    });

    it("应该正确识别HTTP 401但不是SessionExpired的错误", () => {
      const errorMessage =
        'Error POSTing to endpoint (HTTP 401): {"Code":"Unauthorized","Message":"Invalid token"}';
      const isSessionExpiredError = getIsSessionExpiredError(service);

      expect(isSessionExpiredError(errorMessage)).toBe(false);
    });

    it("应该正确识别包含session但不是expired的错误", () => {
      const errorMessage = "Session initialization failed";
      const isSessionExpiredError = getIsSessionExpiredError(service);

      expect(isSessionExpiredError(errorMessage)).toBe(false);
    });
  });

  describe("callTool 会话过期处理", () => {
    beforeEach(async () => {
      // 模拟连接成功
      mockClient.connect.mockResolvedValue(undefined);
      mockClient.listTools.mockResolvedValue({
        tools: [
          { name: "test-tool", description: "Test tool", inputSchema: {} },
        ],
      });

      await service.connect();
    });

    it("应该正常调用工具（无错误情况）", async () => {
      const mockResult = { content: [{ type: "text", text: "Success" }] };
      mockClient.callTool.mockResolvedValue(mockResult);

      const result = await service.callTool("test-tool", { param: "value" });

      expect(mockClient.callTool).toHaveBeenCalledTimes(1);
      expect(mockClient.callTool).toHaveBeenCalledWith({
        name: "test-tool",
        arguments: { param: "value" },
      });
      expect(result).toEqual(mockResult);
    });

    it("应该在HTTP 401 SessionExpired错误时自动重连并重试", async () => {
      const sessionExpiredError = new Error(
        'Error POSTing to endpoint (HTTP 401): {"Code":"SessionExpired","Message":"session abc123 is expired"}'
      );
      const successResult = { content: [{ type: "text", text: "success" }] };

      // 第一次调用失败（会话过期），第二次调用成功
      mockClient.callTool
        .mockRejectedValueOnce(sessionExpiredError)
        .mockResolvedValueOnce(successResult);

      // Mock reconnect 方法
      const reconnectSpy = vi.spyOn(service, "reconnect").mockResolvedValue();

      const result = await service.callTool("test-tool", {});

      expect(result).toEqual(successResult);
      expect(reconnectSpy).toHaveBeenCalledTimes(1);
      expect(mockClient.callTool).toHaveBeenCalledTimes(2);
    });

    it("应该在包含session expired文本的错误时自动重连并重试", async () => {
      const sessionExpiredError = new Error(
        "The session has expired, please reconnect"
      );
      const successResult = { content: [{ type: "text", text: "success" }] };

      mockClient.callTool
        .mockRejectedValueOnce(sessionExpiredError)
        .mockResolvedValueOnce(successResult);

      const reconnectSpy = vi.spyOn(service, "reconnect").mockResolvedValue();

      const result = await service.callTool("test-tool", {});

      expect(result).toEqual(successResult);
      expect(reconnectSpy).toHaveBeenCalledTimes(1);
      expect(mockClient.callTool).toHaveBeenCalledTimes(2);
    });

    it("应该在重连失败时抛出原始错误", async () => {
      const sessionExpiredError = new Error(
        'Error POSTing to endpoint (HTTP 401): {"Code":"SessionExpired","Message":"session abc123 is expired"}'
      );
      const reconnectError = new Error("Reconnect failed");

      mockClient.callTool.mockRejectedValue(sessionExpiredError);
      const reconnectSpy = vi
        .spyOn(service, "reconnect")
        .mockRejectedValue(reconnectError);

      await expect(service.callTool("test-tool", {})).rejects.toThrow(
        sessionExpiredError
      );
      expect(reconnectSpy).toHaveBeenCalledTimes(1);
      expect(mockClient.callTool).toHaveBeenCalledTimes(1);
    });

    it("应该在非会话过期错误时直接抛出错误（不触发重连）", async () => {
      const networkError = new Error("Network connection failed");

      mockClient.callTool.mockRejectedValue(networkError);
      const reconnectSpy = vi.spyOn(service, "reconnect");

      await expect(service.callTool("test-tool", {})).rejects.toThrow(
        networkError
      );
      expect(reconnectSpy).not.toHaveBeenCalled();
      expect(mockClient.callTool).toHaveBeenCalledTimes(1);
    });

    it("应该在重试后仍然失败时抛出错误", async () => {
      const sessionExpiredError = new Error(
        'Error POSTing to endpoint (HTTP 401): {"Code":"SessionExpired","Message":"session abc123 is expired"}'
      );

      // 两次调用都失败
      mockClient.callTool.mockRejectedValue(sessionExpiredError);
      const reconnectSpy = vi.spyOn(service, "reconnect").mockResolvedValue();

      await expect(service.callTool("test-tool", {})).rejects.toThrow(
        sessionExpiredError
      );
      expect(reconnectSpy).toHaveBeenCalledTimes(1);
      expect(mockClient.callTool).toHaveBeenCalledTimes(2);
    });

    it("应该只在第一次失败时检测会话过期（避免无限重试）", async () => {
      const sessionExpiredError = new Error(
        'Error POSTing to endpoint (HTTP 401): {"Code":"SessionExpired","Message":"session abc123 is expired"}'
      );

      // 两次调用都失败，但第二次不应该触发重连
      mockClient.callTool.mockRejectedValue(sessionExpiredError);
      const reconnectSpy = vi.spyOn(service, "reconnect").mockResolvedValue();

      await expect(service.callTool("test-tool", {})).rejects.toThrow(
        sessionExpiredError
      );

      // 重连只应该被调用一次（在第一次失败时）
      expect(reconnectSpy).toHaveBeenCalledTimes(1);
      expect(mockClient.callTool).toHaveBeenCalledTimes(2);
    });

    it("应该在第二次调用成功时不触发额外的重连", async () => {
      const sessionExpiredError = new Error(
        'Error POSTing to endpoint (HTTP 401): {"Code":"SessionExpired","Message":"session abc123 is expired"}'
      );
      const successResult = { content: [{ type: "text", text: "success" }] };

      mockClient.callTool
        .mockRejectedValueOnce(sessionExpiredError)
        .mockResolvedValueOnce(successResult);

      const reconnectSpy = vi.spyOn(service, "reconnect").mockResolvedValue();

      const result = await service.callTool("test-tool", {});

      expect(result).toEqual(successResult);
      expect(reconnectSpy).toHaveBeenCalledTimes(1);
      expect(mockClient.callTool).toHaveBeenCalledTimes(2);
    });
  });
});

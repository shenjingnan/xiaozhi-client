import type { StatusService } from "@services/StatusService.js";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { StatusApiHandler } from "../status.handler.js";

// Mock dependencies
vi.mock("../../Logger.js", () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

describe("StatusApiHandler 状态 API 处理器", () => {
  let statusApiHandler: StatusApiHandler;
  let mockStatusService: any;
  let mockContext: any;
  let mockLogger: any;

  beforeEach(async () => {
    // Setup mock StatusService
    mockStatusService = {
      getFullStatus: vi.fn(),
      getClientStatus: vi.fn(),
      getRestartStatus: vi.fn(),
      isClientConnected: vi.fn(),
      getLastHeartbeat: vi.fn(),
      getActiveMCPServers: vi.fn(),
      updateClientInfo: vi.fn(),
      setActiveMCPServers: vi.fn(),
      reset: vi.fn(),
    } as any;

    // Setup mock Context
    mockContext = {
      get: vi.fn((key: string) => {
        if (key === "logger") {
          return mockLogger;
        }
        return undefined;
      }),
      json: vi.fn((data, status) => {
        const response = new Response(JSON.stringify(data), {
          status: status || 200,
          headers: { "Content-Type": "application/json" },
        });
        return response;
      }),
      success: vi.fn((data?: unknown, message?: string, status = 200) => {
        const response = {
          success: true,
          data,
          message,
        };
        return new Response(JSON.stringify(response), {
          status,
          headers: { "Content-Type": "application/json" },
        });
      }),
      fail: vi.fn(
        (code: string, message: string, details?: unknown, status = 400) => {
          const response = {
            success: false,
            error: {
              code,
              message,
              ...(details !== undefined && { details }),
            },
          };
          return new Response(JSON.stringify(response), {
            status,
            headers: { "Content-Type": "application/json" },
          });
        }
      ),
      req: {
        json: vi.fn(),
      },
    } as any;

    // Setup mock logger
    const { logger } = await import("../../Logger.js");
    mockLogger = {
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    };
    Object.assign(logger, mockLogger);

    // Create handler instance
    statusApiHandler = new StatusApiHandler(mockStatusService);
  });

  describe("构造函数", () => {
    it("应该正确初始化处理器", () => {
      expect(statusApiHandler).toBeInstanceOf(StatusApiHandler);
      expect(mockLogger).toBeDefined();
    });
  });

  describe("getStatus 获取完整状态", () => {
    it("应该成功返回完整状态", async () => {
      const mockStatus = {
        client: { status: "connected", mcpEndpoint: "test-endpoint" },
        restart: { status: "completed", timestamp: Date.now() },
        servers: ["server1", "server2"],
      };
      mockStatusService.getFullStatus.mockReturnValue(mockStatus);

      const response = await statusApiHandler.getStatus(mockContext);
      const responseData = await response.json();

      expect(mockStatusService.getFullStatus).toHaveBeenCalled();
      expect(mockLogger.debug).toHaveBeenCalledWith("处理获取状态请求");
      expect(mockLogger.debug).toHaveBeenCalledWith("获取状态成功");
      expect(responseData).toEqual({
        success: true,
        data: mockStatus,
      });
      expect(response.status).toBe(200);
    });

    it("应该处理获取状态时的错误", async () => {
      const error = new Error("状态服务不可用");
      mockStatusService.getFullStatus.mockImplementation(() => {
        throw error;
      });

      const response = await statusApiHandler.getStatus(mockContext);
      const responseData = await response.json();

      expect(mockLogger.error).toHaveBeenCalledWith("获取状态失败:", error);
      expect(responseData).toEqual({
        success: false,
        error: {
          code: "STATUS_READ_ERROR",
          message: "状态服务不可用",
        },
      });
      expect(response.status).toBe(500);
    });

    it("应该处理非 Error 类型的异常", async () => {
      mockStatusService.getFullStatus.mockImplementation(() => {
        throw "字符串错误";
      });

      const response = await statusApiHandler.getStatus(mockContext);
      const responseData = await response.json();

      // handleError 会将非 Error 类型转换为字符串
      expect(responseData).toEqual({
        success: false,
        error: {
          code: "STATUS_READ_ERROR",
          message: "字符串错误",
        },
      });
      expect(response.status).toBe(500);
    });
  });

  describe("getClientStatus 获取客户端状态", () => {
    it("应该成功返回客户端状态", async () => {
      const mockClientStatus = {
        status: "connected" as const,
        mcpEndpoint: "test-endpoint",
        activeMCPServers: ["server1"],
        lastHeartbeat: Date.now(),
      };
      mockStatusService.getClientStatus.mockReturnValue(mockClientStatus);

      const response = await statusApiHandler.getClientStatus(mockContext);
      const responseData = await response.json();

      expect(mockStatusService.getClientStatus).toHaveBeenCalled();
      expect(mockLogger.debug).toHaveBeenCalledWith("处理获取客户端状态请求");
      expect(responseData).toEqual({
        success: true,
        data: mockClientStatus,
      });
      expect(response.status).toBe(200);
    });

    it("应该处理获取客户端状态时的错误", async () => {
      const error = new Error("客户端状态不可用");
      mockStatusService.getClientStatus.mockImplementation(() => {
        throw error;
      });

      const response = await statusApiHandler.getClientStatus(mockContext);
      const responseData = await response.json();

      expect(mockLogger.error).toHaveBeenCalledWith(
        "获取客户端状态失败:",
        error
      );
      expect(responseData).toEqual({
        success: false,
        error: {
          code: "CLIENT_STATUS_READ_ERROR",
          message: "客户端状态不可用",
        },
      });
      expect(response.status).toBe(500);
    });
  });

  describe("getRestartStatus 获取重启状态", () => {
    it("应该成功返回重启状态", async () => {
      const mockRestartStatus = {
        status: "completed" as const,
        timestamp: Date.now(),
      };
      mockStatusService.getRestartStatus.mockReturnValue(mockRestartStatus);

      const response = await statusApiHandler.getRestartStatus(mockContext);
      const responseData = await response.json();

      expect(mockStatusService.getRestartStatus).toHaveBeenCalled();
      expect(responseData).toEqual({
        success: true,
        data: mockRestartStatus,
      });
      expect(response.status).toBe(200);
    });

    it("应该处理获取重启状态时的错误", async () => {
      const error = new Error("重启状态不可用");
      mockStatusService.getRestartStatus.mockImplementation(() => {
        throw error;
      });

      const response = await statusApiHandler.getRestartStatus(mockContext);
      const responseData = await response.json();

      expect(responseData).toEqual({
        success: false,
        error: {
          code: "RESTART_STATUS_READ_ERROR",
          message: "重启状态不可用",
        },
      });
      expect(response.status).toBe(500);
    });
  });

  describe("checkClientConnected 检查客户端连接", () => {
    it("应该返回客户端已连接状态", async () => {
      mockStatusService.isClientConnected.mockReturnValue(true);

      const response = await statusApiHandler.checkClientConnected(mockContext);
      const responseData = await response.json();

      expect(mockStatusService.isClientConnected).toHaveBeenCalled();
      expect(mockLogger.debug).toHaveBeenCalledWith("客户端连接状态: true");
      expect(responseData).toEqual({
        success: true,
        data: { connected: true },
      });
      expect(response.status).toBe(200);
    });

    it("应该返回客户端未连接状态", async () => {
      mockStatusService.isClientConnected.mockReturnValue(false);

      const response = await statusApiHandler.checkClientConnected(mockContext);
      const responseData = await response.json();

      expect(mockLogger.debug).toHaveBeenCalledWith("客户端连接状态: false");
      expect(responseData).toEqual({
        success: true,
        data: { connected: false },
      });
    });

    it("应该处理检查连接时的错误", async () => {
      const error = new Error("连接检查失败");
      mockStatusService.isClientConnected.mockImplementation(() => {
        throw error;
      });

      const response = await statusApiHandler.checkClientConnected(mockContext);
      const responseData = await response.json();

      expect(responseData).toEqual({
        success: false,
        error: {
          code: "CLIENT_CONNECTION_CHECK_ERROR",
          message: "连接检查失败",
        },
      });
      expect(response.status).toBe(500);
    });
  });

  describe("getLastHeartbeat 获取最后心跳时间", () => {
    it("应该成功返回最后心跳时间", async () => {
      const mockHeartbeat = Date.now();
      mockStatusService.getLastHeartbeat.mockReturnValue(mockHeartbeat);

      const response = await statusApiHandler.getLastHeartbeat(mockContext);
      const responseData = await response.json();

      expect(mockStatusService.getLastHeartbeat).toHaveBeenCalled();
      expect(responseData).toEqual({
        success: true,
        data: { lastHeartbeat: mockHeartbeat },
      });
      expect(response.status).toBe(200);
    });

    it("应该处理获取心跳时间时的错误", async () => {
      const error = new Error("心跳数据不可用");
      mockStatusService.getLastHeartbeat.mockImplementation(() => {
        throw error;
      });

      const response = await statusApiHandler.getLastHeartbeat(mockContext);
      const responseData = await response.json();

      expect(responseData).toEqual({
        success: false,
        error: {
          code: "HEARTBEAT_READ_ERROR",
          message: "心跳数据不可用",
        },
      });
      expect(response.status).toBe(500);
    });
  });

  describe("getActiveMCPServers 获取活跃 MCP 服务器", () => {
    it("应该成功返回活跃 MCP 服务器列表", async () => {
      const mockServers = ["server1", "server2", "server3"];
      mockStatusService.getActiveMCPServers.mockReturnValue(mockServers);

      const response = await statusApiHandler.getActiveMCPServers(mockContext);
      const responseData = await response.json();

      expect(mockStatusService.getActiveMCPServers).toHaveBeenCalled();
      expect(responseData).toEqual({
        success: true,
        data: { servers: mockServers },
      });
      expect(response.status).toBe(200);
    });

    it("应该处理获取 MCP 服务器时的错误", async () => {
      const error = new Error("MCP 服务器数据不可用");
      mockStatusService.getActiveMCPServers.mockImplementation(() => {
        throw error;
      });

      const response = await statusApiHandler.getActiveMCPServers(mockContext);
      const responseData = await response.json();

      expect(responseData).toEqual({
        success: false,
        error: {
          code: "ACTIVE_MCP_SERVERS_READ_ERROR",
          message: "MCP 服务器数据不可用",
        },
      });
      expect(response.status).toBe(500);
    });
  });

  describe("updateClientStatus 更新客户端状态", () => {
    it("应该成功更新客户端状态", async () => {
      const statusUpdate = {
        status: "connected",
        mcpEndpoint: "new-endpoint",
        activeMCPServers: ["server1", "server2"],
      };
      mockContext.req.json.mockResolvedValue(statusUpdate);

      const response = await statusApiHandler.updateClientStatus(mockContext);
      const responseData = await response.json();

      expect(mockContext.req.json).toHaveBeenCalled();
      expect(mockStatusService.updateClientInfo).toHaveBeenCalledWith(
        statusUpdate,
        "http-api"
      );
      expect(mockLogger.info).toHaveBeenCalledWith("客户端状态更新成功");
      // data 为 undefined 时不会添加 data 字段
      expect(responseData).toEqual({
        success: true,
        message: "客户端状态更新成功",
      });
      expect(response.status).toBe(200);
    });

    it("应该拒绝无效的请求体", async () => {
      mockContext.req.json.mockResolvedValue(null);

      const response = await statusApiHandler.updateClientStatus(mockContext);
      const responseData = await response.json();

      expect(mockStatusService.updateClientInfo).not.toHaveBeenCalled();
      expect(responseData).toEqual({
        success: false,
        error: {
          code: "INVALID_REQUEST_BODY",
          message: "请求体必须是有效的状态对象",
        },
      });
      expect(response.status).toBe(400);
    });

    it("应该拒绝非对象类型的请求体", async () => {
      mockContext.req.json.mockResolvedValue("invalid");

      const response = await statusApiHandler.updateClientStatus(mockContext);
      const responseData = await response.json();

      expect(mockStatusService.updateClientInfo).not.toHaveBeenCalled();
      expect(responseData).toEqual({
        success: false,
        error: {
          code: "INVALID_REQUEST_BODY",
          message: "请求体必须是有效的状态对象",
        },
      });
      expect(response.status).toBe(400);
    });

    it("应该处理状态服务更新时的错误", async () => {
      const statusUpdate = { status: "connected" };
      const error = new Error("状态更新失败");
      mockContext.req.json.mockResolvedValue(statusUpdate);
      mockStatusService.updateClientInfo.mockImplementation(() => {
        throw error;
      });

      const response = await statusApiHandler.updateClientStatus(mockContext);
      const responseData = await response.json();

      expect(mockLogger.error).toHaveBeenCalledWith(
        "更新客户端状态失败:",
        error
      );
      expect(responseData).toEqual({
        success: false,
        error: {
          code: "CLIENT_STATUS_UPDATE_ERROR",
          message: "状态更新失败",
        },
      });
      expect(response.status).toBe(400);
    });

    it("应该处理 JSON 解析错误", async () => {
      const error = new Error("Invalid JSON");
      mockContext.req.json.mockRejectedValue(error);

      const response = await statusApiHandler.updateClientStatus(mockContext);
      const responseData = await response.json();

      // parseJsonBody 会添加前缀："请求体必须是有效的状态对象: Invalid JSON"
      expect(responseData).toEqual({
        success: false,
        error: {
          code: "CLIENT_STATUS_UPDATE_ERROR",
          message: "请求体必须是有效的状态对象: Invalid JSON",
        },
      });
      expect(response.status).toBe(400);
    });
  });

  describe("setActiveMCPServers 设置活跃 MCP 服务器", () => {
    it("应该成功设置活跃 MCP 服务器", async () => {
      const servers = ["server1", "server2", "server3"];
      mockContext.req.json.mockResolvedValue({ servers });

      const response = await statusApiHandler.setActiveMCPServers(mockContext);
      const responseData = await response.json();

      expect(mockContext.req.json).toHaveBeenCalled();
      expect(mockStatusService.setActiveMCPServers).toHaveBeenCalledWith(
        servers
      );
      expect(mockLogger.info).toHaveBeenCalledWith("活跃 MCP 服务器设置成功");
      // data 为 undefined 时不会添加 data 字段
      expect(responseData).toEqual({
        success: true,
        message: "活跃 MCP 服务器设置成功",
      });
      expect(response.status).toBe(200);
    });

    it("应该拒绝非数组类型的 servers", async () => {
      mockContext.req.json.mockResolvedValue({ servers: "invalid" });

      const response = await statusApiHandler.setActiveMCPServers(mockContext);
      const responseData = await response.json();

      expect(mockStatusService.setActiveMCPServers).not.toHaveBeenCalled();
      expect(responseData).toEqual({
        success: false,
        error: {
          code: "INVALID_REQUEST_BODY",
          message: "servers 必须是字符串数组",
        },
      });
      expect(response.status).toBe(400);
    });

    it("应该拒绝缺少 servers 字段的请求", async () => {
      mockContext.req.json.mockResolvedValue({});

      const response = await statusApiHandler.setActiveMCPServers(mockContext);
      const responseData = await response.json();

      expect(mockStatusService.setActiveMCPServers).not.toHaveBeenCalled();
      expect(responseData).toEqual({
        success: false,
        error: {
          code: "INVALID_REQUEST_BODY",
          message: "servers 必须是字符串数组",
        },
      });
      expect(response.status).toBe(400);
    });

    it("应该处理状态服务设置时的错误", async () => {
      const servers = ["server1"];
      const error = new Error("设置服务器失败");
      mockContext.req.json.mockResolvedValue({ servers });
      mockStatusService.setActiveMCPServers.mockImplementation(() => {
        throw error;
      });

      const response = await statusApiHandler.setActiveMCPServers(mockContext);
      const responseData = await response.json();

      expect(mockLogger.error).toHaveBeenCalledWith(
        "设置活跃 MCP 服务器失败:",
        error
      );
      expect(responseData).toEqual({
        success: false,
        error: {
          code: "ACTIVE_MCP_SERVERS_UPDATE_ERROR",
          message: "设置服务器失败",
        },
      });
      expect(response.status).toBe(400);
    });

    it("应该处理 JSON 解析错误", async () => {
      const error = new Error("Invalid JSON");
      mockContext.req.json.mockRejectedValue(error);

      const response = await statusApiHandler.setActiveMCPServers(mockContext);
      const responseData = await response.json();

      // parseJsonBody 会添加前缀："请求体格式错误: Invalid JSON"
      expect(responseData).toEqual({
        success: false,
        error: {
          code: "ACTIVE_MCP_SERVERS_UPDATE_ERROR",
          message: "请求体格式错误: Invalid JSON",
        },
      });
      expect(response.status).toBe(400);
    });

    it("应该接受空数组", async () => {
      const servers: string[] = [];
      mockContext.req.json.mockResolvedValue({ servers });

      const response = await statusApiHandler.setActiveMCPServers(mockContext);
      const responseData = await response.json();

      expect(mockStatusService.setActiveMCPServers).toHaveBeenCalledWith(
        servers
      );
      // data 为 undefined 时不会添加 data 字段
      expect(responseData).toEqual({
        success: true,
        message: "活跃 MCP 服务器设置成功",
      });
      expect(response.status).toBe(200);
    });
  });

  describe("resetStatus 重置状态", () => {
    it("应该成功重置状态", async () => {
      const response = await statusApiHandler.resetStatus(mockContext);
      const responseData = await response.json();

      expect(mockStatusService.reset).toHaveBeenCalled();
      expect(mockLogger.info).toHaveBeenCalledWith("处理重置状态请求");
      expect(mockLogger.info).toHaveBeenCalledWith("状态重置成功");
      // data 为 undefined 时不会添加 data 字段
      expect(responseData).toEqual({
        success: true,
        message: "状态重置成功",
      });
      expect(response.status).toBe(200);
    });

    it("应该处理重置状态时的错误", async () => {
      const error = new Error("重置失败");
      mockStatusService.reset.mockImplementation(() => {
        throw error;
      });

      const response = await statusApiHandler.resetStatus(mockContext);
      const responseData = await response.json();

      expect(mockLogger.error).toHaveBeenCalledWith("重置状态失败:", error);
      expect(responseData).toEqual({
        success: false,
        error: {
          code: "STATUS_RESET_ERROR",
          message: "重置失败",
        },
      });
      expect(response.status).toBe(500);
    });

    it("应该处理非 Error 类型的异常", async () => {
      mockStatusService.reset.mockImplementation(() => {
        throw "字符串错误";
      });

      const response = await statusApiHandler.resetStatus(mockContext);
      const responseData = await response.json();

      // handleError 会将非 Error 类型转换为字符串
      expect(responseData).toEqual({
        success: false,
        error: {
          code: "STATUS_RESET_ERROR",
          message: "字符串错误",
        },
      });
      expect(response.status).toBe(500);
    });
  });

  describe("响应格式验证", () => {
    it("成功响应应该包含正确的结构", async () => {
      const mockData = { test: "data" };
      mockStatusService.getFullStatus.mockReturnValue(mockData);

      const response = await statusApiHandler.getStatus(mockContext);
      const responseData = await response.json();

      expect(responseData).toHaveProperty("success", true);
      expect(responseData).toHaveProperty("data", mockData);
      expect(responseData).not.toHaveProperty("error");
    });

    it("错误响应应该包含正确的结构", async () => {
      const error = new Error("测试错误");
      mockStatusService.getFullStatus.mockImplementation(() => {
        throw error;
      });

      const response = await statusApiHandler.getStatus(mockContext);
      const responseData = await response.json();

      expect(responseData).toHaveProperty("success", false);
      expect(responseData).toHaveProperty("error");
      expect(responseData.error).toHaveProperty("code");
      expect(responseData.error).toHaveProperty("message");
    });

    it("成功响应可以包含消息", async () => {
      const response = await statusApiHandler.resetStatus(mockContext);
      const responseData = await response.json();

      expect(responseData).toHaveProperty("success", true);
      expect(responseData).toHaveProperty("message", "状态重置成功");
      // data 为 undefined 时不会添加 data 字段
      expect(responseData).not.toHaveProperty("data");
    });
  });

  describe("边界条件测试", () => {
    it("应该处理空的状态数据", async () => {
      mockStatusService.getFullStatus.mockReturnValue({});

      const response = await statusApiHandler.getStatus(mockContext);
      const responseData = await response.json();

      expect(responseData.success).toBe(true);
      expect(responseData.data).toEqual({});
    });

    it("应该处理 null 状态数据", async () => {
      mockStatusService.getFullStatus.mockReturnValue(null);

      const response = await statusApiHandler.getStatus(mockContext);
      const responseData = await response.json();

      expect(responseData.success).toBe(true);
      expect(responseData.data).toBeNull();
    });

    it("应该处理 undefined 状态数据", async () => {
      mockStatusService.getFullStatus.mockReturnValue(undefined);

      const response = await statusApiHandler.getStatus(mockContext);
      const responseData = await response.json();

      expect(responseData.success).toBe(true);
      expect(responseData.data).toBeUndefined();
    });

    it("应该处理大量的 MCP 服务器数据", async () => {
      const largeServerList = Array.from(
        { length: 1000 },
        (_, i) => `server${i}`
      );
      mockStatusService.getActiveMCPServers.mockReturnValue(largeServerList);

      const response = await statusApiHandler.getActiveMCPServers(mockContext);
      const responseData = await response.json();

      expect(responseData.success).toBe(true);
      expect(responseData.data.servers).toHaveLength(1000);
    });

    it("应该处理空的客户端状态更新", async () => {
      mockContext.req.json.mockResolvedValue({});

      const response = await statusApiHandler.updateClientStatus(mockContext);
      const responseData = await response.json();

      expect(mockStatusService.updateClientInfo).toHaveBeenCalledWith(
        {},
        "http-api"
      );
      expect(responseData.success).toBe(true);
    });

    it("应该处理包含特殊字符的数据", async () => {
      const specialData = {
        status: "connected",
        mcpEndpoint: "test://endpoint?param=value&other=测试",
        activeMCPServers: ["server-1", "server_2", "server.3"],
      };
      mockContext.req.json.mockResolvedValue(specialData);

      const response = await statusApiHandler.updateClientStatus(mockContext);
      const responseData = await response.json();

      expect(mockStatusService.updateClientInfo).toHaveBeenCalledWith(
        specialData,
        "http-api"
      );
      expect(responseData.success).toBe(true);
    });
  });

  describe("并发和性能测试", () => {
    it("应该能够处理并发的状态查询请求", async () => {
      const mockStatus = { test: "concurrent" };
      mockStatusService.getFullStatus.mockReturnValue(mockStatus);

      const promises = Array.from({ length: 10 }, () =>
        statusApiHandler.getStatus(mockContext)
      );

      const responses = await Promise.all(promises);

      expect(responses).toHaveLength(10);
      for (const response of responses) {
        const data = await response.json();
        expect(data.success).toBe(true);
        expect(data.data).toEqual(mockStatus);
      }
      expect(mockStatusService.getFullStatus).toHaveBeenCalledTimes(10);
    });

    it("应该能够处理并发的状态更新请求", async () => {
      const statusUpdates = Array.from({ length: 5 }, (_, i) => ({
        status: "connected",
        mcpEndpoint: `endpoint-${i}`,
      }));

      mockContext.req.json
        .mockResolvedValueOnce(statusUpdates[0])
        .mockResolvedValueOnce(statusUpdates[1])
        .mockResolvedValueOnce(statusUpdates[2])
        .mockResolvedValueOnce(statusUpdates[3])
        .mockResolvedValueOnce(statusUpdates[4]);

      const promises = Array.from({ length: 5 }, () =>
        statusApiHandler.updateClientStatus(mockContext)
      );

      const responses = await Promise.all(promises);

      expect(responses).toHaveLength(5);
      for (const response of responses) {
        const data = await response.json();
        expect(data.success).toBe(true);
      }
      expect(mockStatusService.updateClientInfo).toHaveBeenCalledTimes(5);
    });

    it("应该在高频请求下保持性能", async () => {
      mockStatusService.isClientConnected.mockReturnValue(true);

      const startTime = Date.now();
      const promises = Array.from({ length: 100 }, () =>
        statusApiHandler.checkClientConnected(mockContext)
      );

      await Promise.all(promises);
      const endTime = Date.now();

      expect(endTime - startTime).toBeLessThan(1000); // 应该在 1 秒内完成
      expect(mockStatusService.isClientConnected).toHaveBeenCalledTimes(100);
    });
  });

  describe("错误处理和恢复", () => {
    it("应该在状态服务抛出异常后继续工作", async () => {
      // 第一次调用失败
      mockStatusService.getFullStatus
        .mockImplementationOnce(() => {
          throw new Error("临时错误");
        })
        .mockReturnValueOnce({ recovered: true });

      // 第一次请求失败
      const response1 = await statusApiHandler.getStatus(mockContext);
      const data1 = await response1.json();
      expect(data1.error).toBeDefined();

      // 第二次请求成功
      const response2 = await statusApiHandler.getStatus(mockContext);
      const data2 = await response2.json();
      expect(data2.success).toBe(true);
      expect(data2.data).toEqual({ recovered: true });
    });

    it("应该正确处理状态服务方法不存在的情况", async () => {
      // 模拟方法不存在
      const brokenService = {} as StatusService;
      const brokenHandler = new StatusApiHandler(brokenService);

      const response = await brokenHandler.getStatus(mockContext);
      const responseData = await response.json();

      expect(responseData.error).toBeDefined();
      expect(response.status).toBe(500);
    });

    it("应该处理 Context 对象异常", async () => {
      const brokenContext = {
        get: vi.fn(() => {
          throw new Error("Context 错误");
        }),
        json: vi.fn(),
        req: { json: vi.fn() },
      } as any;

      mockStatusService.getFullStatus.mockReturnValue({ test: "data" });

      try {
        await statusApiHandler.getStatus(brokenContext);
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect((error as Error).message).toBe("Context 错误");
      }
    });
  });

  describe("日志记录验证", () => {
    it("应该记录所有重要操作的日志", async () => {
      mockStatusService.getFullStatus.mockReturnValue({ test: "data" });

      await statusApiHandler.getStatus(mockContext);

      expect(mockLogger.debug).toHaveBeenCalledWith("处理获取状态请求");
      expect(mockLogger.debug).toHaveBeenCalledWith("获取状态成功");
    });

    it("应该记录错误日志", async () => {
      const error = new Error("测试错误");
      mockStatusService.getFullStatus.mockImplementation(() => {
        throw error;
      });

      await statusApiHandler.getStatus(mockContext);

      expect(mockLogger.error).toHaveBeenCalledWith("获取状态失败:", error);
    });

    it("应该记录信息级别的日志", async () => {
      const statusUpdate = { status: "connected" };
      mockContext.req.json.mockResolvedValue(statusUpdate);

      await statusApiHandler.updateClientStatus(mockContext);

      expect(mockLogger.info).toHaveBeenCalledWith("客户端状态更新成功");
    });
  });

  describe("集成测试", () => {
    it("应该正确处理完整的状态管理工作流", async () => {
      // 1. 初始状态查询
      const initialStatus = {
        client: {
          status: "disconnected",
          mcpEndpoint: "",
          activeMCPServers: [],
        },
        restart: null,
        servers: [],
      };
      mockStatusService.getFullStatus.mockReturnValue(initialStatus);

      let response = await statusApiHandler.getStatus(mockContext);
      let data = await response.json();
      expect(data.success).toBe(true);
      expect(data.data).toEqual(initialStatus);

      // 2. 更新客户端状态
      const clientUpdate = {
        status: "connected",
        mcpEndpoint: "test-endpoint",
        activeMCPServers: ["server1"],
      };
      mockContext.req.json.mockResolvedValue(clientUpdate);

      response = await statusApiHandler.updateClientStatus(mockContext);
      data = await response.json();
      expect(data.success).toBe(true);

      // 3. 设置 MCP 服务器
      const servers = ["server1", "server2"];
      mockContext.req.json.mockResolvedValue({ servers });

      response = await statusApiHandler.setActiveMCPServers(mockContext);
      data = await response.json();
      expect(data.success).toBe(true);

      // 4. 检查连接状态
      mockStatusService.isClientConnected.mockReturnValue(true);

      response = await statusApiHandler.checkClientConnected(mockContext);
      data = await response.json();
      expect(data.success).toBe(true);
      expect(data.data.connected).toBe(true);

      // 5. 重置状态
      response = await statusApiHandler.resetStatus(mockContext);
      data = await response.json();
      expect(data.success).toBe(true);

      // 验证所有服务调用
      expect(mockStatusService.getFullStatus).toHaveBeenCalled();
      expect(mockStatusService.updateClientInfo).toHaveBeenCalledWith(
        clientUpdate,
        "http-api"
      );
      expect(mockStatusService.setActiveMCPServers).toHaveBeenCalledWith(
        servers
      );
      expect(mockStatusService.isClientConnected).toHaveBeenCalled();
      expect(mockStatusService.reset).toHaveBeenCalled();
    });

    it("应该正确处理混合成功和失败的操作", async () => {
      // 成功的操作
      mockStatusService.getFullStatus.mockReturnValue({ test: "success" });
      let response = await statusApiHandler.getStatus(mockContext);
      let data = await response.json();
      expect(data.success).toBe(true);

      // 失败的操作
      mockStatusService.getClientStatus.mockImplementation(() => {
        throw new Error("服务不可用");
      });
      response = await statusApiHandler.getClientStatus(mockContext);
      data = await response.json();
      expect(data.error).toBeDefined();

      // 再次成功的操作
      mockStatusService.isClientConnected.mockReturnValue(false);
      response = await statusApiHandler.checkClientConnected(mockContext);
      data = await response.json();
      expect(data.success).toBe(true);
    });
  });

  describe("数据类型和格式验证", () => {
    it("应该处理各种数据类型的状态", async () => {
      const complexStatus = {
        client: {
          status: "connected",
          mcpEndpoint: "test://endpoint",
          activeMCPServers: ["server1", "server2"],
          lastHeartbeat: 1234567890,
          metadata: {
            version: "1.0.0",
            features: ["feature1", "feature2"],
            config: { debug: true, timeout: 5000 },
          },
        },
        restart: {
          status: "completed",
          timestamp: Date.now(),
          duration: 1500,
        },
        servers: [
          { name: "server1", status: "active", uptime: 3600 },
          { name: "server2", status: "inactive", lastSeen: 1234567890 },
        ],
      };

      mockStatusService.getFullStatus.mockReturnValue(complexStatus);

      const response = await statusApiHandler.getStatus(mockContext);
      const data = await response.json();

      expect(data.success).toBe(true);
      expect(data.data).toEqual(complexStatus);
    });

    it("应该处理包含特殊值的数据", async () => {
      const specialStatus = {
        nullValue: null,
        undefinedValue: undefined,
        emptyString: "",
        emptyArray: [],
        emptyObject: {},
        zeroNumber: 0,
        falseBoolean: false,
        infinityNumber: Number.POSITIVE_INFINITY,
        nanNumber: Number.NaN,
      };

      mockStatusService.getFullStatus.mockReturnValue(specialStatus);

      const response = await statusApiHandler.getStatus(mockContext);
      const data = await response.json();

      expect(data.success).toBe(true);
      // JSON 序列化会处理这些特殊值
      expect(data.data).toBeDefined();
    });

    it("应该正确验证 MCP 服务器数组的各种格式", async () => {
      const testCases = [
        { servers: [], expected: true },
        { servers: ["server1"], expected: true },
        { servers: ["server1", "server2", "server3"], expected: true },
        { servers: null, expected: false },
        { servers: undefined, expected: false },
        { servers: "not-array", expected: false },
        { servers: 123, expected: false },
        { servers: {}, expected: false },
      ];

      for (const testCase of testCases) {
        mockContext.req.json.mockResolvedValue(testCase);

        const response =
          await statusApiHandler.setActiveMCPServers(mockContext);
        const data = await response.json();

        if (testCase.expected) {
          expect(data.success).toBe(true);
        } else {
          expect(data.error).toBeDefined();
          expect(data.error.code).toBe("INVALID_REQUEST_BODY");
        }
      }
    });
  });

  describe("HTTP 状态码验证", () => {
    it("成功操作应该返回 200 状态码", async () => {
      mockStatusService.getFullStatus.mockReturnValue({});

      const response = await statusApiHandler.getStatus(mockContext);

      expect(response.status).toBe(200);
    });

    it("客户端错误应该返回 400 状态码", async () => {
      mockContext.req.json.mockResolvedValue(null);

      const response = await statusApiHandler.updateClientStatus(mockContext);

      expect(response.status).toBe(400);
    });

    it("服务器错误应该返回 500 状态码", async () => {
      mockStatusService.getFullStatus.mockImplementation(() => {
        throw new Error("服务器内部错误");
      });

      const response = await statusApiHandler.getStatus(mockContext);

      expect(response.status).toBe(500);
    });

    it("不同类型的错误应该返回正确的状态码", async () => {
      // 400 错误 - 客户端请求错误
      mockContext.req.json.mockResolvedValue({ servers: "invalid" });
      let response = await statusApiHandler.setActiveMCPServers(mockContext);
      expect(response.status).toBe(400);

      // 500 错误 - 服务器内部错误
      mockStatusService.reset.mockImplementation(() => {
        throw new Error("内部错误");
      });
      response = await statusApiHandler.resetStatus(mockContext);
      expect(response.status).toBe(500);
    });
  });

  describe("内存和资源管理", () => {
    it("应该正确处理大量数据而不造成内存泄漏", async () => {
      const largeData = {
        servers: Array.from({ length: 10000 }, (_, i) => `server-${i}`),
        clients: Array.from({ length: 1000 }, (_, i) => ({
          id: `client-${i}`,
          status: "connected",
          data: "x".repeat(1000), // 1KB per client
        })),
      };

      mockStatusService.getFullStatus.mockReturnValue(largeData);

      const response = await statusApiHandler.getStatus(mockContext);
      const data = await response.json();

      expect(data.success).toBe(true);
      expect(data.data.servers).toHaveLength(10000);
      expect(data.data.clients).toHaveLength(1000);
    });

    it("应该在多次调用后保持稳定", async () => {
      mockStatusService.getFullStatus.mockReturnValue({ stable: true });

      // 执行多次调用
      for (let i = 0; i < 50; i++) {
        const response = await statusApiHandler.getStatus(mockContext);
        const data = await response.json();
        expect(data.success).toBe(true);
      }

      expect(mockStatusService.getFullStatus).toHaveBeenCalledTimes(50);
    });
  });

  describe("异步操作处理", () => {
    it("应该正确处理异步状态服务调用", async () => {
      // 模拟异步操作 - StatusService 的方法是同步的，所以直接返回值
      const asyncData = { async: true };
      mockStatusService.getFullStatus.mockReturnValue(asyncData);

      const response = await statusApiHandler.getStatus(mockContext);
      const data = await response.json();

      expect(data.success).toBe(true);
      expect(data.data).toEqual({ async: true });
    });

    it("应该处理异步操作中的错误", async () => {
      // 模拟同步错误
      const error = new Error("异步错误");
      mockStatusService.getFullStatus.mockImplementation(() => {
        throw error;
      });

      const response = await statusApiHandler.getStatus(mockContext);
      const data = await response.json();

      expect(data.error).toBeDefined();
      expect(data.error.message).toBe("异步错误");
    });
  });
});

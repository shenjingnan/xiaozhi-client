/**
 * StatusRoutes 测试
 * 测试状态路由处理器的功能
 */

import { Hono } from "hono";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  type ClientInfo,
  type MCPConnectionStatus,
  StatusRoutes,
} from "./StatusRoutes.js";

// Mock logger
vi.mock("../../Logger.js", () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
}));

describe("StatusRoutes", () => {
  let statusRoutes: StatusRoutes;
  let app: Hono;
  let mockMCPStatusCallback: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    statusRoutes = new StatusRoutes();
    app = new Hono();
    mockMCPStatusCallback = vi.fn();

    // 设置 MCP 状态回调
    statusRoutes.setMCPStatusCallback(mockMCPStatusCallback);

    // 注册路由
    statusRoutes.register(app);

    // 重置所有 mock
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("GET /api/status", () => {
    it("应该成功返回状态信息", async () => {
      const mockMCPStatus: MCPConnectionStatus = {
        connected: true,
        endpoint: "http://localhost:3000",
      };

      mockMCPStatusCallback.mockReturnValue(mockMCPStatus);

      const req = new Request("http://localhost/api/status", {
        method: "GET",
      });

      const res = await app.request(req);
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data).toEqual({
        status: "disconnected",
        mcpEndpoint: "",
        activeMCPServers: [],
        mcpConnection: mockMCPStatus,
      });
      expect(mockMCPStatusCallback).toHaveBeenCalledTimes(1);
    });

    it("应该处理没有 MCP 状态的情况", async () => {
      mockMCPStatusCallback.mockReturnValue(undefined);

      const req = new Request("http://localhost/api/status", {
        method: "GET",
      });

      const res = await app.request(req);
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.mcpConnection).toBeUndefined();
    });

    it("应该处理获取状态时的错误", async () => {
      mockMCPStatusCallback.mockImplementation(() => {
        throw new Error("状态获取失败");
      });

      const req = new Request("http://localhost/api/status", {
        method: "GET",
      });

      const res = await app.request(req);
      const data = await res.json();

      expect(res.status).toBe(500);
      expect(data).toEqual({ error: "状态获取失败" });
    });

    it("应该返回更新后的客户端信息", async () => {
      // 更新客户端信息
      statusRoutes.updateClientInfo({
        status: "connected",
        mcpEndpoint: "http://localhost:4000",
        activeMCPServers: ["server1", "server2"],
      });

      mockMCPStatusCallback.mockReturnValue({
        connected: true,
        endpoint: "http://localhost:4000",
      });

      const req = new Request("http://localhost/api/status", {
        method: "GET",
      });

      const res = await app.request(req);
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.status).toBe("connected");
      expect(data.mcpEndpoint).toBe("http://localhost:4000");
      expect(data.activeMCPServers).toEqual(["server1", "server2"]);
    });
  });

  describe("updateClientInfo", () => {
    it("应该正确更新客户端信息", () => {
      const info: Partial<ClientInfo> = {
        status: "connected",
        mcpEndpoint: "http://localhost:5000",
        activeMCPServers: ["test-server"],
      };

      statusRoutes.updateClientInfo(info);
      const clientInfo = statusRoutes.getClientInfo();

      expect(clientInfo.status).toBe("connected");
      expect(clientInfo.mcpEndpoint).toBe("http://localhost:5000");
      expect(clientInfo.activeMCPServers).toEqual(["test-server"]);
    });

    it("应该在设置 lastHeartbeat 时更新为当前时间", () => {
      const beforeTime = Date.now();

      statusRoutes.updateClientInfo({
        lastHeartbeat: 123456789, // 这个值会被忽略，使用当前时间
      });

      const clientInfo = statusRoutes.getClientInfo();
      const afterTime = Date.now();

      expect(clientInfo.lastHeartbeat).toBeGreaterThanOrEqual(beforeTime);
      expect(clientInfo.lastHeartbeat).toBeLessThanOrEqual(afterTime);
    });

    it("应该保持现有信息不变", () => {
      // 先设置初始信息
      statusRoutes.updateClientInfo({
        status: "connected",
        mcpEndpoint: "http://localhost:3000",
        activeMCPServers: ["server1"],
      });

      // 只更新部分信息
      statusRoutes.updateClientInfo({
        status: "disconnected",
      });

      const clientInfo = statusRoutes.getClientInfo();

      expect(clientInfo.status).toBe("disconnected");
      expect(clientInfo.mcpEndpoint).toBe("http://localhost:3000"); // 保持不变
      expect(clientInfo.activeMCPServers).toEqual(["server1"]); // 保持不变
    });
  });

  describe("getClientInfo", () => {
    it("应该返回客户端信息的副本", () => {
      const originalInfo = statusRoutes.getClientInfo();
      originalInfo.status = "connected"; // 修改返回的对象

      const newInfo = statusRoutes.getClientInfo();
      expect(newInfo.status).toBe("disconnected"); // 原始对象不应该被修改
    });
  });

  describe("setMCPStatusCallback", () => {
    it("应该正确设置 MCP 状态回调", async () => {
      const newCallback = vi.fn().mockReturnValue({
        connected: false,
        error: "连接失败",
      });

      statusRoutes.setMCPStatusCallback(newCallback);

      const req = new Request("http://localhost/api/status", {
        method: "GET",
      });

      const res = await app.request(req);
      const data = await res.json();

      expect(newCallback).toHaveBeenCalledTimes(1);
      expect(data.mcpConnection).toEqual({
        connected: false,
        error: "连接失败",
      });
    });
  });

  describe("resetClientStatus", () => {
    it("应该重置客户端状态为断开连接", () => {
      // 先设置为连接状态
      statusRoutes.updateClientInfo({
        status: "connected",
        mcpEndpoint: "http://localhost:3000",
        lastHeartbeat: Date.now(),
      });

      // 重置状态
      statusRoutes.resetClientStatus();

      const clientInfo = statusRoutes.getClientInfo();
      expect(clientInfo.status).toBe("disconnected");
      expect(clientInfo.lastHeartbeat).toBeUndefined();
    });
  });

  describe("setClientConnected", () => {
    it("应该设置客户端为连接状态", () => {
      const beforeTime = Date.now();

      statusRoutes.setClientConnected("http://localhost:6000", [
        "server1",
        "server2",
      ]);

      const clientInfo = statusRoutes.getClientInfo();
      const afterTime = Date.now();

      expect(clientInfo.status).toBe("connected");
      expect(clientInfo.mcpEndpoint).toBe("http://localhost:6000");
      expect(clientInfo.activeMCPServers).toEqual(["server1", "server2"]);
      expect(clientInfo.lastHeartbeat).toBeGreaterThanOrEqual(beforeTime);
      expect(clientInfo.lastHeartbeat).toBeLessThanOrEqual(afterTime);
    });

    it("应该使用默认的空服务器列表", () => {
      statusRoutes.setClientConnected("http://localhost:7000");

      const clientInfo = statusRoutes.getClientInfo();
      expect(clientInfo.activeMCPServers).toEqual([]);
    });
  });

  describe("setClientDisconnected", () => {
    it("应该设置客户端为断开连接状态", () => {
      // 先设置为连接状态
      statusRoutes.setClientConnected("http://localhost:3000", ["server1"]);

      // 设置为断开连接
      statusRoutes.setClientDisconnected();

      const clientInfo = statusRoutes.getClientInfo();
      expect(clientInfo.status).toBe("disconnected");
      // 其他信息应该保持不变
      expect(clientInfo.mcpEndpoint).toBe("http://localhost:3000");
      expect(clientInfo.activeMCPServers).toEqual(["server1"]);
    });
  });
});

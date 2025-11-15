import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ClientInfo } from "../StatusService.js";
import { StatusService } from "../StatusService.js";

// Mock dependencies
vi.mock("../../Logger.js", () => ({
  logger: {
    withTag: vi.fn().mockReturnValue({
      debug: vi.fn(),
      info: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
    }),
  },
}));

vi.mock("../EventBus.js", () => ({
  getEventBus: vi.fn().mockReturnValue({
    emitEvent: vi.fn(),
    onEvent: vi.fn(),
  }),
}));

// Mock timers
vi.useFakeTimers();

describe("StatusService", () => {
  let statusService: StatusService;
  let mockLogger: any;
  let mockEventBus: any;

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.clearAllTimers();

    // Mock Logger
    mockLogger = {
      debug: vi.fn(),
      info: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
    };
    const { logger } = await import("../../Logger.js");
    vi.mocked(logger.withTag).mockReturnValue(mockLogger);

    // Mock EventBus
    mockEventBus = {
      emitEvent: vi.fn(),
      onEvent: vi.fn(),
    };
    const { getEventBus } = await import("../EventBus.js");
    vi.mocked(getEventBus).mockReturnValue(mockEventBus);

    statusService = new StatusService();
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.clearAllTimers();
  });

  describe("constructor", () => {
    it("should initialize with correct dependencies and default state", () => {
      expect(statusService).toBeInstanceOf(StatusService);
      expect(mockLogger.debug).not.toHaveBeenCalled();

      // Check initial client status
      const clientStatus = statusService.getClientStatus();
      expect(clientStatus).toEqual({
        status: "disconnected",
        mcpEndpoint: "",
        activeMCPServers: [],
      });

      // Check initial restart status
      const restartStatus = statusService.getRestartStatus();
      expect(restartStatus).toBeUndefined();
    });
  });

  describe("getClientStatus", () => {
    it("should return a copy of client status", () => {
      const status1 = statusService.getClientStatus();
      const status2 = statusService.getClientStatus();

      expect(status1).toEqual(status2);
      expect(status1).not.toBe(status2); // Should be different objects
    });

    it("should return current client status after updates", () => {
      const newInfo: Partial<ClientInfo> = {
        status: "connected",
        mcpEndpoint: "ws://localhost:3000",
        activeMCPServers: ["calculator", "datetime"],
      };

      statusService.updateClientInfo(newInfo);
      const status = statusService.getClientStatus();

      expect(status.status).toBe("connected");
      expect(status.mcpEndpoint).toBe("ws://localhost:3000");
      expect(status.activeMCPServers).toEqual(["calculator", "datetime"]);
    });
  });

  describe("updateClientInfo", () => {
    it("should update client info successfully", () => {
      const newInfo: Partial<ClientInfo> = {
        status: "connected",
        mcpEndpoint: "ws://localhost:3000",
        activeMCPServers: ["calculator"],
      };

      statusService.updateClientInfo(newInfo, "test-source");

      const status = statusService.getClientStatus();
      expect(status.status).toBe("connected");
      expect(status.mcpEndpoint).toBe("ws://localhost:3000");
      expect(status.activeMCPServers).toEqual(["calculator"]);

      expect(mockLogger.debug).toHaveBeenCalledWith(
        "客户端状态更新，来源: test-source",
        {
          old: {
            status: "disconnected",
            mcpEndpoint: "",
            activeMCPServers: [],
          },
          new: status,
        }
      );

      expect(mockEventBus.emitEvent).toHaveBeenCalledWith("status:updated", {
        status: status,
        source: "test-source",
      });
    });

    it("should update lastHeartbeat when provided", () => {
      const mockNow = 1234567890;
      vi.spyOn(Date, "now").mockReturnValue(mockNow);

      statusService.updateClientInfo({ lastHeartbeat: 999 });

      const status = statusService.getClientStatus();
      expect(status.lastHeartbeat).toBe(mockNow);
    });

    it("should reset heartbeat timeout when status is connected", () => {
      const clearTimeoutSpy = vi.spyOn(global, "clearTimeout");
      const setTimeoutSpy = vi.spyOn(global, "setTimeout");

      statusService.updateClientInfo({ status: "connected" });

      expect(setTimeoutSpy).toHaveBeenCalledWith(expect.any(Function), 35000);
    });

    it("should use default source when not provided", () => {
      statusService.updateClientInfo({ status: "connected" });

      expect(mockLogger.debug).toHaveBeenCalledWith(
        "客户端状态更新，来源: unknown",
        expect.any(Object)
      );
    });

    it("should handle partial updates", () => {
      // First update
      statusService.updateClientInfo({
        status: "connected",
        mcpEndpoint: "ws://localhost:3000",
        activeMCPServers: ["calculator"],
      });

      // Partial update
      statusService.updateClientInfo({
        activeMCPServers: ["calculator", "datetime"],
      });

      const status = statusService.getClientStatus();
      expect(status.status).toBe("connected");
      expect(status.mcpEndpoint).toBe("ws://localhost:3000");
      expect(status.activeMCPServers).toEqual(["calculator", "datetime"]);
    });

    it("should handle errors during update", () => {
      // Mock an error in the update process
      const error = new Error("Update failed");
      mockEventBus.emitEvent.mockImplementationOnce(() => {
        throw error;
      });

      statusService.updateClientInfo({ status: "connected" });

      expect(mockLogger.error).toHaveBeenCalledWith(
        "更新客户端状态失败:",
        error
      );
      expect(mockEventBus.emitEvent).toHaveBeenCalledWith("status:error", {
        error: error,
        operation: "updateClientInfo",
      });
    });

    it("should handle non-Error exceptions", () => {
      // Mock a non-Error exception
      mockEventBus.emitEvent.mockImplementationOnce(() => {
        throw "String error";
      });

      statusService.updateClientInfo({ status: "connected" });

      expect(mockEventBus.emitEvent).toHaveBeenCalledWith("status:error", {
        error: new Error("String error"),
        operation: "updateClientInfo",
      });
    });
  });

  describe("getRestartStatus", () => {
    it("should return undefined when no restart status is set", () => {
      const status = statusService.getRestartStatus();
      expect(status).toBeUndefined();
    });

    it("should return a copy of restart status", () => {
      statusService.updateRestartStatus("restarting");

      const status1 = statusService.getRestartStatus();
      const status2 = statusService.getRestartStatus();

      expect(status1).toEqual(status2);
      expect(status1).not.toBe(status2); // Should be different objects
    });

    it("should return current restart status after updates", () => {
      const mockTimestamp = 1234567890;
      vi.spyOn(Date, "now").mockReturnValue(mockTimestamp);

      statusService.updateRestartStatus("restarting");
      const status = statusService.getRestartStatus();

      expect(status).toEqual({
        status: "restarting",
        timestamp: mockTimestamp,
      });
    });
  });

  describe("updateRestartStatus", () => {
    it("should update restart status to restarting", () => {
      const mockTimestamp = 1234567890;
      vi.spyOn(Date, "now").mockReturnValue(mockTimestamp);

      statusService.updateRestartStatus("restarting");

      const status = statusService.getRestartStatus();
      expect(status).toEqual({
        status: "restarting",
        timestamp: mockTimestamp,
      });

      expect(mockLogger.info).toHaveBeenCalledWith("重启状态更新: restarting", {
        error: undefined,
      });

      expect(mockEventBus.emitEvent).toHaveBeenCalledWith(
        "service:restart:started",
        {
          serviceName: "",
          attempt: 1,
          timestamp: mockTimestamp,
        }
      );
    });

    it("should update restart status to completed", () => {
      const mockTimestamp = 1234567890;
      vi.spyOn(Date, "now").mockReturnValue(mockTimestamp);

      statusService.updateRestartStatus("completed");

      const status = statusService.getRestartStatus();
      expect(status).toEqual({
        status: "completed",
        timestamp: mockTimestamp,
      });

      expect(mockLogger.info).toHaveBeenCalledWith("重启状态更新: completed", {
        error: undefined,
      });

      expect(mockEventBus.emitEvent).toHaveBeenCalledWith(
        "service:restart:completed",
        {
          serviceName: "",
          attempt: 1,
          timestamp: mockTimestamp,
        }
      );
    });

    it("should update restart status to failed with error", () => {
      const mockTimestamp = 1234567890;
      const errorMessage = "Restart process failed";
      vi.spyOn(Date, "now").mockReturnValue(mockTimestamp);

      statusService.updateRestartStatus("failed", errorMessage);

      const status = statusService.getRestartStatus();
      expect(status).toEqual({
        status: "failed",
        error: errorMessage,
        timestamp: mockTimestamp,
      });

      expect(mockLogger.info).toHaveBeenCalledWith("重启状态更新: failed", {
        error: errorMessage,
      });

      expect(mockEventBus.emitEvent).toHaveBeenCalledWith(
        "service:restart:failed",
        {
          serviceName: "",
          error: new Error(errorMessage),
          attempt: 1,
          timestamp: mockTimestamp,
        }
      );
    });

    it("should update restart status to failed without error message", () => {
      const mockTimestamp = 1234567890;
      vi.spyOn(Date, "now").mockReturnValue(mockTimestamp);

      statusService.updateRestartStatus("failed");

      const status = statusService.getRestartStatus();
      expect(status).toEqual({
        status: "failed",
        timestamp: mockTimestamp,
      });

      expect(mockEventBus.emitEvent).toHaveBeenCalledWith(
        "service:restart:failed",
        {
          serviceName: "",
          error: new Error("重启失败"),
          attempt: 1,
          timestamp: mockTimestamp,
        }
      );
    });

    it("should handle errors during restart status update", () => {
      const error = new Error("Update failed");
      mockEventBus.emitEvent.mockImplementationOnce(() => {
        throw error;
      });

      statusService.updateRestartStatus("restarting");

      expect(mockLogger.error).toHaveBeenCalledWith("更新重启状态失败:", error);
      expect(mockEventBus.emitEvent).toHaveBeenCalledWith("status:error", {
        error: error,
        operation: "updateRestartStatus",
      });
    });

    it("should handle non-Error exceptions during restart status update", () => {
      mockEventBus.emitEvent.mockImplementationOnce(() => {
        throw "String error";
      });

      statusService.updateRestartStatus("restarting");

      expect(mockEventBus.emitEvent).toHaveBeenCalledWith("status:error", {
        error: new Error("String error"),
        operation: "updateRestartStatus",
      });
    });
  });

  describe("getFullStatus", () => {
    it("should return full status with client and timestamp", () => {
      const mockTimestamp = 1234567890;
      vi.spyOn(Date, "now").mockReturnValue(mockTimestamp);

      const fullStatus = statusService.getFullStatus();

      expect(fullStatus).toEqual({
        client: {
          status: "disconnected",
          mcpEndpoint: "",
          activeMCPServers: [],
        },
        restart: undefined,
        timestamp: mockTimestamp,
      });
    });

    it("should return full status with client and restart status", () => {
      const mockTimestamp = 1234567890;
      vi.spyOn(Date, "now").mockReturnValue(mockTimestamp);

      // Update client and restart status
      statusService.updateClientInfo({
        status: "connected",
        mcpEndpoint: "ws://localhost:3000",
        activeMCPServers: ["calculator"],
      });
      statusService.updateRestartStatus("completed");

      const fullStatus = statusService.getFullStatus();

      expect(fullStatus.client.status).toBe("connected");
      expect(fullStatus.client.mcpEndpoint).toBe("ws://localhost:3000");
      expect(fullStatus.client.activeMCPServers).toEqual(["calculator"]);
      expect(fullStatus.restart?.status).toBe("completed");
      expect(fullStatus.timestamp).toBe(mockTimestamp);
    });
  });

  describe("heartbeat timeout management", () => {
    it("should set heartbeat timeout when client connects", () => {
      const setTimeoutSpy = vi.spyOn(global, "setTimeout");

      statusService.updateClientInfo({ status: "connected" });

      expect(setTimeoutSpy).toHaveBeenCalledWith(expect.any(Function), 35000);
    });

    it("should clear existing timeout when setting new one", () => {
      const clearTimeoutSpy = vi.spyOn(global, "clearTimeout");
      const setTimeoutSpy = vi.spyOn(global, "setTimeout");

      // First connection
      statusService.updateClientInfo({ status: "connected" });
      const firstTimeoutId = setTimeoutSpy.mock.results[0].value;

      // Second connection (should clear first timeout)
      statusService.updateClientInfo({ status: "connected" });

      expect(clearTimeoutSpy).toHaveBeenCalledWith(firstTimeoutId);
      expect(setTimeoutSpy).toHaveBeenCalledTimes(2);
    });

    it("should trigger heartbeat timeout and update status", () => {
      statusService.updateClientInfo({ status: "connected" });

      // Fast-forward time to trigger timeout
      vi.advanceTimersByTime(35000);

      expect(mockLogger.warn).toHaveBeenCalledWith(
        "客户端心跳超时，标记为断开连接"
      );

      const status = statusService.getClientStatus();
      expect(status.status).toBe("disconnected");
    });

    it("should clear heartbeat timeout manually", () => {
      const clearTimeoutSpy = vi.spyOn(global, "clearTimeout");

      statusService.updateClientInfo({ status: "connected" });
      statusService.clearHeartbeatTimeout();

      expect(clearTimeoutSpy).toHaveBeenCalled();
    });

    it("should handle clearHeartbeatTimeout when no timeout is set", () => {
      const clearTimeoutSpy = vi.spyOn(global, "clearTimeout");

      statusService.clearHeartbeatTimeout();

      expect(clearTimeoutSpy).not.toHaveBeenCalled();
    });
  });

  describe("isClientConnected", () => {
    it("should return false for initial disconnected state", () => {
      expect(statusService.isClientConnected()).toBe(false);
    });

    it("should return true when client is connected", () => {
      statusService.updateClientInfo({ status: "connected" });
      expect(statusService.isClientConnected()).toBe(true);
    });

    it("should return false when client is disconnected", () => {
      statusService.updateClientInfo({ status: "connected" });
      statusService.updateClientInfo({ status: "disconnected" });
      expect(statusService.isClientConnected()).toBe(false);
    });
  });

  describe("getLastHeartbeat", () => {
    it("should return undefined initially", () => {
      expect(statusService.getLastHeartbeat()).toBeUndefined();
    });

    it("should return last heartbeat timestamp", () => {
      const mockTimestamp = 1234567890;
      vi.spyOn(Date, "now").mockReturnValue(mockTimestamp);

      statusService.updateClientInfo({ lastHeartbeat: 999 });

      expect(statusService.getLastHeartbeat()).toBe(mockTimestamp);
    });

    it("should return updated heartbeat timestamp", () => {
      const mockTimestamp1 = 1234567890;
      const mockTimestamp2 = 1234567999;

      vi.spyOn(Date, "now").mockReturnValueOnce(mockTimestamp1);
      statusService.updateClientInfo({ lastHeartbeat: 999 });

      vi.spyOn(Date, "now").mockReturnValueOnce(mockTimestamp2);
      statusService.updateClientInfo({ lastHeartbeat: 888 });

      expect(statusService.getLastHeartbeat()).toBe(mockTimestamp2);
    });
  });

  describe("getActiveMCPServers", () => {
    it("should return empty array initially", () => {
      const servers = statusService.getActiveMCPServers();
      expect(servers).toEqual([]);
    });

    it("should return copy of active MCP servers", () => {
      statusService.updateClientInfo({
        activeMCPServers: ["calculator", "datetime"],
      });

      const servers1 = statusService.getActiveMCPServers();
      const servers2 = statusService.getActiveMCPServers();

      expect(servers1).toEqual(["calculator", "datetime"]);
      expect(servers1).toEqual(servers2);
      expect(servers1).not.toBe(servers2); // Should be different arrays
    });

    it("should return updated active MCP servers", () => {
      statusService.updateClientInfo({
        activeMCPServers: ["calculator"],
      });
      expect(statusService.getActiveMCPServers()).toEqual(["calculator"]);

      statusService.updateClientInfo({
        activeMCPServers: ["calculator", "datetime", "weather"],
      });
      expect(statusService.getActiveMCPServers()).toEqual([
        "calculator",
        "datetime",
        "weather",
      ]);
    });
  });

  describe("setActiveMCPServers", () => {
    it("should set active MCP servers", () => {
      const servers = ["calculator", "datetime", "weather"];
      statusService.setActiveMCPServers(servers);

      const activeServers = statusService.getActiveMCPServers();
      expect(activeServers).toEqual(servers);
      expect(activeServers).not.toBe(servers); // Should be a copy

      expect(mockLogger.debug).toHaveBeenCalledWith(
        "客户端状态更新，来源: mcp-servers-update",
        expect.any(Object)
      );

      expect(mockEventBus.emitEvent).toHaveBeenCalledWith("status:updated", {
        status: expect.objectContaining({
          activeMCPServers: servers,
        }),
        source: "mcp-servers-update",
      });
    });

    it("should handle empty servers array", () => {
      statusService.setActiveMCPServers([]);

      const activeServers = statusService.getActiveMCPServers();
      expect(activeServers).toEqual([]);
    });

    it("should create copy of input array", () => {
      const servers = ["calculator", "datetime"];
      statusService.setActiveMCPServers(servers);

      // Modify original array
      servers.push("weather");

      const activeServers = statusService.getActiveMCPServers();
      expect(activeServers).toEqual(["calculator", "datetime"]);
    });
  });

  describe("setMcpEndpoint", () => {
    it("should set MCP endpoint", () => {
      const endpoint = "ws://localhost:4000";
      statusService.setMcpEndpoint(endpoint);

      const status = statusService.getClientStatus();
      expect(status.mcpEndpoint).toBe(endpoint);

      expect(mockLogger.debug).toHaveBeenCalledWith(
        "客户端状态更新，来源: mcp-endpoint-update",
        expect.any(Object)
      );

      expect(mockEventBus.emitEvent).toHaveBeenCalledWith("status:updated", {
        status: expect.objectContaining({
          mcpEndpoint: endpoint,
        }),
        source: "mcp-endpoint-update",
      });
    });

    it("should handle empty endpoint", () => {
      statusService.setMcpEndpoint("");

      const status = statusService.getClientStatus();
      expect(status.mcpEndpoint).toBe("");
    });

    it("should update existing endpoint", () => {
      statusService.setMcpEndpoint("ws://localhost:3000");
      statusService.setMcpEndpoint("ws://localhost:4000");

      const status = statusService.getClientStatus();
      expect(status.mcpEndpoint).toBe("ws://localhost:4000");
    });
  });

  describe("reset", () => {
    it("should reset all status to initial state", () => {
      // Set up some state
      statusService.updateClientInfo({
        status: "connected",
        mcpEndpoint: "ws://localhost:3000",
        activeMCPServers: ["calculator", "datetime"],
        lastHeartbeat: 1234567890,
      });
      statusService.updateRestartStatus("completed");

      // Reset
      statusService.reset();

      // Check client status is reset
      const clientStatus = statusService.getClientStatus();
      expect(clientStatus).toEqual({
        status: "disconnected",
        mcpEndpoint: "",
        activeMCPServers: [],
      });

      // Check restart status is reset
      const restartStatus = statusService.getRestartStatus();
      expect(restartStatus).toBeUndefined();

      expect(mockLogger.info).toHaveBeenCalledWith("重置状态服务");
    });

    it("should clear heartbeat timeout on reset", () => {
      const clearTimeoutSpy = vi.spyOn(global, "clearTimeout");

      statusService.updateClientInfo({ status: "connected" });
      statusService.reset();

      expect(clearTimeoutSpy).toHaveBeenCalled();
    });
  });

  describe("destroy", () => {
    it("should destroy service and reset state", () => {
      // Set up some state
      statusService.updateClientInfo({
        status: "connected",
        mcpEndpoint: "ws://localhost:3000",
        activeMCPServers: ["calculator"],
      });
      statusService.updateRestartStatus("restarting");

      // Destroy
      statusService.destroy();

      // Check state is reset
      const clientStatus = statusService.getClientStatus();
      expect(clientStatus).toEqual({
        status: "disconnected",
        mcpEndpoint: "",
        activeMCPServers: [],
      });

      const restartStatus = statusService.getRestartStatus();
      expect(restartStatus).toBeUndefined();

      expect(mockLogger.info).toHaveBeenCalledWith("销毁状态服务");
      expect(mockLogger.info).toHaveBeenCalledWith("重置状态服务");
    });

    it("should clear heartbeat timeout on destroy", () => {
      const clearTimeoutSpy = vi.spyOn(global, "clearTimeout");

      statusService.updateClientInfo({ status: "connected" });
      statusService.destroy();

      expect(clearTimeoutSpy).toHaveBeenCalled();
    });
  });

  describe("integration scenarios", () => {
    it("should handle complete client lifecycle", () => {
      const mockTimestamp = 1234567890;
      vi.spyOn(Date, "now").mockReturnValue(mockTimestamp);

      // Initial state
      expect(statusService.isClientConnected()).toBe(false);
      expect(statusService.getActiveMCPServers()).toEqual([]);

      // Client connects
      statusService.updateClientInfo({
        status: "connected",
        mcpEndpoint: "ws://localhost:3000",
        activeMCPServers: ["calculator"],
        lastHeartbeat: mockTimestamp,
      });

      expect(statusService.isClientConnected()).toBe(true);
      expect(statusService.getActiveMCPServers()).toEqual(["calculator"]);
      expect(statusService.getLastHeartbeat()).toBe(mockTimestamp);

      // Add more servers
      statusService.setActiveMCPServers(["calculator", "datetime", "weather"]);
      expect(statusService.getActiveMCPServers()).toEqual([
        "calculator",
        "datetime",
        "weather",
      ]);

      // Client disconnects
      statusService.updateClientInfo({ status: "disconnected" });
      expect(statusService.isClientConnected()).toBe(false);

      // Full status should reflect all changes
      const fullStatus = statusService.getFullStatus();
      expect(fullStatus.client.status).toBe("disconnected");
      expect(fullStatus.client.activeMCPServers).toEqual([
        "calculator",
        "datetime",
        "weather",
      ]);
    });

    it("should handle restart workflow", () => {
      const mockTimestamp = 1234567890;
      vi.spyOn(Date, "now").mockReturnValue(mockTimestamp);

      // Start restart
      statusService.updateRestartStatus("restarting");
      expect(statusService.getRestartStatus()?.status).toBe("restarting");
      expect(mockEventBus.emitEvent).toHaveBeenCalledWith(
        "service:restart:started",
        {
          serviceName: "",
          attempt: 1,
          timestamp: mockTimestamp,
        }
      );

      // Complete restart
      statusService.updateRestartStatus("completed");
      expect(statusService.getRestartStatus()?.status).toBe("completed");
      expect(mockEventBus.emitEvent).toHaveBeenCalledWith(
        "service:restart:completed",
        {
          serviceName: "",
          attempt: 1,
          timestamp: mockTimestamp,
        }
      );

      // Full status should include restart info
      const fullStatus = statusService.getFullStatus();
      expect(fullStatus.restart?.status).toBe("completed");
    });

    it("should handle concurrent updates", () => {
      // Simulate concurrent updates
      statusService.updateClientInfo({ status: "connected" }, "source1");
      statusService.updateClientInfo(
        { mcpEndpoint: "ws://localhost:3000" },
        "source2"
      );
      statusService.updateClientInfo(
        { activeMCPServers: ["calculator"] },
        "source3"
      );

      const status = statusService.getClientStatus();
      expect(status.status).toBe("connected");
      expect(status.mcpEndpoint).toBe("ws://localhost:3000");
      expect(status.activeMCPServers).toEqual(["calculator"]);

      // Should have emitted multiple events
      expect(mockEventBus.emitEvent).toHaveBeenCalledTimes(3);
    });
  });

  describe("edge cases and boundary conditions", () => {
    it("should handle null and undefined values gracefully", () => {
      // These should not cause errors
      statusService.updateClientInfo({});
      statusService.setActiveMCPServers([]);
      statusService.setMcpEndpoint("");

      const status = statusService.getClientStatus();
      expect(status).toBeDefined();
    });

    it("should handle very large server arrays", () => {
      const largeServerArray = Array.from(
        { length: 1000 },
        (_, i) => `server-${i}`
      );
      statusService.setActiveMCPServers(largeServerArray);

      const servers = statusService.getActiveMCPServers();
      expect(servers).toHaveLength(1000);
      expect(servers[0]).toBe("server-0");
      expect(servers[999]).toBe("server-999");
    });

    it("should handle very long endpoint URLs", () => {
      const longEndpoint = `ws://localhost:3000/${"a".repeat(10000)}`;
      statusService.setMcpEndpoint(longEndpoint);

      const status = statusService.getClientStatus();
      expect(status.mcpEndpoint).toBe(longEndpoint);
    });

    it("should handle rapid status changes", () => {
      // Rapid status changes
      for (let i = 0; i < 100; i++) {
        statusService.updateClientInfo({
          status: i % 2 === 0 ? "connected" : "disconnected",
        });
      }

      const status = statusService.getClientStatus();
      expect(status.status).toBe("disconnected"); // Last update was disconnected
    });

    it("should handle multiple heartbeat timeouts", () => {
      // Set up multiple connections and timeouts
      statusService.updateClientInfo({ status: "connected" });
      statusService.updateClientInfo({ status: "connected" });
      statusService.updateClientInfo({ status: "connected" });

      // Advance time to trigger timeout
      vi.advanceTimersByTime(35000);

      expect(statusService.isClientConnected()).toBe(false);
    });

    it("should handle restart status updates with special characters", () => {
      const specialErrorMessage = "Error: 特殊字符 & symbols! @#$%^&*()";
      statusService.updateRestartStatus("failed", specialErrorMessage);

      const status = statusService.getRestartStatus();
      expect(status?.error).toBe(specialErrorMessage);
    });

    it("should provide shallow immutability for client status", () => {
      statusService.updateClientInfo({
        status: "connected",
        activeMCPServers: ["calculator"],
      });

      const status1 = statusService.getClientStatus();
      const status2 = statusService.getClientStatus();

      // Status objects should be different instances
      expect(status1).not.toBe(status2);

      // But arrays inside are shared references (shallow copy)
      expect(status1.activeMCPServers).toBe(status2.activeMCPServers);

      // Modifying the array affects both references
      status1.activeMCPServers.push("datetime");
      expect(status2.activeMCPServers).toEqual(["calculator", "datetime"]);
    });

    it("should provide deep immutability for getActiveMCPServers", () => {
      statusService.updateClientInfo({
        activeMCPServers: ["calculator"],
      });

      const servers1 = statusService.getActiveMCPServers();
      const servers2 = statusService.getActiveMCPServers();

      // Arrays should be different instances
      expect(servers1).not.toBe(servers2);

      // Modifying one array should not affect the other
      servers1.push("datetime");
      expect(servers2).toEqual(["calculator"]);
      expect(statusService.getActiveMCPServers()).toEqual(["calculator"]);
    });

    it("should handle Date.now() returning edge values", () => {
      // Test with edge timestamp values
      vi.spyOn(Date, "now").mockReturnValue(0);
      statusService.updateClientInfo({ lastHeartbeat: 123 });
      expect(statusService.getLastHeartbeat()).toBe(0);

      vi.spyOn(Date, "now").mockReturnValue(Number.MAX_SAFE_INTEGER);
      statusService.updateRestartStatus("completed");
      const status = statusService.getRestartStatus();
      expect(status?.timestamp).toBe(Number.MAX_SAFE_INTEGER);
    });

    it("should handle clearTimeout with invalid timeout IDs", () => {
      const clearTimeoutSpy = vi.spyOn(global, "clearTimeout");

      // Call clearHeartbeatTimeout multiple times
      statusService.clearHeartbeatTimeout();
      statusService.clearHeartbeatTimeout();
      statusService.clearHeartbeatTimeout();

      // Should not cause errors
      expect(clearTimeoutSpy).not.toHaveBeenCalled();
    });
  });
});

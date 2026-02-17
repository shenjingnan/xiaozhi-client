/**
 * ESP32服务单元测试
 * 测试设备连接、Token简化后的行为等
 */

import type { ESP32DeviceReport } from "@/types/esp32.js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { WebSocket } from "ws";
import { DeviceRegistryService } from "../device-registry.service.js";
import { ESP32Service } from "../esp32.service.js";
import { NoOpVoiceSessionService } from "../voice-session.interface.js";

// Mock dependencies
vi.mock("../../Logger.js", () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
}));

describe("ESP32Service", () => {
  let esp32Service: ESP32Service;
  let deviceRegistry: DeviceRegistryService;
  let mockLogger: any;
  let mockWebSocket: any;

  beforeEach(async () => {
    vi.clearAllMocks();

    // Mock Logger
    mockLogger = {
      debug: vi.fn(),
      info: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
    };
    const { logger } = await import("../../Logger.js");
    Object.assign(logger, mockLogger);

    // 创建设备注册服务
    deviceRegistry = new DeviceRegistryService();

    // 创建ESP32服务（使用默认的空实现语音服务）
    esp32Service = new ESP32Service(deviceRegistry);

    // Mock WebSocket
    mockWebSocket = {
      close: vi.fn(),
      send: vi.fn(),
      readyState: 1, // OPEN
      on: vi.fn(),
      removeListener: vi.fn(),
    };
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("constructor", () => {
    it("应该正确初始化ESP32服务", () => {
      expect(esp32Service).toBeInstanceOf(ESP32Service);
    });

    it("应该使用传入的语音会话服务", () => {
      const customVoiceService = new NoOpVoiceSessionService();
      const serviceWithCustom = new ESP32Service(
        deviceRegistry,
        customVoiceService
      );
      expect(serviceWithCustom).toBeInstanceOf(ESP32Service);
    });
  });

  describe("handleOTARequest", () => {
    const mockDeviceReport: ESP32DeviceReport = {
      version: 1,
      language: "zh-CN",
      mac_address: "AA:BB:CC:DD:EE:FF",
      application: {
        name: "xiaozhi-esp32",
        version: "2.2.0",
        board: {
          type: "esp32-s3-korvo-1",
        },
      },
      board: {
        type: "esp32-s3-korvo-1",
        name: "ESP32-S3-Korvo-1",
      },
    };

    it("应该自动注册新设备并返回空Token", async () => {
      const deviceId = "AA:BB:CC:DD:EE:FF";
      const clientId = "test-client-uuid";
      const host = "192.168.1.100:9999";

      const response = await esp32Service.handleOTARequest(
        deviceId,
        clientId,
        mockDeviceReport,
        undefined,
        host
      );

      // 验证设备已注册
      const device = deviceRegistry.getDevice(deviceId);
      expect(device).not.toBeNull();
      expect(device?.deviceId).toBe(deviceId);
      expect(device?.status).toBe("active");

      // 验证返回空Token
      expect(response.websocket?.token).toBe("");
      expect(response.websocket?.url).toBe("ws://192.168.1.100:9999/ws");
      expect(response.websocket?.version).toBe(2);
    });

    it("应该更新已存在设备的最后活跃时间", async () => {
      const deviceId = "AA:BB:CC:DD:EE:FF";
      const clientId = "test-client-uuid";

      // 首次注册
      await esp32Service.handleOTARequest(
        deviceId,
        clientId,
        mockDeviceReport,
        undefined,
        "192.168.1.100:9999"
      );

      const device = deviceRegistry.getDevice(deviceId);
      const firstSeenAt = device?.lastSeenAt;

      // 等待一下，然后再次请求
      await new Promise((resolve) => setTimeout(resolve, 10));

      await esp32Service.handleOTARequest(
        deviceId,
        clientId,
        mockDeviceReport,
        undefined,
        "192.168.1.100:9999"
      );

      const updatedDevice = deviceRegistry.getDevice(deviceId);
      expect(updatedDevice?.lastSeenAt.getTime()).toBeGreaterThan(
        firstSeenAt?.getTime() ?? 0
      );
    });

    it("应该从host中正确提取服务器地址", async () => {
      const response = await esp32Service.handleOTARequest(
        "AA:BB:CC:DD:EE:FF",
        "test-client",
        mockDeviceReport,
        undefined,
        "example.com"
      );

      expect(response.websocket?.url).toBe("ws://example.com:9999/ws");
    });

    it("应该正确处理包含端口的host", async () => {
      const response = await esp32Service.handleOTARequest(
        "AA:BB:CC:DD:EE:FF",
        "test-client",
        mockDeviceReport,
        undefined,
        "example.com:8080"
      );

      expect(response.websocket?.url).toBe("ws://example.com:8080/ws");
    });

    it("应该处理缺少host的情况", async () => {
      await expect(
        esp32Service.handleOTARequest(
          "AA:BB:CC:DD:EE:FF",
          "test-client",
          mockDeviceReport,
          undefined,
          undefined
        )
      ).rejects.toThrow("无法获取服务器地址：缺少 Host 头");
    });
  });

  describe("handleWebSocketConnection", () => {
    const deviceId = "AA:BB:CC:DD:EE:FF";
    const clientId = "test-client-uuid";

    beforeEach(() => {
      // 预先注册设备
      deviceRegistry.createDevice(deviceId, "esp32-s3-korvo-1", "2.2.0");
    });

    it("应该接受已注册设备的连接（无Token）", async () => {
      await esp32Service.handleWebSocketConnection(
        mockWebSocket as WebSocket,
        deviceId,
        clientId
      );

      expect(mockWebSocket.close).not.toHaveBeenCalled();
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining("ESP32设备连接已建立")
      );
    });

    it("应该接受已注册设备的连接（有Token但被忽略）", async () => {
      const oldToken = "some-old-token";

      await esp32Service.handleWebSocketConnection(
        mockWebSocket as WebSocket,
        deviceId,
        clientId,
        oldToken
      );

      expect(mockWebSocket.close).not.toHaveBeenCalled();
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining("收到Token（已忽略）")
      );
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining("ESP32设备连接已建立")
      );
    });

    it("应该拒绝未注册设备的连接", async () => {
      const unregisteredDeviceId = "11:22:33:44:55:66";

      await esp32Service.handleWebSocketConnection(
        mockWebSocket as WebSocket,
        unregisteredDeviceId,
        clientId
      );

      expect(mockWebSocket.close).toHaveBeenCalledWith(
        1008,
        "Device not registered"
      );
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining("设备未注册，拒绝连接")
      );
    });

    it("应该处理空字符串Token（向后兼容）", async () => {
      await esp32Service.handleWebSocketConnection(
        mockWebSocket as WebSocket,
        deviceId,
        clientId,
        ""
      );

      // 空字符串被视为 falsy，所以不会有 debug 日志
      expect(mockWebSocket.close).not.toHaveBeenCalled();
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining("ESP32设备连接已建立")
      );
    });

    it("应该断开设备的旧连接并建立新连接", async () => {
      const mockOldWebSocket = {
        close: vi.fn().mockResolvedValue(undefined),
        readyState: 1,
        on: vi.fn(),
        removeListener: vi.fn(),
      };

      // 设置现有连接
      (esp32Service as any).connections.set(deviceId, {
        close: mockOldWebSocket.close,
      });

      await esp32Service.handleWebSocketConnection(
        mockWebSocket as WebSocket,
        deviceId,
        clientId
      );

      expect(mockOldWebSocket.close).toHaveBeenCalled();
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining("断开旧连接")
      );
    });
  });

  describe("设备断线重连场景", () => {
    const deviceId = "AA:BB:CC:DD:EE:FF";
    const clientId = "test-client-uuid";

    beforeEach(() => {
      deviceRegistry.createDevice(deviceId, "esp32-s3-korvo-1", "2.2.0");
    });

    it("应该允许设备重连而无需新的Token", async () => {
      // 首次连接
      await esp32Service.handleWebSocketConnection(
        mockWebSocket as WebSocket,
        deviceId,
        clientId
      );

      expect(mockWebSocket.close).not.toHaveBeenCalled();

      // 模拟断线
      (esp32Service as any).handleDeviceDisconnect(deviceId, clientId);

      // 创建新的WebSocket mock
      const newMockWebSocket = {
        close: vi.fn(),
        readyState: 1,
        on: vi.fn(),
        removeListener: vi.fn(),
      };

      // 重连（不提供Token）
      await esp32Service.handleWebSocketConnection(
        newMockWebSocket as WebSocket,
        deviceId,
        clientId
      );

      expect(newMockWebSocket.close).not.toHaveBeenCalled();
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining("ESP32设备连接已建立")
      );
    });

    it("应该允许设备使用旧的Token重连（但Token被忽略）", async () => {
      const oldToken = "some-old-token-from-first-ota";

      // 首次连接（带Token）
      await esp32Service.handleWebSocketConnection(
        mockWebSocket as WebSocket,
        deviceId,
        clientId,
        oldToken
      );

      // 模拟断线
      (esp32Service as any).handleDeviceDisconnect(deviceId, clientId);

      const newMockWebSocket = {
        close: vi.fn(),
        readyState: 1,
        on: vi.fn(),
        removeListener: vi.fn(),
      };

      // 重连（使用相同的旧Token）
      await esp32Service.handleWebSocketConnection(
        newMockWebSocket as WebSocket,
        deviceId,
        clientId,
        oldToken
      );

      expect(newMockWebSocket.close).not.toHaveBeenCalled();
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining("收到Token（已忽略）")
      );
    });
  });

  describe("向后兼容性", () => {
    const deviceId = "AA:BB:CC:DD:EE:FF";
    const clientId = "test-client-uuid";

    beforeEach(() => {
      deviceRegistry.createDevice(deviceId, "esp32-s3-korvo-1", "2.2.0");
    });

    it("旧设备发送Token不应导致错误", async () => {
      const legacyToken = "legacy-device-token";

      await esp32Service.handleWebSocketConnection(
        mockWebSocket as WebSocket,
        deviceId,
        clientId,
        legacyToken
      );

      expect(mockWebSocket.close).not.toHaveBeenCalled();
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining("收到Token（已忽略）")
      );
    });

    it("新设备不发送Token应该正常工作", async () => {
      await esp32Service.handleWebSocketConnection(
        mockWebSocket as WebSocket,
        deviceId,
        clientId
      );

      expect(mockWebSocket.close).not.toHaveBeenCalled();
    });

    it("OTA响应应该包含空字符串Token而非undefined", async () => {
      const response = await esp32Service.handleOTARequest(
        deviceId,
        clientId,
        {
          version: 1,
          application: {
            version: "2.2.0",
            board: { type: "esp32-s3-korvo-1" },
          },
        },
        undefined,
        "192.168.1.100:9999"
      );

      expect(response.websocket?.token).toBe("");
      expect(response.websocket?.token).not.toBeUndefined();
    });
  });

  describe("destroy", () => {
    it("应该正确清理所有资源", async () => {
      const deviceId = "AA:BB:CC:DD:EE:FF";
      const clientId = "test-client-uuid";

      deviceRegistry.createDevice(deviceId, "esp32-s3-korvo-1", "2.2.0");

      const mockConnection = {
        close: vi.fn().mockResolvedValue(undefined),
      };

      (esp32Service as any).connections.set(deviceId, mockConnection);
      (esp32Service as any).clientIdToDeviceId.set(clientId, deviceId);

      await esp32Service.destroy();

      expect(mockConnection.close).toHaveBeenCalled();
      expect((esp32Service as any).connections.size).toBe(0);
      expect((esp32Service as any).clientIdToDeviceId.size).toBe(0);
    });
  });

  describe("集成测试场景", () => {
    it("完整的设备连接流程：OTA -> WebSocket", async () => {
      const deviceId = "AA:BB:CC:DD:EE:FF";
      const clientId = "test-client-uuid";
      const host = "192.168.1.100:9999";

      // 1. 设备发起OTA请求
      const otaResponse = await esp32Service.handleOTARequest(
        deviceId,
        clientId,
        {
          version: 1,
          application: {
            version: "2.2.0",
            board: { type: "esp32-s3-korvo-1" },
          },
        },
        undefined,
        host
      );

      // 验证OTA响应
      expect(otaResponse.websocket?.token).toBe("");
      expect(otaResponse.websocket?.url).toBe(`ws://${host}/ws`);

      // 验证设备已注册
      const device = deviceRegistry.getDevice(deviceId);
      expect(device?.status).toBe("active");

      // 2. 设备建立WebSocket连接
      await esp32Service.handleWebSocketConnection(
        mockWebSocket as WebSocket,
        deviceId,
        clientId
      );

      expect(mockWebSocket.close).not.toHaveBeenCalled();
    });

    it("多设备同时连接应该互不影响", async () => {
      const device1 = "AA:BB:CC:DD:EE:FF";
      const device2 = "11:22:33:44:55:66";
      const client1 = "client-1";
      const client2 = "client-2";

      const mockWs1 = { close: vi.fn(), readyState: 1, on: vi.fn(), removeListener: vi.fn() };
      const mockWs2 = { close: vi.fn(), readyState: 1, on: vi.fn(), removeListener: vi.fn() };

      // 注册并连接设备1
      deviceRegistry.createDevice(device1, "esp32-s3-korvo-1", "2.2.0");
      await esp32Service.handleWebSocketConnection(
        mockWs1 as any,
        device1,
        client1
      );

      // 注册并连接设备2
      deviceRegistry.createDevice(device2, "esp32-s3-korvo-1", "2.2.0");
      await esp32Service.handleWebSocketConnection(
        mockWs2 as any,
        device2,
        client2
      );

      expect(mockWs1.close).not.toHaveBeenCalled();
      expect(mockWs2.close).not.toHaveBeenCalled();

      // 验证两个设备都有独立连接
      expect((esp32Service as any).connections.size).toBe(2);
    });
  });
});

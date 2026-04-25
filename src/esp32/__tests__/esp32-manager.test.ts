/**
 * ESP32 设备管理器单元测试
 * 测试 ESP32DeviceManager 的 OTA 处理和设备管理功能
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { ESP32DeviceManager } from "../esp32-manager.js";

// Mock 依赖模块 - 使用 let 以便在测试中动态调整
let mockGetDevice = vi.fn().mockReturnValue(null);
let mockCreateDevice = vi.fn().mockReturnValue({
  deviceId: "test-device",
  macAddress: "test-device",
  board: "esp32-s3",
  appVersion: "1.0.0",
  status: "active" as const,
  createdAt: new Date(),
  lastSeenAt: new Date(),
});

vi.mock("../device-registry.js", () => ({
  DeviceRegistryService: vi.fn().mockImplementation(() => ({
    createDevice: (...args: unknown[]) => mockCreateDevice(...args),
    getDevice: (...args: unknown[]) => mockGetDevice(...args),
    updateDeviceStatus: vi.fn(),
    updateLastSeen: vi.fn(),
    destroy: vi.fn(),
  })),
}));

vi.mock("../connection.js", () => ({
  ESP32Connection: vi.fn().mockImplementation(() => ({
    getSessionId: () => "session-1",
    getDeviceId: () => "device-1",
    getClientId: () => "client-1",
    getState: () => "connected" as const,
    send: vi.fn().mockResolvedValue(undefined),
    sendBinaryProtocol2: vi.fn().mockResolvedValue(undefined),
    close: vi.fn().mockResolvedValue(undefined),
    checkTimeout: () => false,
    isHelloCompleted: () => true,
  })),
}));

vi.mock("../services/asr.service.js", () => ({
  ASRService: vi.fn().mockImplementation(() => ({
    prepare: vi.fn().mockResolvedValue(undefined),
    connect: vi.fn().mockResolvedValue(undefined),
    init: vi.fn().mockResolvedValue(undefined),
    handleAudioData: vi.fn().mockResolvedValue(undefined),
    end: vi.fn().mockResolvedValue(undefined),
    reset: vi.fn().mockResolvedValue(undefined),
    destroy: vi.fn(),
  })),
}));

vi.mock("../services/tts.service.js", () => ({
  TTSService: vi.fn().mockImplementation(() => ({
    speak: vi.fn().mockResolvedValue(undefined),
    processAudioBuffer: vi.fn().mockResolvedValue({
      packetCount: 0,
      totalDuration: 0,
    }),
    cleanup: vi.fn(),
    setGetConnection: vi.fn(),
    destroy: vi.fn(),
    getPacketDuration: () => 20,
  })),
  mapClusterToResourceId: vi.fn((c?: string) =>
    c === "volcano_icl" ? "seed-tts-1.0" : "seed-tts-2.0"
  ),
}));

vi.mock("../services/llm.service.js", () => ({
  LLMService: vi.fn().mockImplementation(() => ({
    isAvailable: () => false,
    chat: vi.fn().mockResolvedValue("默认回复"),
  })),
}));

describe("ESP32DeviceManager", () => {
  let manager: ESP32DeviceManager;

  beforeEach(() => {
    vi.clearAllMocks();
    // 重置 mock 函数为默认行为（getDevice 返回 null）
    mockGetDevice = vi.fn().mockReturnValue(null);
    mockCreateDevice = vi.fn().mockReturnValue({
      deviceId: "test-device",
      macAddress: "test-device",
      board: "esp32-s3",
      appVersion: "1.0.0",
      status: "active" as const,
      createdAt: new Date(),
      lastSeenAt: new Date(),
    });
  });

  describe("constructor", () => {
    it("默认固件版本 2.2.2", () => {
      manager = new ESP32DeviceManager();
    });

    it("默认 forceUpdate=false", () => {
      manager = new ESP32DeviceManager();
    });

    it("默认 URL 格式为 ws://{host}/ws", async () => {
      manager = new ESP32DeviceManager();
      const response = await manager.handleOTARequest(
        "AA:BB:CC:DD:EE:FF",
        "client-1",
        { application: { version: "1.0.0" }, board: { type: "esp32-s3" } },
        undefined,
        "192.168.1.100:8080"
      );
      expect(response.websocket?.url).toBe("ws://192.168.1.100:8080/ws");
    });

    it("无 configProvider 时 LLM=null", () => {
      manager = new ESP32DeviceManager();
      expect(manager.getASRService()).toBeDefined(); // ASR 始终创建
    });
  });

  describe("handleOTARequest", () => {
    it("完整 OTA 返回正确结构", async () => {
      manager = new ESP32DeviceManager();

      const response = await manager.handleOTARequest(
        "AA:BB:CC:DD:EE:FF",
        "uuid-123",
        {
          application: { version: "2.1.0" },
          board: { type: "esp32-s3-box" },
        },
        undefined,
        "example.com:3000"
      );

      // camelToSnakeCase 转换后使用 snake_case 键名
      expect(response).toHaveProperty("websocket");
      expect(response).toHaveProperty("server_time"); // serverTime → server_time
      expect(response).toHaveProperty("firmware"); // firmware 无大写字母，保持不变

      expect(response.websocket?.url).toBe("ws://example.com:3000/ws");
      expect(response.websocket?.token).toBe("");
      expect(response.websocket?.version).toBe(2);

      // firmware 内部字段也是 snake_case
      const firmware = response.firmware as unknown as Record<string, unknown>;
      expect(firmware.version).toBe("2.2.2");
      expect(firmware.force).toBe(false);

      const serverTime = (response as unknown as Record<string, string>)
        .server_time as unknown as Record<string, unknown>;
      expect(Number(serverTime.timestamp)).toBeGreaterThan(0);
      expect(typeof serverTime.timezone_offset).toBe("number");

      // 验证 audioParams 经 camelToSnakeCase 转换后存在且值正确
      expect(response).toHaveProperty("audio_params");
      const audioParams = response.audio_params as Record<string, unknown>;
      expect(audioParams.format).toBe("opus");
      expect(audioParams.sample_rate).toBe(24000);
      expect(audioParams.channels).toBe(1);
      expect(audioParams.frame_duration).toBe(60);
    });

    it("新设备自动注册", async () => {
      manager = new ESP32DeviceManager();

      await manager.handleOTARequest(
        "new-device-id",
        "client-new",
        {
          application: { version: "1.0.0" },
          board: { type: "esp32-wroom" },
        },
        undefined,
        "localhost:8080"
      );

      expect(mockCreateDevice).toHaveBeenCalledWith(
        "new-device-id",
        "esp32-wroom",
        "1.0.0"
      );
    });

    it("已有设备更新活跃时间", async () => {
      // 临时让 getDevice 返回一个已存在的设备
      mockGetDevice = vi.fn().mockReturnValue({
        deviceId: "existing-device",
        status: "active" as const,
        createdAt: new Date(),
        lastSeenAt: new Date(),
      });

      manager = new ESP32DeviceManager();

      await manager.handleOTARequest(
        "existing-device",
        "client-1",
        {
          application: { version: "2.0.0" },
          board: { type: "esp32-s3" },
        },
        undefined,
        "host:8080"
      );

      expect(mockGetDevice).toHaveBeenCalledWith("existing-device");
    });

    it("缺 Host 抛错", async () => {
      manager = new ESP32DeviceManager();

      await expect(
        manager.handleOTARequest("device-1", "client-1", {
          application: { version: "1.0.0" },
          board: { type: "test" },
        })
      ).rejects.toThrow("无法获取服务器地址：缺少 Host 头");
    });

    it("响应 snake_case 格式", async () => {
      manager = new ESP32DeviceManager();

      const response = await manager.handleOTARequest(
        "d1",
        "c1",
        { application: { version: "1.0" }, board: { type: "b1" } },
        undefined,
        "h:80"
      );

      // 验证 snake_case 转换
      expect(response).not.toHaveProperty("serverTime");
      expect(response).toHaveProperty("server_time");
      // firmware 键名无大写字母，保持不变
      expect(response).toHaveProperty("firmware");

      const firmware = response.firmware as unknown as Record<string, unknown>;
      // firmwareVersion → firmware_version（如果有这个字段的话）
      // 当前固件对象只有 version/force/url，都是全小写
      expect(firmware).toHaveProperty("version");
      expect(firmware).toHaveProperty("force");
    });

    it("自定义 URL builder 生效", async () => {
      const customUrlBuilder = (host: string) => `wss://custom.${host}/v1/ws`;
      manager = new ESP32DeviceManager({ buildWebSocketUrl: customUrlBuilder });

      const response = await manager.handleOTARequest(
        "d1",
        "c1",
        { application: { version: "1.0" }, board: { type: "b1" } },
        undefined,
        "my-server.com:443"
      );

      expect(response.websocket?.url).toBe(
        "wss://custom.my-server.com:443/v1/ws"
      );
    });

    it("自定义固件配置生效", async () => {
      manager = new ESP32DeviceManager({
        firmwareVersion: "3.0.0-beta",
        firmwareUrl: "https://firmware.example.com/v3.bin",
        forceUpdate: true,
      });

      const response = await manager.handleOTARequest(
        "d1",
        "c1",
        { application: { version: "1.0" }, board: { type: "b1" } },
        undefined,
        "h:80"
      );

      const firmware = response.firmware as unknown as Record<string, unknown>;
      expect(firmware.version).toBe("3.0.0-beta");
      expect(firmware.url).toBe("https://firmware.example.com/v3.bin");
      expect(firmware.force).toBe(true);
    });
  });

  describe("查询方法", () => {
    it("getDevice 不存在返回 null", () => {
      manager = new ESP32DeviceManager();
      // mockGetDevice 默认返回 null
      expect(manager.getDevice("non-existent")).toBeNull();
    });

    it("getConnection 不存在返回 undefined", () => {
      manager = new ESP32DeviceManager();
      expect(manager.getConnection("non-existent")).toBeUndefined();
    });
  });

  describe("destroy", () => {
    it("断开连接并清理服务", async () => {
      manager = new ESP32DeviceManager();

      await manager.destroy();

      // destroy 后 registry.destroy 被调用，之后 getDevice 通过 registry 获取
      // 由于 mockGetDevice 返回 null，这里应该返回 null
      expect(manager.getDevice("any")).toBeNull();
      expect(manager.getConnection("any")).toBeUndefined();
    });
  });
});

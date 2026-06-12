/**
 * ESP32 Handler 测试
 * 测试 ESP32 设备 OTA/配置请求处理逻辑
 */
import type { ESP32Service } from "@/services/esp32.service.js";
import type { ESP32DeviceReport, ESP32OTAResponse } from "@/types/esp32.js";
import { ESP32ErrorCode } from "@/types/esp32.js";
import type { AppContext } from "@/types/hono.context.js";
import type { Context } from "hono";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ESP32Handler } from "../esp32.handler.js";

/**
 * Mock ESP32Service 类型定义
 */
interface MockESP32Service extends Partial<ESP32Service> {
  handleOTARequest: ReturnType<typeof vi.fn>;
}

/**
 * Mock Hono Context 类型定义
 */
interface MockContext {
  get: ReturnType<typeof vi.fn>;
  fail: ReturnType<typeof vi.fn>;
  json: ReturnType<typeof vi.fn>;
  req: {
    header: ReturnType<typeof vi.fn>;
    json: ReturnType<typeof vi.fn>;
  };
}

// 模拟 Logger
vi.mock("@/Logger.js", () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
}));

describe("ESP32Handler", () => {
  let esp32Handler: ESP32Handler;
  let mockESP32Service: MockESP32Service;
  let mockLogger: {
    debug: ReturnType<typeof vi.fn>;
    info: ReturnType<typeof vi.fn>;
    error: ReturnType<typeof vi.fn>;
    warn: ReturnType<typeof vi.fn>;
  };
  let mockContext: MockContext;

  const mockDeviceReport: ESP32DeviceReport = {
    application: {
      version: "1.0.0",
      board: {
        type: "ESP32-S3-BOX",
      },
    },
    board: {
      type: "ESP32-S3-BOX",
    },
  };

  /**
   * Mock OTA 响应（snake_case 格式，与 camelToSnakeCase 转换后的格式一致）
   */
  const mockOTAResponse = {
    websocket: {
      url: "ws://localhost:9999/ws",
      token: "",
      version: 2,
    },
    server_time: {
      timestamp: 1234567890,
      timezone_offset: -28800000,
    },
    firmware: {
      version: "2.2.2",
      url: "",
      force: false,
    },
  } as unknown as ESP32OTAResponse;

  beforeEach(async () => {
    vi.clearAllMocks();

    // 模拟 Logger
    mockLogger = {
      debug: vi.fn(),
      info: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
    };
    const { logger } = await import("@/Logger.js");
    Object.assign(logger, mockLogger);

    // 模拟 ESP32Service
    mockESP32Service = {
      handleOTARequest: vi.fn().mockResolvedValue(mockOTAResponse),
    };

    // 模拟 Hono Context
    mockContext = {
      get: vi.fn((key: string) => {
        if (key === "logger") return mockLogger;
        return undefined;
      }),
      fail: vi
        .fn()
        .mockImplementation(
          (code: string, message: string, details?: unknown, status = 400) => {
            return new Response(
              JSON.stringify({
                success: false,
                error: {
                  code,
                  message,
                  ...(details !== undefined && { details }),
                },
              }),
              {
                status,
                headers: { "Content-Type": "application/json" },
              }
            );
          }
        ),
      json: vi.fn().mockImplementation((data: unknown) => {
        return new Response(JSON.stringify(data), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }),
      req: {
        header: vi.fn(),
        json: vi.fn().mockResolvedValue(mockDeviceReport),
      },
    };

    esp32Handler = new ESP32Handler(
      mockESP32Service as unknown as ESP32Service
    );
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("constructor", () => {
    it("应该使用正确的依赖项初始化", () => {
      expect(esp32Handler).toBeInstanceOf(ESP32Handler);
      expect(mockLogger.debug).not.toHaveBeenCalled();
    });
  });

  describe("handleOTA", () => {
    const deviceId = "AA:BB:CC:DD:EE:FF";
    const clientId = "test-client-uuid";
    const host = "localhost:9999";

    beforeEach(() => {
      // 设置请求头 mock
      mockContext.req.header.mockImplementation((key: string) => {
        const headers: Record<string, string | undefined> = {
          "Device-Id": deviceId,
          "Client-Id": clientId,
          host: host,
        };
        return headers[key] || headers[key.toLowerCase()];
      });
    });

    it("应该成功处理有效的 OTA 请求", async () => {
      const response = await esp32Handler.handleOTA(
        mockContext as unknown as Context<AppContext>
      );

      expect(mockLogger.debug).toHaveBeenCalledWith(
        `收到OTA请求: deviceId=${deviceId}, clientId=${clientId}`
      );
      expect(mockESP32Service.handleOTARequest).toHaveBeenCalledWith(
        deviceId,
        clientId,
        mockDeviceReport,
        {
          deviceModel: undefined,
          deviceVersion: undefined,
        },
        host
      );
      expect(mockContext.json).toHaveBeenCalledWith(mockOTAResponse);
      expect(mockLogger.debug).toHaveBeenCalledWith("OTA响应", {
        response: mockOTAResponse,
      });
    });

    it("应该正确处理小写的请求头", async () => {
      mockContext.req.header.mockImplementation((key: string) => {
        const headers: Record<string, string | undefined> = {
          "device-id": deviceId,
          "client-id": clientId,
          host: host,
        };
        // 模拟 Hono 的 header 方法：先查原始 key，再查小写 key
        return headers[key] || headers[key.toLowerCase()];
      });

      const response = await esp32Handler.handleOTA(
        mockContext as unknown as AppContext
      );

      expect(mockESP32Service.handleOTARequest).toHaveBeenCalledWith(
        deviceId,
        clientId,
        mockDeviceReport,
        expect.any(Object),
        host
      );
      expect(mockContext.json).toHaveBeenCalled();
    });

    it("应该拒绝缺少 Device-Id 的请求", async () => {
      mockContext.req.header.mockImplementation((key: string) => {
        const headers: Record<string, string | undefined> = {
          "Client-Id": clientId,
          host: host,
        };
        return headers[key] || headers[key.toLowerCase()];
      });

      const response = await esp32Handler.handleOTA(
        mockContext as unknown as AppContext
      );

      expect(mockContext.fail).toHaveBeenCalledWith(
        ESP32ErrorCode.MISSING_DEVICE_ID,
        "缺少 Device-Id 请求头",
        undefined,
        400
      );
      expect(mockESP32Service.handleOTARequest).not.toHaveBeenCalled();
    });

    it("应该拒绝缺少 Client-Id 的请求", async () => {
      mockContext.req.header.mockImplementation((key: string) => {
        const headers: Record<string, string | undefined> = {
          "Device-Id": deviceId,
          host: host,
        };
        return headers[key] || headers[key.toLowerCase()];
      });

      const response = await esp32Handler.handleOTA(
        mockContext as unknown as AppContext
      );

      expect(mockContext.fail).toHaveBeenCalledWith(
        ESP32ErrorCode.MISSING_DEVICE_ID,
        "缺少 Client-Id 请求头",
        undefined,
        400
      );
      expect(mockESP32Service.handleOTARequest).not.toHaveBeenCalled();
    });

    it("应该从请求头提取设备型号和版本信息", async () => {
      const deviceModel = "ESP32-S3-BOX-3";
      const deviceVersion = "2.1.0";

      mockContext.req.header.mockImplementation((key: string) => {
        const headers: Record<string, string | undefined> = {
          "Device-Id": deviceId,
          "Client-Id": clientId,
          "Device-Model": deviceModel,
          "Device-Version": deviceVersion,
          host: host,
        };
        return headers[key] || headers[key.toLowerCase()];
      });

      const response = await esp32Handler.handleOTA(
        mockContext as unknown as AppContext
      );

      expect(mockESP32Service.handleOTARequest).toHaveBeenCalledWith(
        deviceId,
        clientId,
        mockDeviceReport,
        {
          deviceModel: deviceModel,
          deviceVersion: deviceVersion,
        },
        host
      );
    });

    it("应该正确处理小写的设备型号和版本请求头", async () => {
      const deviceModel = "ESP32-S3-BOX-3";
      const deviceVersion = "2.1.0";

      mockContext.req.header.mockImplementation((key: string) => {
        const headers: Record<string, string | undefined> = {
          "Device-Id": deviceId,
          "Client-Id": clientId,
          "device-model": deviceModel,
          "device-version": deviceVersion,
          host: host,
        };
        return headers[key] || headers[key.toLowerCase()];
      });

      const response = await esp32Handler.handleOTA(
        mockContext as unknown as AppContext
      );

      expect(mockESP32Service.handleOTARequest).toHaveBeenCalledWith(
        deviceId,
        clientId,
        mockDeviceReport,
        {
          deviceModel: deviceModel,
          deviceVersion: deviceVersion,
        },
        host
      );
    });

    it("应该处理请求体格式错误", async () => {
      const jsonError = new Error("Invalid JSON");
      mockContext.req.json.mockRejectedValue(jsonError);

      const response = await esp32Handler.handleOTA(
        mockContext as unknown as AppContext
      );

      expect(mockLogger.error).toHaveBeenCalledWith(
        "处理OTA请求失败:",
        expect.any(Error)
      );
      expect(mockContext.fail).toHaveBeenCalled();
    });

    it("应该处理 ESP32Service 错误", async () => {
      const serviceError = new Error("Service error");
      mockESP32Service.handleOTARequest.mockRejectedValue(serviceError);

      const response = await esp32Handler.handleOTA(
        mockContext as unknown as AppContext
      );

      expect(mockLogger.error).toHaveBeenCalledWith(
        "处理OTA请求失败:",
        serviceError
      );
      expect(mockContext.fail).toHaveBeenCalled();
    });

    it("应该处理非 Error 类型的异常", async () => {
      mockESP32Service.handleOTARequest.mockRejectedValue("字符串错误");

      const response = await esp32Handler.handleOTA(
        mockContext as unknown as AppContext
      );

      expect(mockLogger.error).toHaveBeenCalledWith(
        "处理OTA请求失败:",
        "字符串错误"
      );
      expect(mockContext.fail).toHaveBeenCalled();
    });
  });

  describe("handleOTA - 边界条件测试", () => {
    const deviceId = "AA:BB:CC:DD:EE:FF";
    const clientId = "test-client-uuid";
    const host = "localhost:9999";

    beforeEach(() => {
      mockContext.req.header.mockImplementation((key: string) => {
        const headers: Record<string, string | undefined> = {
          "Device-Id": deviceId,
          "Client-Id": clientId,
          host: host,
        };
        return headers[key] || headers[key.toLowerCase()];
      });
    });

    it("应该处理空的请求体", async () => {
      mockContext.req.json.mockResolvedValue({});

      await esp32Handler.handleOTA(mockContext as unknown as AppContext);

      expect(mockESP32Service.handleOTARequest).toHaveBeenCalledWith(
        deviceId,
        clientId,
        {},
        expect.any(Object),
        host
      );
    });

    it("应该处理复杂的设备上报信息", async () => {
      const complexReport: ESP32DeviceReport = {
        version: 2,
        language: "zh-CN",
        flash_size: 4194304,
        minimum_free_heap_size: "123456",
        mac_address: "AA:BB:CC:DD:EE:FF",
        uuid: clientId,
        chip_model_name: "ESP32-S3",
        chip_info: {
          model: 9,
          cores: 2,
          revision: 0,
          features: 18,
        },
        application: {
          name: "xiaozhi-esp32",
          version: "1.0.0",
          compile_time: "2024-01-01T00:00:00",
          idf_version: "v5.0",
          elf_sha256: "abc123",
          board: {
            type: "ESP32-S3-BOX",
          },
        },
        partition_table: [
          {
            label: "nvs",
            type: 1,
            subtype: 2,
            address: 0x9000,
            size: 0x6000,
          },
        ],
        ota: {
          label: "ota_0",
        },
        display: {
          monochrome: false,
          width: 320,
          height: 240,
        },
        board: {
          type: "ESP32-S3-BOX",
          name: "小智音箱",
          ssid: "WiFi-Home",
          rssi: -45,
          channel: 6,
          ip: "192.168.1.100",
          mac: "AA:BB:CC:DD:EE:FF",
        },
      };

      mockContext.req.json.mockResolvedValue(complexReport);

      await esp32Handler.handleOTA(mockContext as unknown as AppContext);

      expect(mockESP32Service.handleOTARequest).toHaveBeenCalledWith(
        deviceId,
        clientId,
        complexReport,
        expect.any(Object),
        host
      );
    });

    it("应该处理各种格式的设备 ID", async () => {
      const deviceIds = [
        "AA:BB:CC:DD:EE:FF",
        "AABBCCDDEEFF",
        "aa:bb:cc:dd:ee:ff",
        "aabbccddeeff",
      ];

      for (const testDeviceId of deviceIds) {
        vi.clearAllMocks();

        mockContext.req.header.mockImplementation((key: string) => {
          const headers: Record<string, string | undefined> = {
            "Device-Id": testDeviceId,
            "Client-Id": clientId,
            host: host,
          };
          return headers[key] || headers[key.toLowerCase()];
        });

        await esp32Handler.handleOTA(mockContext as unknown as AppContext);

        expect(mockESP32Service.handleOTARequest).toHaveBeenCalledWith(
          testDeviceId,
          clientId,
          mockDeviceReport,
          expect.any(Object),
          host
        );
      }
    });

    it("应该处理包含特殊字符的 Client-Id", async () => {
      const specialClientIds = [
        "client-123-测试",
        "uuid-with-dashes-12345",
        "client@test#123",
      ];

      for (const testClientId of specialClientIds) {
        vi.clearAllMocks();

        mockContext.req.header.mockImplementation((key: string) => {
          const headers: Record<string, string | undefined> = {
            "Device-Id": deviceId,
            "Client-Id": testClientId,
            host: host,
          };
          return headers[key] || headers[key.toLowerCase()];
        });

        await esp32Handler.handleOTA(mockContext as unknown as AppContext);

        expect(mockESP32Service.handleOTARequest).toHaveBeenCalledWith(
          deviceId,
          testClientId,
          mockDeviceReport,
          expect.any(Object),
          host
        );
      }
    });

    it("应该处理 Host 头的各种格式", async () => {
      const hosts = [
        "localhost:9999",
        "192.168.1.100:9999",
        "example.com:8080",
        "esp32.local",
      ];

      for (const testHost of hosts) {
        vi.clearAllMocks();

        mockContext.req.header.mockImplementation((key: string) => {
          const headers: Record<string, string | undefined> = {
            "Device-Id": deviceId,
            "Client-Id": clientId,
            host: testHost,
          };
          return headers[key] || headers[key.toLowerCase()];
        });

        await esp32Handler.handleOTA(mockContext as unknown as AppContext);

        expect(mockESP32Service.handleOTARequest).toHaveBeenCalledWith(
          deviceId,
          clientId,
          mockDeviceReport,
          expect.any(Object),
          testHost
        );
      }
    });

    it("应该处理缺少 Host 头的情况（服务层应抛出错误）", async () => {
      mockContext.req.header.mockImplementation((key: string) => {
        const headers: Record<string, string | undefined> = {
          "Device-Id": deviceId,
          "Client-Id": clientId,
        };
        return headers[key] || headers[key.toLowerCase()];
      });

      const hostError = new Error("无法获取服务器地址：缺少 Host 头", {
        cause: "MISSING_HOST_HEADER",
      });
      mockESP32Service.handleOTARequest.mockRejectedValue(hostError);

      await esp32Handler.handleOTA(mockContext as unknown as AppContext);

      expect(mockLogger.error).toHaveBeenCalledWith(
        "处理OTA请求失败:",
        hostError
      );
      expect(mockContext.fail).toHaveBeenCalled();
    });
  });

  describe("handleOTA - 集成场景测试", () => {
    const deviceId = "AA:BB:CC:DD:EE:FF";
    const clientId = "test-client-uuid";
    const host = "localhost:9999";

    beforeEach(() => {
      mockContext.req.header.mockImplementation((key: string) => {
        const headers: Record<string, string | undefined> = {
          "Device-Id": deviceId,
          "Client-Id": clientId,
          host: host,
        };
        return headers[key] || headers[key.toLowerCase()];
      });
    });

    it("应该正确处理完整的 OTA 流程", async () => {
      const response = await esp32Handler.handleOTA(
        mockContext as unknown as AppContext
      );

      // 验证日志记录
      expect(mockLogger.debug).toHaveBeenCalledWith(
        `收到OTA请求: deviceId=${deviceId}, clientId=${clientId}`
      );

      // 验证服务调用
      expect(mockESP32Service.handleOTARequest).toHaveBeenCalledTimes(1);

      // 验证响应格式
      expect(mockContext.json).toHaveBeenCalledWith(mockOTAResponse);

      // 验证响应日志
      expect(mockLogger.debug).toHaveBeenCalledWith("OTA响应", {
        response: mockOTAResponse,
      });
    });

    it("应该处理多次 OTA 请求", async () => {
      // 第一次请求
      await esp32Handler.handleOTA(mockContext as unknown as AppContext);

      // 第二次请求
      await esp32Handler.handleOTA(mockContext as unknown as AppContext);

      expect(mockESP32Service.handleOTARequest).toHaveBeenCalledTimes(2);
      expect(mockContext.json).toHaveBeenCalledTimes(2);
    });

    it("应该处理成功后的错误场景", async () => {
      // 第一次请求成功
      await esp32Handler.handleOTA(mockContext as unknown as AppContext);

      // 第二次请求失败
      const serviceError = new Error("服务暂时不可用");
      mockESP32Service.handleOTARequest.mockRejectedValueOnce(serviceError);

      await esp32Handler.handleOTA(mockContext as unknown as AppContext);

      expect(mockESP32Service.handleOTARequest).toHaveBeenCalledTimes(2);
      expect(mockLogger.error).toHaveBeenCalledWith(
        "处理OTA请求失败:",
        serviceError
      );
    });
  });
});

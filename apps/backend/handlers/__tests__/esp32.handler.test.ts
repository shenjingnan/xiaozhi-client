import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ESP32Handler } from "../esp32.handler.js";
import type { ESP32Service } from "@/services/esp32.service.js";
import type { ESP32DeviceReport, ESP32OTAResponse } from "@/types/esp32.js";
import { ESP32ErrorCode } from "@/types/esp32.js";

// 模拟 Logger
vi.mock("../../Logger.js", () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
}));

describe("ESP32Handler", () => {
  let esp32Handler: ESP32Handler;
  let mockEsp32Service: ESP32Service;
  let mockLogger: any;
  let mockContext: any;

  // 模拟设备上报信息
  const mockDeviceReport: ESP32DeviceReport = {
    application: {
      version: "1.0.0",
      board: {
        type: "ESP32-S3-BOX",
      },
    },
    board: {
      type: "ESP32-S3-BOX",
      name: "ESP32-S3-BOX",
      mac: "AA:BB:CC:DD:EE:FF",
    },
  };

  // 模拟 OTA 响应
  const mockOTAResponse: ESP32OTAResponse = {
    websocket: {
      url: "ws://192.168.1.100:9999/ws",
      token: "",
      version: 2,
    },
    serverTime: {
      timestamp: 1699876543210,
      timezoneOffset: 28800000,
    },
    firmware: {
      version: "2.2.2",
      url: "",
      force: false,
    },
  };

  beforeEach(async () => {
    vi.clearAllMocks();

    // 模拟 Logger
    mockLogger = {
      debug: vi.fn(),
      info: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
    };
    const { logger } = await import("../../Logger.js");
    Object.assign(logger, mockLogger);

    // 模拟 ESP32Service
    mockEsp32Service = {
      handleOTARequest: vi.fn().mockResolvedValue(mockOTAResponse),
    } as unknown as ESP32Service;

    // 创建处理器实例
    esp32Handler = new ESP32Handler(mockEsp32Service);

    // 模拟 Hono 上下文
    mockContext = {
      get: vi.fn((key: string) => {
        if (key === "logger") return mockLogger;
        return undefined;
      }),
      json: vi.fn().mockImplementation((data) => {
        return new Response(JSON.stringify(data), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
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
      req: {
        header: vi.fn(),
        json: vi.fn(),
      },
    };
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("constructor", () => {
    it("应该使用正确的依赖项初始化", () => {
      expect(esp32Handler).toBeInstanceOf(ESP32Handler);
    });
  });

  describe("handleOTA", () => {
    describe("正常 OTA 请求", () => {
      it("应该成功处理带有大写 Device-Id 和 Client-Id 请求头的请求", async () => {
        // Arrange
        const deviceId = "AA:BB:CC:DD:EE:FF";
        const clientId = "client-uuid-123";
        mockContext.req.header.mockImplementation((name: string) => {
          if (name === "Device-Id") return deviceId;
          if (name === "Client-Id") return clientId;
          if (name === "host") return "192.168.1.100:9999";
          return undefined;
        });
        mockContext.req.json.mockResolvedValue(mockDeviceReport);

        // Act
        const response = await esp32Handler.handleOTA(mockContext);

        // Assert
        expect(mockContext.req.json).toHaveBeenCalledTimes(1);
        expect(mockEsp32Service.handleOTARequest).toHaveBeenCalledWith(
          deviceId,
          clientId,
          mockDeviceReport,
          { deviceModel: undefined, deviceVersion: undefined },
          "192.168.1.100:9999"
        );
        expect(mockContext.json).toHaveBeenCalledWith(mockOTAResponse);
        expect(mockLogger.debug).toHaveBeenCalledWith(
          `收到OTA请求: deviceId=${deviceId}, clientId=${clientId}`
        );
      });

      it("应该成功处理带有小写 device-id 和 client-id 请求头的请求", async () => {
        // Arrange
        const deviceId = "AA:BB:CC:DD:EE:FF";
        const clientId = "client-uuid-123";
        mockContext.req.header.mockImplementation((name: string) => {
          if (name === "device-id") return deviceId;
          if (name === "client-id") return clientId;
          if (name === "host") return "192.168.1.100";
          return undefined;
        });
        mockContext.req.json.mockResolvedValue(mockDeviceReport);

        // Act
        const response = await esp32Handler.handleOTA(mockContext);

        // Assert
        expect(mockEsp32Service.handleOTARequest).toHaveBeenCalledWith(
          deviceId,
          clientId,
          mockDeviceReport,
          { deviceModel: undefined, deviceVersion: undefined },
          "192.168.1.100"
        );
      });

      it("应该传递设备型号和版本信息从请求头", async () => {
        // Arrange
        const deviceId = "AA:BB:CC:DD:EE:FF";
        const clientId = "client-uuid-123";
        const deviceModel = "ESP32-S3-BOX-Lite";
        const deviceVersion = "1.0.0";
        mockContext.req.header.mockImplementation((name: string) => {
          if (name === "Device-Id") return deviceId;
          if (name === "Client-Id") return clientId;
          if (name === "device-model") return deviceModel;
          if (name === "device-version") return deviceVersion;
          if (name === "host") return "192.168.1.100:9999";
          return undefined;
        });
        mockContext.req.json.mockResolvedValue(mockDeviceReport);

        // Act
        const response = await esp32Handler.handleOTA(mockContext);

        // Assert
        expect(mockEsp32Service.handleOTARequest).toHaveBeenCalledWith(
          deviceId,
          clientId,
          mockDeviceReport,
          { deviceModel, deviceVersion },
          "192.168.1.100:9999"
        );
      });

      it("应该支持大写 Device-Model 和 Device-Version 请求头", async () => {
        // Arrange
        const deviceId = "AA:BB:CC:DD:EE:FF";
        const clientId = "client-uuid-123";
        const deviceModel = "ESP32-S3-BOX-Lite";
        const deviceVersion = "1.0.0";
        mockContext.req.header.mockImplementation((name: string) => {
          if (name === "Device-Id") return deviceId;
          if (name === "Client-Id") return clientId;
          if (name === "Device-Model") return deviceModel;
          if (name === "Device-Version") return deviceVersion;
          if (name === "host") return "192.168.1.100:9999";
          return undefined;
        });
        mockContext.req.json.mockResolvedValue(mockDeviceReport);

        // Act
        const response = await esp32Handler.handleOTA(mockContext);

        // Assert
        expect(mockEsp32Service.handleOTARequest).toHaveBeenCalledWith(
          deviceId,
          clientId,
          mockDeviceReport,
          { deviceModel, deviceVersion },
          "192.168.1.100:9999"
        );
      });
    });

    describe("请求头缺失", () => {
      it("应该返回 400 错误当缺少 Device-Id 请求头时", async () => {
        // Arrange
        const clientId = "client-uuid-123";
        mockContext.req.header.mockImplementation((name: string) => {
          if (name === "Device-Id") return undefined;
          if (name === "device-id") return undefined;
          if (name === "Client-Id") return clientId;
          return undefined;
        });
        mockContext.req.json.mockResolvedValue(mockDeviceReport);

        // Act
        const response = await esp32Handler.handleOTA(mockContext);

        // Assert
        expect(mockContext.fail).toHaveBeenCalledWith(
          ESP32ErrorCode.MISSING_DEVICE_ID,
          "缺少 Device-Id 请求头",
          undefined,
          400
        );
        expect(mockEsp32Service.handleOTARequest).not.toHaveBeenCalled();
      });

      it("应该返回 400 错误当缺少 Client-Id 请求头时", async () => {
        // Arrange
        const deviceId = "AA:BB:CC:DD:EE:FF";
        mockContext.req.header.mockImplementation((name: string) => {
          if (name === "Device-Id") return deviceId;
          if (name === "Client-Id") return undefined;
          if (name === "client-id") return undefined;
          return undefined;
        });
        mockContext.req.json.mockResolvedValue(mockDeviceReport);

        // Act
        const response = await esp32Handler.handleOTA(mockContext);

        // Assert
        expect(mockContext.fail).toHaveBeenCalledWith(
          ESP32ErrorCode.MISSING_DEVICE_ID,
          "缺少 Client-Id 请求头",
          undefined,
          400
        );
        expect(mockEsp32Service.handleOTARequest).not.toHaveBeenCalled();
      });

      it("应该返回 400 错误当同时缺少 Device-Id 和 Client-Id 请求头时", async () => {
        // Arrange
        mockContext.req.header.mockReturnValue(undefined);
        mockContext.req.json.mockResolvedValue(mockDeviceReport);

        // Act
        const response = await esp32Handler.handleOTA(mockContext);

        // Assert
        expect(mockContext.fail).toHaveBeenCalledWith(
          ESP32ErrorCode.MISSING_DEVICE_ID,
          "缺少 Device-Id 请求头",
          undefined,
          400
        );
        expect(mockEsp32Service.handleOTARequest).not.toHaveBeenCalled();
      });

      it("应该返回 400 错误当 Device-Id 为空字符串时", async () => {
        // Arrange
        const clientId = "client-uuid-123";
        mockContext.req.header.mockImplementation((name: string) => {
          if (name === "Device-Id") return "";
          if (name === "device-id") return undefined;
          if (name === "Client-Id") return clientId;
          return undefined;
        });
        mockContext.req.json.mockResolvedValue(mockDeviceReport);

        // Act
        const response = await esp32Handler.handleOTA(mockContext);

        // Assert
        expect(mockContext.fail).toHaveBeenCalledWith(
          ESP32ErrorCode.MISSING_DEVICE_ID,
          "缺少 Device-Id 请求头",
          undefined,
          400
        );
      });
    });

    describe("请求体格式错误", () => {
      it("应该处理无效的 JSON 格式", async () => {
        // Arrange
        const deviceId = "AA:BB:CC:DD:EE:FF";
        const clientId = "client-uuid-123";
        mockContext.req.header.mockImplementation((name: string) => {
          if (name === "Device-Id") return deviceId;
          if (name === "Client-Id") return clientId;
          return undefined;
        });
        const jsonError = new Error("Unexpected token");
        mockContext.req.json.mockRejectedValue(jsonError);

        // Act
        const response = await esp32Handler.handleOTA(mockContext);

        // Assert
        expect(mockLogger.error).toHaveBeenCalledWith("处理OTA请求失败:", expect.any(Error));
        expect(mockContext.fail).toHaveBeenCalled();
        expect(mockEsp32Service.handleOTARequest).not.toHaveBeenCalled();
      });

      it("应该处理缺少必需字段的请求体", async () => {
        // Arrange
        const deviceId = "AA:BB:CC:DD:EE:FF";
        const clientId = "client-uuid-123";
        mockContext.req.header.mockImplementation((name: string) => {
          if (name === "Device-Id") return deviceId;
          if (name === "Client-Id") return clientId;
          return undefined;
        });
        const incompleteReport = {};
        mockContext.req.json.mockResolvedValue(incompleteReport);

        // Act
        const response = await esp32Handler.handleOTA(mockContext);

        // Assert
        // handler 应该成功解析 JSON，即使不完整
        // 实际验证由服务层处理
        expect(mockContext.req.json).toHaveBeenCalled();
      });
    });

    describe("可选请求头处理", () => {
      it("应该正确处理带端口号的 Host 请求头", async () => {
        // Arrange
        const deviceId = "AA:BB:CC:DD:EE:FF";
        const clientId = "client-uuid-123";
        const host = "192.168.1.100:9999";
        mockContext.req.header.mockImplementation((name: string) => {
          if (name === "Device-Id") return deviceId;
          if (name === "Client-Id") return clientId;
          if (name === "host") return host;
          return undefined;
        });
        mockContext.req.json.mockResolvedValue(mockDeviceReport);

        // Act
        const response = await esp32Handler.handleOTA(mockContext);

        // Assert
        expect(mockEsp32Service.handleOTARequest).toHaveBeenCalledWith(
          deviceId,
          clientId,
          mockDeviceReport,
          { deviceModel: undefined, deviceVersion: undefined },
          host
        );
      });

      it("应该正确处理不带端口号的 Host 请求头", async () => {
        // Arrange
        const deviceId = "AA:BB:CC:DD:EE:FF";
        const clientId = "client-uuid-123";
        const host = "192.168.1.100";
        mockContext.req.header.mockImplementation((name: string) => {
          if (name === "Device-Id") return deviceId;
          if (name === "Client-Id") return clientId;
          if (name === "host") return host;
          return undefined;
        });
        mockContext.req.json.mockResolvedValue(mockDeviceReport);

        // Act
        const response = await esp32Handler.handleOTA(mockContext);

        // Assert
        expect(mockEsp32Service.handleOTARequest).toHaveBeenCalledWith(
          deviceId,
          clientId,
          mockDeviceReport,
          { deviceModel: undefined, deviceVersion: undefined },
          host
        );
      });

      it("应该处理缺失的 Host 请求头（服务层会抛出错误）", async () => {
        // Arrange
        const deviceId = "AA:BB:CC:DD:EE:FF";
        const clientId = "client-uuid-123";
        mockContext.req.header.mockImplementation((name: string) => {
          if (name === "Device-Id") return deviceId;
          if (name === "Client-Id") return clientId;
          if (name === "host") return undefined;
          return undefined;
        });
        mockContext.req.json.mockResolvedValue(mockDeviceReport);

        // 服务层会抛出错误
        const hostError = new Error("无法获取服务器地址：缺少 Host 头");
        (mockEsp32Service.handleOTARequest as ReturnType<typeof vi.fn>).mockRejectedValue(
          hostError
        );

        // Act
        const response = await esp32Handler.handleOTA(mockContext);

        // Assert
        expect(mockLogger.error).toHaveBeenCalledWith("处理OTA请求失败:", hostError);
        expect(mockContext.fail).toHaveBeenCalled();
      });

      it("应该正确处理 device-model 请求头（小写）", async () => {
        // Arrange
        const deviceId = "AA:BB:CC:DD:EE:FF";
        const clientId = "client-uuid-123";
        const deviceModel = "ESP32-S3-BOX-Lite";
        mockContext.req.header.mockImplementation((name: string) => {
          if (name === "Device-Id") return deviceId;
          if (name === "Client-Id") return clientId;
          if (name === "device-model") return deviceModel;
          if (name === "host") return "192.168.1.100:9999";
          return undefined;
        });
        mockContext.req.json.mockResolvedValue(mockDeviceReport);

        // Act
        const response = await esp32Handler.handleOTA(mockContext);

        // Assert
        expect(mockEsp32Service.handleOTARequest).toHaveBeenCalledWith(
          deviceId,
          clientId,
          mockDeviceReport,
          { deviceModel, deviceVersion: undefined },
          "192.168.1.100:9999"
        );
      });

      it("应该正确处理 device-version 请求头（小写）", async () => {
        // Arrange
        const deviceId = "AA:BB:CC:DD:EE:FF";
        const clientId = "client-uuid-123";
        const deviceVersion = "1.0.0";
        mockContext.req.header.mockImplementation((name: string) => {
          if (name === "Device-Id") return deviceId;
          if (name === "Client-Id") return clientId;
          if (name === "device-version") return deviceVersion;
          if (name === "host") return "192.168.1.100:9999";
          return undefined;
        });
        mockContext.req.json.mockResolvedValue(mockDeviceReport);

        // Act
        const response = await esp32Handler.handleOTA(mockContext);

        // Assert
        expect(mockEsp32Service.handleOTARequest).toHaveBeenCalledWith(
          deviceId,
          clientId,
          mockDeviceReport,
          { deviceModel: undefined, deviceVersion },
          "192.168.1.100:9999"
        );
      });
    });

    describe("错误处理", () => {
      it("应该正确处理服务层抛出的错误", async () => {
        // Arrange
        const deviceId = "AA:BB:CC:DD:EE:FF";
        const clientId = "client-uuid-123";
        mockContext.req.header.mockImplementation((name: string) => {
          if (name === "Device-Id") return deviceId;
          if (name === "Client-Id") return clientId;
          if (name === "host") return "192.168.1.100:9999";
          return undefined;
        });
        mockContext.req.json.mockResolvedValue(mockDeviceReport);

        const serviceError = new Error("服务处理失败");
        (mockEsp32Service.handleOTARequest as ReturnType<typeof vi.fn>).mockRejectedValue(
          serviceError
        );

        // Act
        const response = await esp32Handler.handleOTA(mockContext);

        // Assert
        expect(mockLogger.error).toHaveBeenCalledWith("处理OTA请求失败:", serviceError);
        expect(mockContext.fail).toHaveBeenCalledWith(
          "OPERATION_FAILED",
          "服务处理失败",
          undefined,
          500
        );
      });

      it("应该正确处理非 Error 类型的异常", async () => {
        // Arrange
        const deviceId = "AA:BB:CC:DD:EE:FF";
        const clientId = "client-uuid-123";
        mockContext.req.header.mockImplementation((name: string) => {
          if (name === "Device-Id") return deviceId;
          if (name === "Client-Id") return clientId;
          if (name === "host") return "192.168.1.100:9999";
          return undefined;
        });
        mockContext.req.json.mockResolvedValue(mockDeviceReport);

        (mockEsp32Service.handleOTARequest as ReturnType<typeof vi.fn>).mockRejectedValue(
          "字符串错误"
        );

        // Act
        const response = await esp32Handler.handleOTA(mockContext);

        // Assert
        expect(mockLogger.error).toHaveBeenCalledWith("处理OTA请求失败:", "字符串错误");
        expect(mockContext.fail).toHaveBeenCalledWith(
          "OPERATION_FAILED",
          "字符串错误",
          undefined,
          500
        );
      });

      it("应该记录 OTA 响应日志", async () => {
        // Arrange
        const deviceId = "AA:BB:CC:DD:EE:FF";
        const clientId = "client-uuid-123";
        mockContext.req.header.mockImplementation((name: string) => {
          if (name === "Device-Id") return deviceId;
          if (name === "Client-Id") return clientId;
          if (name === "host") return "192.168.1.100:9999";
          return undefined;
        });
        mockContext.req.json.mockResolvedValue(mockDeviceReport);

        // Act
        const response = await esp32Handler.handleOTA(mockContext);

        // Assert
        expect(mockLogger.debug).toHaveBeenCalledWith("OTA响应", { response: mockOTAResponse });
      });
    });

    describe("集成场景", () => {
      it("应该完整处理一个成功的 OTA 请求流程", async () => {
        // Arrange
        const deviceId = "AA:BB:CC:DD:EE:FF";
        const clientId = "550e8400-e29b-41d4-a716-446655440000";
        mockContext.req.header.mockImplementation((name: string) => {
          if (name === "Device-Id") return deviceId;
          if (name === "Client-Id") return clientId;
          if (name === "host") return "xiaozhi.local:9999";
          return undefined;
        });
        mockContext.req.json.mockResolvedValue(mockDeviceReport);

        const expectedResponse: ESP32OTAResponse = {
          websocket: {
            url: "ws://xiaozhi.local:9999/ws",
            token: "",
            version: 2,
          },
          serverTime: {
            timestamp: 1699876543210,
            timezoneOffset: 28800000,
          },
          firmware: {
            version: "2.2.2",
            url: "",
            force: false,
          },
        };
        (mockEsp32Service.handleOTARequest as ReturnType<typeof vi.fn>).mockResolvedValue(
          expectedResponse
        );

        // Act
        const response = await esp32Handler.handleOTA(mockContext);

        // Assert
        expect(mockEsp32Service.handleOTARequest).toHaveBeenCalledTimes(1);
        expect(mockContext.json).toHaveBeenCalledWith(expectedResponse);
        expect(mockLogger.debug).toHaveBeenCalledWith(
          `收到OTA请求: deviceId=${deviceId}, clientId=${clientId}`
        );
        expect(mockLogger.debug).toHaveBeenCalledWith("OTA响应", { response: expectedResponse });
      });
    });
  });
});

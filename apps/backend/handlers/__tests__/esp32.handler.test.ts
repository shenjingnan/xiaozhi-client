import type { ESP32Service } from "@/services/esp32.service.js";
import { ESP32ErrorCode } from "@/types/esp32.js";
import type { ESP32DeviceReport, ESP32OTAResponse } from "@/types/esp32.js";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ESP32Handler } from "../esp32.handler.js";

// 模拟 Logger
vi.mock("../../Logger.js", () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
}));

// Mock ESP32Service
const mockESP32Service = {
  handleOTARequest: vi.fn(),
} as unknown as ESP32Service;

describe("ESP32Handler", () => {
  let handler: ESP32Handler;
  let mockContext: any;

  const mockOTAReport: ESP32DeviceReport = {
    application: {
      version: "1.0.0",
      board: {
        type: "ESP32-S3-BOX",
      },
    },
  };

  const mockOTAResponse: ESP32OTAResponse = {
    websocket: {
      url: "ws://localhost:9999/ws",
      token: "",
      version: 2,
    },
    serverTime: {
      timestamp: 1710123456789,
      timezoneOffset: 28800000,
    },
    firmware: {
      version: "2.2.2",
      url: "",
      force: false,
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();

    handler = new ESP32Handler(mockESP32Service);

    // 创建 mock context
    mockContext = {
      get: vi.fn((key: string) => {
        if (key === "logger") {
          return {
            debug: vi.fn(),
            info: vi.fn(),
            error: vi.fn(),
            warn: vi.fn(),
          };
        }
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
          (code: string, message: string, _details?: unknown, status = 400) => {
            return new Response(
              JSON.stringify({
                success: false,
                error: { code, message },
              }),
              { status, headers: { "Content-Type": "application/json" } }
            );
          }
        ),
      req: {
        header: vi.fn(),
        json: vi.fn(),
      },
    };
  });

  describe("handleOTA", () => {
    it("应成功处理 OTA 请求并返回配置", async () => {
      // Arrange
      const deviceId = "AA:BB:CC:DD:EE:FF";
      const clientId = "client-uuid-123";
      const host = "192.168.1.100:8080";

      mockContext.req.header.mockImplementation((name: string) => {
        const headers: Record<string, string> = {
          "device-id": deviceId,
          "client-id": clientId,
          host,
        };
        return headers[name] || headers[name.toLowerCase()] || undefined;
      });
      mockContext.req.json.mockResolvedValue(mockOTAReport);

      vi.mocked(mockESP32Service.handleOTARequest).mockResolvedValue(
        mockOTAResponse
      );

      // Act
      const response = await handler.handleOTA(mockContext);

      // Assert
      expect(response.status).toBe(200);
      const responseData = await response.json();
      expect(responseData).toEqual(mockOTAResponse);
      expect(mockESP32Service.handleOTARequest).toHaveBeenCalledWith(
        deviceId,
        clientId,
        mockOTAReport,
        {
          deviceModel: undefined,
          deviceVersion: undefined,
        },
        host
      );
    });

    it("应支持大写 Device-Id 请求头", async () => {
      // Arrange
      const deviceId = "AA:BB:CC:DD:EE:FF";
      const clientId = "client-uuid-123";
      const host = "192.168.1.100:8080";

      mockContext.req.header.mockImplementation((name: string) => {
        const headers: Record<string, string> = {
          "Device-Id": deviceId,
          "Client-Id": clientId,
          host,
        };
        return headers[name];
      });
      mockContext.req.json.mockResolvedValue(mockOTAReport);

      vi.mocked(mockESP32Service.handleOTARequest).mockResolvedValue(
        mockOTAResponse
      );

      // Act
      const response = await handler.handleOTA(mockContext);

      // Assert
      expect(response.status).toBe(200);
      expect(mockESP32Service.handleOTARequest).toHaveBeenCalledWith(
        deviceId,
        clientId,
        mockOTAReport,
        {
          deviceModel: undefined,
          deviceVersion: undefined,
        },
        host
      );
    });

    it("应在缺少 Device-Id 请求头时返回 400 错误", async () => {
      // Arrange
      const clientId = "client-uuid-123";

      mockContext.req.header.mockImplementation((name: string) => {
        const headers: Record<string, string> = {
          "client-id": clientId,
        };
        return headers[name] || headers[name.toLowerCase()] || undefined;
      });

      // Act
      const response = await handler.handleOTA(mockContext);

      // Assert
      expect(response.status).toBe(400);
      const responseData = await response.json();
      expect(responseData.success).toBe(false);
      expect(responseData.error.code).toBe(ESP32ErrorCode.MISSING_DEVICE_ID);
      expect(responseData.error.message).toContain("Device-Id");
      expect(mockESP32Service.handleOTARequest).not.toHaveBeenCalled();
    });

    it("应在缺少 Client-Id 请求头时返回 400 错误", async () => {
      // Arrange
      const deviceId = "AA:BB:CC:DD:EE:FF";

      mockContext.req.header.mockImplementation((name: string) => {
        const headers: Record<string, string> = {
          "device-id": deviceId,
        };
        return headers[name] || headers[name.toLowerCase()] || undefined;
      });

      // Act
      const response = await handler.handleOTA(mockContext);

      // Assert
      expect(response.status).toBe(400);
      const responseData = await response.json();
      expect(responseData.success).toBe(false);
      expect(responseData.error.code).toBe(ESP32ErrorCode.MISSING_DEVICE_ID);
      expect(responseData.error.message).toContain("Client-Id");
      expect(mockESP32Service.handleOTARequest).not.toHaveBeenCalled();
    });

    it("应在请求体格式错误时返回 500 错误", async () => {
      // Arrange
      const deviceId = "AA:BB:CC:DD:EE:FF";
      const clientId = "client-uuid-123";
      const host = "192.168.1.100:8080";

      mockContext.req.header.mockImplementation((name: string) => {
        const headers: Record<string, string> = {
          "device-id": deviceId,
          "client-id": clientId,
          host,
        };
        return headers[name] || headers[name.toLowerCase()] || undefined;
      });
      mockContext.req.json.mockRejectedValue(new Error("Invalid JSON"));

      // Act
      const response = await handler.handleOTA(mockContext);

      // Assert
      expect(response.status).toBe(500);
      const responseData = await response.json();
      expect(responseData.success).toBe(false);
      expect(responseData.error.message).toContain("请求体格式错误");
      expect(mockESP32Service.handleOTARequest).not.toHaveBeenCalled();
    });

    it("应正确传递 device-model 和 device-version 请求头", async () => {
      // Arrange
      const deviceId = "AA:BB:CC:DD:EE:FF";
      const clientId = "client-uuid-123";
      const host = "192.168.1.100:8080";
      const deviceModel = "ESP32-S3-BOX";
      const deviceVersion = "1.0.0";

      mockContext.req.header.mockImplementation((name: string) => {
        const headers: Record<string, string> = {
          "device-id": deviceId,
          "client-id": clientId,
          host,
          "device-model": deviceModel,
          "device-version": deviceVersion,
        };
        return headers[name] || headers[name.toLowerCase()] || undefined;
      });
      mockContext.req.json.mockResolvedValue(mockOTAReport);

      vi.mocked(mockESP32Service.handleOTARequest).mockResolvedValue(
        mockOTAResponse
      );

      // Act
      const response = await handler.handleOTA(mockContext);

      // Assert
      expect(response.status).toBe(200);
      expect(mockESP32Service.handleOTARequest).toHaveBeenCalledWith(
        deviceId,
        clientId,
        mockOTAReport,
        {
          deviceModel,
          deviceVersion,
        },
        host
      );
    });

    it("应支持大写 Device-Model 和 Device-Version 请求头", async () => {
      // Arrange
      const deviceId = "AA:BB:CC:DD:EE:FF";
      const clientId = "client-uuid-123";
      const host = "192.168.1.100:8080";
      const deviceModel = "ESP32-S3-BOX";
      const deviceVersion = "1.0.0";

      mockContext.req.header.mockImplementation((name: string) => {
        const headers: Record<string, string> = {
          "Device-Id": deviceId,
          "Client-Id": clientId,
          host,
          "Device-Model": deviceModel,
          "Device-Version": deviceVersion,
        };
        return headers[name];
      });
      mockContext.req.json.mockResolvedValue(mockOTAReport);

      vi.mocked(mockESP32Service.handleOTARequest).mockResolvedValue(
        mockOTAResponse
      );

      // Act
      const response = await handler.handleOTA(mockContext);

      // Assert
      expect(response.status).toBe(200);
      expect(mockESP32Service.handleOTARequest).toHaveBeenCalledWith(
        deviceId,
        clientId,
        mockOTAReport,
        {
          deviceModel,
          deviceVersion,
        },
        host
      );
    });

    it("应在服务层抛出错误时正确处理", async () => {
      // Arrange
      const deviceId = "AA:BB:CC:DD:EE:FF";
      const clientId = "client-uuid-123";
      const host = "192.168.1.100:8080";

      mockContext.req.header.mockImplementation((name: string) => {
        const headers: Record<string, string> = {
          "device-id": deviceId,
          "client-id": clientId,
          host,
        };
        return headers[name] || headers[name.toLowerCase()] || undefined;
      });
      mockContext.req.json.mockResolvedValue(mockOTAReport);

      const serviceError = new Error("服务处理失败");
      vi.mocked(mockESP32Service.handleOTARequest).mockRejectedValue(
        serviceError
      );

      // Act
      const response = await handler.handleOTA(mockContext);

      // Assert
      expect(response.status).toBe(500);
      const responseData = await response.json();
      expect(responseData.success).toBe(false);
      expect(responseData.error.message).toContain("服务处理失败");
    });

    it("应在缺少 Host 请求头时处理服务层错误", async () => {
      // Arrange
      const deviceId = "AA:BB:CC:DD:EE:FF";
      const clientId = "client-uuid-123";

      mockContext.req.header.mockImplementation((name: string) => {
        const headers: Record<string, string> = {
          "device-id": deviceId,
          "client-id": clientId,
        };
        return headers[name] || headers[name.toLowerCase()] || undefined;
      });
      mockContext.req.json.mockResolvedValue(mockOTAReport);

      const serviceError = new Error("无法获取服务器地址：缺少 Host 头");
      vi.mocked(mockESP32Service.handleOTARequest).mockRejectedValue(
        serviceError
      );

      // Act
      const response = await handler.handleOTA(mockContext);

      // Assert
      expect(response.status).toBe(500);
      const responseData = await response.json();
      expect(responseData.success).toBe(false);
      expect(responseData.error.message).toContain("无法获取服务器地址");
    });

    it("应正确处理空字符串请求头", async () => {
      // Arrange
      mockContext.req.header.mockImplementation(() => undefined);

      // Act
      const response = await handler.handleOTA(mockContext);

      // Assert
      expect(response.status).toBe(400);
      const responseData = await response.json();
      expect(responseData.error.code).toBe(ESP32ErrorCode.MISSING_DEVICE_ID);
    });

    it("应优先使用大写请求头（回退机制）", async () => {
      // Arrange
      const deviceId = "AA:BB:CC:DD:EE:FF";
      const clientId = "client-uuid-123";
      const host = "192.168.1.100:8080";

      // 先返回小写 undefined，再返回大写值（模拟回退）
      let callCount = 0;
      mockContext.req.header.mockImplementation((name: string) => {
        callCount++;
        if (name === "Device-Id" && callCount === 1) {
          return undefined;
        }
        if (name === "device-id" && callCount === 2) {
          return deviceId;
        }
        if (name === "Client-Id" && callCount === 3) {
          return undefined;
        }
        if (name === "client-id" && callCount === 4) {
          return clientId;
        }
        if (name === "host") {
          return host;
        }
        return undefined;
      });
      mockContext.req.json.mockResolvedValue(mockOTAReport);

      vi.mocked(mockESP32Service.handleOTARequest).mockResolvedValue(
        mockOTAResponse
      );

      // Act
      const response = await handler.handleOTA(mockContext);

      // Assert
      expect(response.status).toBe(200);
      expect(mockESP32Service.handleOTARequest).toHaveBeenCalledWith(
        deviceId,
        clientId,
        mockOTAReport,
        expect.any(Object),
        host
      );
    });
  });
});

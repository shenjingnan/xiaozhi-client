/**
 * ESP32Handler 单元测试
 * 测试 ESP32 设备 OTA 处理器的请求处理逻辑
 */

import { ESP32ErrorCode } from "@/types/esp32.js";
import type { ESP32DeviceReport, ESP32OTAResponse } from "@/types/esp32.js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ESP32Handler } from "../esp32.handler.js";

// 模拟依赖项
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
  let mockESP32Service: {
    handleOTARequest: ReturnType<typeof vi.fn>;
  };
  let mockLogger: {
    debug: ReturnType<typeof vi.fn>;
    info: ReturnType<typeof vi.fn>;
    error: ReturnType<typeof vi.fn>;
    warn: ReturnType<typeof vi.fn>;
  };
  let mockContext: {
    get: ReturnType<typeof vi.fn>;
    fail: ReturnType<typeof vi.fn>;
    json: ReturnType<typeof vi.fn>;
    req: {
      header: ReturnType<typeof vi.fn>;
      json: ReturnType<typeof vi.fn>;
    };
  };

  const mockDeviceReport: ESP32DeviceReport = {
    application: {
      version: "1.0.0",
      board: {
        type: "ESP32-S3-BOX",
      },
    },
  };

  const mockOTAResponse: ESP32OTAResponse = {
    websocket: {
      url: "ws://192.168.1.100:9999/ws",
      token: "",
      version: 2,
    },
    serverTime: {
      timestamp: 1700000000000,
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

    // 模拟 ESP32Service
    mockESP32Service = {
      handleOTARequest: vi.fn().mockResolvedValue(mockOTAResponse),
    };

    // 模拟 Hono 上下文
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
      mockESP32Service as unknown as import(
        "@/services/esp32.service.js"
      ).ESP32Service
    );
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
    it("应该拒绝缺少 Device-Id 的请求", async () => {
      // 设置请求头：无 Device-Id
      mockContext.req.header.mockImplementation((key: string) => {
        if (key === "Client-Id" || key === "client-id") return "test-client-id";
        return undefined;
      });

      const response = await esp32Handler.handleOTA(
        mockContext as unknown as import("hono").Context<
          import("@/types/hono.context.js").AppContext
        >
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
      // 设置请求头：有 Device-Id，无 Client-Id
      mockContext.req.header.mockImplementation((key: string) => {
        if (key === "Device-Id" || key === "device-id")
          return "AA:BB:CC:DD:EE:FF";
        return undefined;
      });

      const response = await esp32Handler.handleOTA(
        mockContext as unknown as import("hono").Context<
          import("@/types/hono.context.js").AppContext
        >
      );

      expect(mockContext.fail).toHaveBeenCalledWith(
        ESP32ErrorCode.MISSING_DEVICE_ID,
        "缺少 Client-Id 请求头",
        undefined,
        400
      );
      expect(mockESP32Service.handleOTARequest).not.toHaveBeenCalled();
    });

    it("应该成功处理完整的 OTA 请求", async () => {
      // 设置请求头
      mockContext.req.header.mockImplementation((key: string) => {
        if (key === "Device-Id" || key === "device-id")
          return "AA:BB:CC:DD:EE:FF";
        if (key === "Client-Id" || key === "client-id") return "test-client-id";
        if (key === "host") return "192.168.1.100:9999";
        return undefined;
      });

      await esp32Handler.handleOTA(
        mockContext as unknown as import("hono").Context<
          import("@/types/hono.context.js").AppContext
        >
      );

      expect(mockESP32Service.handleOTARequest).toHaveBeenCalledWith(
        "AA:BB:CC:DD:EE:FF",
        "test-client-id",
        mockDeviceReport,
        { deviceModel: undefined, deviceVersion: undefined },
        "192.168.1.100:9999"
      );
      expect(mockContext.json).toHaveBeenCalledWith(mockOTAResponse);
      expect(mockLogger.debug).toHaveBeenCalledWith(
        "收到OTA请求: deviceId=AA:BB:CC:DD:EE:FF, clientId=test-client-id"
      );
    });

    it("应该正确处理请求头中的设备信息", async () => {
      // 设置请求头（包含设备型号和版本）
      mockContext.req.header.mockImplementation((key: string) => {
        if (key === "Device-Id" || key === "device-id")
          return "AA:BB:CC:DD:EE:FF";
        if (key === "Client-Id" || key === "client-id") return "test-client-id";
        if (key === "device-model" || key === "Device-Model")
          return "ESP32-S3-BOX-3";
        if (key === "device-version" || key === "Device-Version")
          return "2.0.0";
        if (key === "host") return "192.168.1.100:9999";
        return undefined;
      });

      await esp32Handler.handleOTA(
        mockContext as unknown as import("hono").Context<
          import("@/types/hono.context.js").AppContext
        >
      );

      expect(mockESP32Service.handleOTARequest).toHaveBeenCalledWith(
        "AA:BB:CC:DD:EE:FF",
        "test-client-id",
        mockDeviceReport,
        { deviceModel: "ESP32-S3-BOX-3", deviceVersion: "2.0.0" },
        "192.168.1.100:9999"
      );
    });

    it("应该支持大小写不敏感的请求头", async () => {
      // 使用小写请求头
      mockContext.req.header.mockImplementation((key: string) => {
        // 处理小写请求头
        if (key === "device-id") return "AA:BB:CC:DD:EE:FF";
        if (key === "client-id") return "test-client-id";
        if (key === "host") return "192.168.1.100:9999";
        return undefined;
      });

      await esp32Handler.handleOTA(
        mockContext as unknown as import("hono").Context<
          import("@/types/hono.context.js").AppContext
        >
      );

      expect(mockESP32Service.handleOTARequest).toHaveBeenCalledWith(
        "AA:BB:CC:DD:EE:FF",
        "test-client-id",
        mockDeviceReport,
        { deviceModel: undefined, deviceVersion: undefined },
        "192.168.1.100:9999"
      );
    });

    it("应该处理 JSON 解析错误", async () => {
      // 设置请求头
      mockContext.req.header.mockImplementation((key: string) => {
        if (key === "Device-Id" || key === "device-id")
          return "AA:BB:CC:DD:EE:FF";
        if (key === "Client-Id" || key === "client-id") return "test-client-id";
        if (key === "host") return "192.168.1.100:9999";
        return undefined;
      });

      // 模拟 JSON 解析错误
      const jsonError = new Error("Unexpected token } in JSON");
      mockContext.req.json.mockRejectedValue(jsonError);

      await esp32Handler.handleOTA(
        mockContext as unknown as import("hono").Context<
          import("@/types/hono.context.js").AppContext
        >
      );

      expect(mockLogger.error).toHaveBeenCalledWith(
        "处理OTA请求失败:",
        expect.any(Error)
      );
      expect(mockContext.fail).toHaveBeenCalled();
    });

    it("应该处理服务层错误", async () => {
      // 设置请求头
      mockContext.req.header.mockImplementation((key: string) => {
        if (key === "Device-Id" || key === "device-id")
          return "AA:BB:CC:DD:EE:FF";
        if (key === "Client-Id" || key === "client-id") return "test-client-id";
        if (key === "host") return "192.168.1.100:9999";
        return undefined;
      });

      // 模拟服务层错误
      const serviceError = new Error("无法获取服务器地址：缺少 Host 头");
      serviceError.cause = "MISSING_HOST_HEADER";
      mockESP32Service.handleOTARequest.mockRejectedValue(serviceError);

      await esp32Handler.handleOTA(
        mockContext as unknown as import("hono").Context<
          import("@/types/hono.context.js").AppContext
        >
      );

      expect(mockLogger.error).toHaveBeenCalledWith(
        "处理OTA请求失败:",
        serviceError
      );
      expect(mockContext.fail).toHaveBeenCalled();
    });

    it("应该处理非 Error 类型的异常", async () => {
      // 设置请求头
      mockContext.req.header.mockImplementation((key: string) => {
        if (key === "Device-Id" || key === "device-id")
          return "AA:BB:CC:DD:EE:FF";
        if (key === "Client-Id" || key === "client-id") return "test-client-id";
        if (key === "host") return "192.168.1.100:9999";
        return undefined;
      });

      // 模拟非 Error 类型异常
      mockESP32Service.handleOTARequest.mockRejectedValue("字符串错误");

      await esp32Handler.handleOTA(
        mockContext as unknown as import("hono").Context<
          import("@/types/hono.context.js").AppContext
        >
      );

      expect(mockLogger.error).toHaveBeenCalledWith(
        "处理OTA请求失败:",
        "字符串错误"
      );
      expect(mockContext.fail).toHaveBeenCalled();
    });
  });
});

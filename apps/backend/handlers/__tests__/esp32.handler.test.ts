import { beforeEach, describe, expect, it, vi } from "vitest";
import { ESP32Handler } from "../esp32.handler.js";
import { ESP32ErrorCode } from "@/types/esp32.js";

// 模拟依赖
vi.mock("@/Logger.js", () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
}));

vi.mock("@/services/esp32.service.js", () => ({
  esp32Service: {
    handleOTARequest: vi.fn(),
  },
}));

describe("ESP32Handler", () => {
  let handler: ESP32Handler;
  let mockEsp32Service: any;
  let mockContext: any;

  const createMockContext = (overrides: any = {}) => {
    const logger = {
      debug: vi.fn(),
      info: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
    };

    return {
      get: vi.fn((key: string) => {
        if (key === "logger") return logger;
        return undefined;
      }),
      req: {
        header: vi.fn((name: string) => {
          const headers = overrides.headers || {};
          return headers[name];
        }),
        json: vi.fn().mockImplementation(async () => {
          return overrides.body || {};
        }),
      },
      json: vi.fn().mockImplementation((data, status = 200) => {
        return new Response(JSON.stringify(data), {
          status,
          headers: { "Content-Type": "application/json" },
        });
      }),
      success: vi.fn().mockImplementation((data, message, status = 200) => {
        const response = { success: true };
        if (data !== undefined) (response as any).data = data;
        if (message) (response as any).message = message;
        return new Response(JSON.stringify(response), {
          status,
          headers: { "Content-Type": "application/json" },
        });
      }),
      fail: vi
        .fn()
        .mockImplementation(
          (code: string, message: string, details?: unknown, status = 400) => {
            const response: any = {
              success: false,
              error: { code, message },
            };
            if (details !== undefined) response.error.details = details;
            return new Response(JSON.stringify(response), {
              status,
              headers: { "Content-Type": "application/json" },
            });
          }
        ),
      ...overrides,
    };
  };

  beforeEach(async () => {
    vi.clearAllMocks();

    mockEsp32Service = {
      handleOTARequest: vi.fn().mockResolvedValue({
        websocket: {
          url: "wss://example.com/ws",
          token: "test-token",
          version: 1,
        },
      }),
    };

    handler = new ESP32Handler(mockEsp32Service);
  });

  describe("handleOTA", () => {
    it("应成功处理OTA请求并返回配置", async () => {
      mockContext = createMockContext({
        headers: {
          "Device-Id": "AA:BB:CC:DD:EE:FF",
          "Client-Id": "test-client-id",
        },
        body: {
          application: {
            version: "1.0.0",
            board: { type: "ESP32-S3-BOX" },
          },
        },
      });

      const response = await handler.handleOTA(mockContext);

      expect(response).toBeDefined();
      expect(mockEsp32Service.handleOTARequest).toHaveBeenCalledWith(
        "AA:BB:CC:DD:EE:FF",
        "test-client-id",
        expect.any(Object),
        expect.any(Object),
        undefined
      );
    });

    it("应在缺少Device-Id请求头时返回400错误", async () => {
      mockContext = createMockContext({
        headers: {
          "Client-Id": "test-client-id",
        },
      });

      const response = await handler.handleOTA(mockContext);

      expect(mockContext.fail).toHaveBeenCalledWith(
        ESP32ErrorCode.MISSING_DEVICE_ID,
        "缺少 Device-Id 请求头",
        undefined,
        400
      );
    });

    it("应在缺少Client-Id请求头时返回400错误", async () => {
      mockContext = createMockContext({
        headers: {
          "Device-Id": "AA:BB:CC:DD:EE:FF",
        },
      });

      const response = await handler.handleOTA(mockContext);

      expect(mockContext.fail).toHaveBeenCalledWith(
        ESP32ErrorCode.MISSING_DEVICE_ID,
        "缺少 Client-Id 请求头",
        undefined,
        400
      );
    });

    it("应支持小写的请求头名称", async () => {
      mockContext = createMockContext({
        headers: {
          "device-id": "AA:BB:CC:DD:EE:FF",
          "client-id": "test-client-id",
        },
        body: {
          application: {
            version: "1.0.0",
          },
        },
      });

      const response = await handler.handleOTA(mockContext);

      expect(response).toBeDefined();
      expect(mockEsp32Service.handleOTARequest).toHaveBeenCalled();
    });

    it("应在服务层抛出错误时正确处理", async () => {
      mockEsp32Service.handleOTARequest.mockRejectedValueOnce(
        new Error("Service error")
      );

      mockContext = createMockContext({
        headers: {
          "Device-Id": "AA:BB:CC:DD:EE:FF",
          "Client-Id": "test-client-id",
        },
        body: {
          application: { version: "1.0.0" },
        },
      });

      const response = await handler.handleOTA(mockContext);

      expect(response).toBeDefined();
      expect(mockContext.get("logger").error).toHaveBeenCalled();
    });

    it("应正确传递可选的设备信息", async () => {
      mockContext = createMockContext({
        headers: {
          "Device-Id": "AA:BB:CC:DD:EE:FF",
          "Client-Id": "test-client-id",
          "device-model": "ESP32-S3",
          "device-version": "2.0.0",
          host: "example.com",
        },
        body: {
          application: { version: "1.0.0" },
        },
      });

      await handler.handleOTA(mockContext);

      expect(mockEsp32Service.handleOTARequest).toHaveBeenCalledWith(
        "AA:BB:CC:DD:EE:FF",
        "test-client-id",
        expect.any(Object),
        {
          deviceModel: "ESP32-S3",
          deviceVersion: "2.0.0",
        },
        "example.com"
      );
    });

    it("应在JSON解析失败时返回错误", async () => {
      mockContext = createMockContext({
        headers: {
          "Device-Id": "AA:BB:CC:DD:EE:FF",
          "Client-Id": "test-client-id",
        },
      });

      // Mock json() to throw
      mockContext.req.json.mockRejectedValueOnce(
        new SyntaxError("Unexpected token")
      );

      const response = await handler.handleOTA(mockContext);

      expect(response).toBeDefined();
      expect(mockContext.get("logger").error).toHaveBeenCalled();
    });
  });
});

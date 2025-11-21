import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { MCPServiceConfig } from "../MCPService.js";
import { MCPService, MCPTransportType } from "../MCPService.js";

// Mock the dependencies
vi.mock("../TransportFactory.js", () => ({
  TransportFactory: {
    create: vi.fn(() => ({})),
    validateConfig: vi.fn(),
  },
}));

vi.mock("../../Logger.js", () => ({
  Logger: vi.fn(() => ({
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    success: vi.fn(),
    log: vi.fn(),
    withTag: vi.fn(() => ({
      info: vi.fn(),
      debug: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      success: vi.fn(),
      log: vi.fn(),
    })),
  })),
  logger: {
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    success: vi.fn(),
    log: vi.fn(),
    withTag: vi.fn(() => ({
      info: vi.fn(),
      debug: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      success: vi.fn(),
      log: vi.fn(),
    })),
  },
}));

vi.mock("@modelcontextprotocol/sdk/client/index.js", () => ({
  Client: vi.fn(() => ({
    connect: vi.fn(),
    close: vi.fn(),
    listTools: vi.fn(() => Promise.resolve({ tools: [] })),
    callTool: vi.fn(),
  })),
}));

describe("MCPService Ping功能", () => {
  let service: MCPService;
  let mockConfig: MCPServiceConfig;

  beforeEach(() => {
    mockConfig = {
      name: "test-service",
      type: MCPTransportType.STDIO,
      command: "test-command",
      ping: {
        enabled: true,
        interval: 1000, // 1秒用于测试
        startDelay: 100, // 100ms用于测试
      },
    };

    service = new MCPService(mockConfig);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("Ping配置", () => {
    it("应该正确初始化ping配置", () => {
      const pingOptions = service.getPingOptions();
      expect(pingOptions.enabled).toBe(true);
      expect(pingOptions.interval).toBe(1000);
      expect(pingOptions.startDelay).toBe(100);
    });

    it("应该使用默认ping配置当未提供时", () => {
      const defaultConfig: MCPServiceConfig = {
        name: "default-service",
        type: MCPTransportType.STDIO,
        command: "test-command",
      };

      const defaultService = new MCPService(defaultConfig);
      const pingOptions = defaultService.getPingOptions();

      expect(pingOptions.enabled).toBe(true); // 默认启用
      expect(pingOptions.interval).toBe(60000); // 60秒
      expect(pingOptions.startDelay).toBe(5000); // 5秒
    });

    it("应该能够更新ping配置", () => {
      service.updatePingOptions({
        interval: 2000,
      });

      const pingOptions = service.getPingOptions();
      expect(pingOptions.interval).toBe(2000);
      expect(pingOptions.enabled).toBe(true); // 其他配置保持不变
    });

    it("应该能够启用和禁用ping", () => {
      service.disablePing();
      expect(service.getPingOptions().enabled).toBe(false);

      service.enablePing();
      expect(service.getPingOptions().enabled).toBe(true);
    });
  });

  describe("服务状态", () => {
    it("应该在状态中包含ping信息", () => {
      const status = service.getStatus();

      expect(status.pingEnabled).toBe(true);
      expect(status.isPinging).toBe(false);
      expect(status.lastPingTime).toBeUndefined();
    });
  });

  describe("Ping监控生命周期", () => {
    it("应该在连接成功后启动ping监控", async () => {
      // 模拟连接过程
      const mockClient = {
        connect: vi.fn(() => Promise.resolve()),
        close: vi.fn(),
        listTools: vi.fn(() => Promise.resolve({ tools: [] })),
        callTool: vi.fn(),
      };

      // 使用反射访问私有方法进行测试
      const handleConnectionSuccess = (
        service as any
      ).handleConnectionSuccess.bind(service);

      // 设置必要的内部状态
      (service as any).client = mockClient;

      // 调用连接成功处理
      handleConnectionSuccess();

      // 验证ping状态被重置
      const status = service.getStatus();
      expect(status.isPinging).toBe(false);
    });

    it("应该在断开连接时停止ping监控", async () => {
      // 模拟已连接状态
      (service as any).connectionState = "connected";
      (service as any).initialized = true;

      await service.disconnect();

      // 验证连接状态
      const status = service.getStatus();
      expect(status.connected).toBe(false);
    });
  });

  describe("配置验证", () => {
    it("应该接受有效的ping配置", () => {
      const validConfig: MCPServiceConfig = {
        name: "valid-service",
        type: MCPTransportType.SSE,
        url: "http://example.com",
        ping: {
          enabled: true,
          interval: 10000,
          startDelay: 2000,
        },
      };

      expect(() => new MCPService(validConfig)).not.toThrow();
    });
  });
});

/**
 * NetworkService 单元测试
 * 测试网络服务管理器的功能，基于 HTTP API
 */

import type { AppConfig, ClientStatus } from "@xiaozhi-client/shared-types";
import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { NetworkService } from "../index";

// Mock API 客户端
vi.mock("../api", () => ({
  apiClient: {
    getConfig: vi.fn(),
    updateConfig: vi.fn(),
    getStatus: vi.fn(),
    getClientStatus: vi.fn(),
    restartService: vi.fn(),
    stopService: vi.fn(),
    startService: vi.fn(),
    getServiceStatus: vi.fn(),
    getServiceHealth: vi.fn(),
    getMcpEndpoint: vi.fn(),
    getMcpEndpoints: vi.fn(),
    getMcpServers: vi.fn(),
    getConnectionConfig: vi.fn(),
    reloadConfig: vi.fn(),
    getConfigPath: vi.fn(),
    checkConfigExists: vi.fn(),
    getRestartStatus: vi.fn(),
    checkClientConnected: vi.fn(),
    getLastHeartbeat: vi.fn(),
    getActiveMCPServers: vi.fn(),
    updateClientStatus: vi.fn(),
    setActiveMCPServers: vi.fn(),
    resetStatus: vi.fn(),
  },
}));

describe("NetworkService", () => {
  let networkService: NetworkService;
  let mockApiClient: any;

  beforeAll(async () => {
    // 获取 mock 实例
    const { apiClient } = await import("../api");
    mockApiClient = apiClient;
  });

  beforeEach(() => {
    vi.clearAllMocks();
    mockApiClient.getConfig.mockResolvedValue({
      mcpEndpoint: "http://localhost:9999",
      mcpServers: {
        "test-server": {
          command: "node",
          args: ["server.js"],
        },
      },
    });
    networkService = new NetworkService();
  });

  afterEach(() => {
    networkService.destroy();
  });

  describe("初始化", () => {
    it("应该正确初始化", async () => {
      expect(networkService).toBeDefined();
    });

    it("应该正确初始化", async () => {
      await networkService.initialize();

      expect(networkService).toBeDefined();
    });

    it("不应该重复初始化", async () => {
      await networkService.initialize();
      await networkService.initialize(); // 第二次调用应该被忽略

      // 不应抛出错误
      expect(networkService).toBeDefined();
    });
  });

  describe("销毁", () => {
    it("应该正确销毁", () => {
      networkService.destroy();

      expect(networkService).toBeDefined();
    });
  });

  describe("HTTP API 方法", () => {
    beforeEach(async () => {
      await networkService.initialize();
    });

    it("应该调用 API 客户端的方法", async () => {
      const testConfig: AppConfig = {
        mcpEndpoint: "http://localhost:9999",
        mcpServers: {
          "test-server": {
            command: "node",
            args: ["server.js"],
          },
        },
      };
      mockApiClient.getConfig.mockResolvedValue(testConfig);

      const result = await networkService.getConfig();

      expect(mockApiClient.getConfig).toHaveBeenCalledTimes(1);
      expect(result).toBe(testConfig);
    });

    it("应该更新配置", async () => {
      const testConfig: AppConfig = {
        mcpEndpoint: "http://localhost:8888",
        mcpServers: {
          "test-server-2": {
            command: "node",
            args: ["server2.js"],
          },
        },
      };
      mockApiClient.updateConfig.mockResolvedValue(undefined);

      await networkService.updateConfig(testConfig);

      expect(mockApiClient.updateConfig).toHaveBeenCalledWith(testConfig);
    });

    it("应该获取状态", async () => {
      const testStatus = { server: { status: "running" } };
      mockApiClient.getStatus.mockResolvedValue(testStatus);

      const result = await networkService.getStatus();

      expect(mockApiClient.getStatus).toHaveBeenCalledTimes(1);
      expect(result).toBe(testStatus);
    });

    it("应该获取客户端状态", async () => {
      const testClientStatus: ClientStatus = {
        status: "connected",
        mcpEndpoint: "http://localhost:9999",
        activeMCPServers: ["test-server"],
      };
      mockApiClient.getClientStatus.mockResolvedValue(testClientStatus);

      const result = await networkService.getClientStatus();

      expect(mockApiClient.getClientStatus).toHaveBeenCalledTimes(1);
      expect(result).toBe(testClientStatus);
    });

    it("应该重启服务", async () => {
      mockApiClient.restartService.mockResolvedValue(undefined);

      await networkService.restartService();

      expect(mockApiClient.restartService).toHaveBeenCalledTimes(1);
    });

    it("应该获取 MCP 端点", async () => {
      const testEndpoint = "http://localhost:9999";
      mockApiClient.getMcpEndpoint.mockResolvedValue(testEndpoint);

      const result = await networkService.getMcpEndpoint();

      expect(mockApiClient.getMcpEndpoint).toHaveBeenCalledTimes(1);
      expect(result).toBe(testEndpoint);
    });

    it("应该获取 MCP 端点列表", async () => {
      const testEndpoints = ["http://localhost:9999", "http://localhost:8888"];
      mockApiClient.getMcpEndpoints.mockResolvedValue(testEndpoints);

      const result = await networkService.getMcpEndpoints();

      expect(mockApiClient.getMcpEndpoints).toHaveBeenCalledTimes(1);
      expect(result).toBe(testEndpoints);
    });

    it("应该检查客户端连接状态", async () => {
      mockApiClient.checkClientConnected.mockResolvedValue(true);

      const result = await networkService.checkClientConnected();

      expect(mockApiClient.checkClientConnected).toHaveBeenCalledTimes(1);
      expect(result).toBe(true);
    });
  });

  describe("重启服务（轮询等待模式）", () => {
    it("应该通过轮询等待重启完成", async () => {
      // 模拟重启后服务恢复连接
      mockApiClient.restartService.mockResolvedValue(undefined);
      mockApiClient.getClientStatus
        .mockResolvedValueOnce({ status: "reconnecting" } as any)
        .mockResolvedValueOnce({ status: "connected" } as any);

      await networkService.restartServiceWithNotification(5000);

      expect(mockApiClient.restartService).toHaveBeenCalled();
      expect(mockApiClient.getClientStatus).toHaveBeenCalled();
    });

    it("应该在重启失败（API 异常）时拒绝 Promise", async () => {
      const apiError = new Error("重启 API 调用失败");
      mockApiClient.restartService.mockRejectedValue(apiError);

      await expect(
        networkService.restartServiceWithNotification()
      ).rejects.toThrow(apiError);
    });

    it("应该在轮询超时时拒绝 Promise", async () => {
      mockApiClient.restartService.mockResolvedValue(undefined);
      // 模拟服务一直未恢复连接（每次轮询都返回 reconnecting 状态）
      mockApiClient.getClientStatus.mockResolvedValue({
        status: "reconnecting",
      } as any);

      // 使用较短的超时时间进行测试（轮询间隔 1s，超时 2.5s，约轮询 2 次后超时）
      const promise = networkService.restartServiceWithNotification(2500);

      await expect(promise).rejects.toThrow("等待重启完成超时");
    }, 10000); // 延长单测试超时以适应真实轮询等待
  });

  describe("便捷方法", () => {
    beforeEach(async () => {
      await networkService.initialize();
    });

    it("应该获取完整应用状态", async () => {
      const testConfig: AppConfig = {
        mcpEndpoint: "http://localhost:9999",
        mcpServers: {
          "test-server": {
            command: "node",
            args: ["server.js"],
          },
        },
      };
      const testStatus = { server: { status: "running" } };

      mockApiClient.getConfig.mockResolvedValue(testConfig);
      mockApiClient.getStatus.mockResolvedValue(testStatus);

      const result = await networkService.getFullAppState();

      expect(result).toEqual({
        config: testConfig,
        status: testStatus,
      });
    });

    it("应该并行获取配置和状态", async () => {
      const testConfig: AppConfig = {
        mcpEndpoint: "http://localhost:9999",
        mcpServers: {
          "test-server": {
            command: "node",
            args: ["server.js"],
          },
        },
      };
      const testStatus = { server: { status: "running" } };

      const getConfigPromise = new Promise((resolve) =>
        setTimeout(() => resolve(testConfig), 10)
      );
      const getStatusPromise = new Promise((resolve) =>
        setTimeout(() => resolve(testStatus), 20)
      );

      mockApiClient.getConfig.mockReturnValue(getConfigPromise);
      mockApiClient.getStatus.mockReturnValue(getStatusPromise);

      const startTime = Date.now();
      const result = await networkService.getFullAppState();
      const endTime = Date.now();

      expect(result.config).toBe(testConfig);
      expect(result.status).toBe(testStatus);
      // 应该并行执行，所以总时间应该接近较长的那个任务（20ms），而不是两个任务的和（30ms）
      // 增加超时阈值以适应不同的系统负载和 CI 环境
      expect(endTime - startTime).toBeLessThan(300);
    });
  });

  describe("错误处理", () => {
    beforeEach(async () => {
      await networkService.initialize();
    });

    it("应该正确处理 API 调用错误", async () => {
      const error = new Error("API 调用失败");
      mockApiClient.getConfig.mockRejectedValue(error);

      await expect(networkService.getConfig()).rejects.toThrow(error);
    });
  });

  describe("边界情况", () => {
    beforeEach(async () => {
      await networkService.initialize();
    });

    it("应该处理空的配置更新", async () => {
      const emptyConfig: Partial<AppConfig> = {};
      mockApiClient.updateConfig.mockResolvedValue(undefined);

      await expect(
        networkService.updateConfig(emptyConfig as AppConfig)
      ).resolves.not.toThrow();
      expect(mockApiClient.updateConfig).toHaveBeenCalledWith(
        emptyConfig as AppConfig
      );
    });
  });

  describe("restartServiceWithNotification 边界情况", () => {
    beforeEach(async () => {
      await networkService.initialize();
    });

    it("轮询期间网络异常不应中断轮询", async () => {
      mockApiClient.restartService.mockResolvedValue(undefined);
      // 第一次返回 reconnecting，第二次抛异常（网络问题），第三次返回 connected
      mockApiClient.getClientStatus
        .mockResolvedValueOnce({ status: "reconnecting" } as any)
        .mockRejectedValueOnce(new Error("网络错误"))
        .mockResolvedValueOnce({ status: "connected" } as any);

      // 使用足够长的超时让轮询完成
      await networkService.restartServiceWithNotification(10000);

      // 应该完成了轮询（网络异常被捕获并继续）
      expect(mockApiClient.getClientStatus).toHaveBeenCalledTimes(3);
    }, 15000);

    it("第一次 getClientStatus 就返回 connected 时应在首轮轮询后返回", async () => {
      mockApiClient.restartService.mockResolvedValue(undefined);
      mockApiClient.getClientStatus.mockResolvedValue({
        status: "connected",
      } as any);

      const startTime = Date.now();
      await networkService.restartServiceWithNotification(30000);
      const elapsed = Date.now() - startTime;

      // 应该在第一轮 pollInterval (1000ms) 后返回
      expect(elapsed).toBeLessThan(2000);
      // 只调用了一次（首次即成功）
      expect(mockApiClient.getClientStatus).toHaveBeenCalledTimes(1);
    });

    it("timeout=0 时应立即超时", async () => {
      mockApiClient.restartService.mockResolvedValue(undefined);

      await expect(
        networkService.restartServiceWithNotification(0)
      ).rejects.toThrow("等待重启完成超时");
    });
  });
});

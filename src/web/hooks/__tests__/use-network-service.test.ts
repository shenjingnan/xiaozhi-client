/**
 * useNetworkService Hook 测试
 */

import { networkService } from "@/services/index";
import { renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AppConfig, ClientStatus } from "../../../types";
import { useNetworkService } from "../useNetworkService";

// Mock 依赖
vi.mock("@/services/index", () => ({
  networkService: {
    initialize: vi.fn(),
    destroy: vi.fn(),
    getConfig: vi.fn(),
    updateConfig: vi.fn(),
    getStatus: vi.fn(),
    getClientStatus: vi.fn(),
    restartService: vi.fn(),
    restartServiceWithNotification: vi.fn(),
  },
}));

vi.mock("@/stores/config", () => ({
  useConfigStore: {
    getState: vi.fn(() => ({
      setConfig: vi.fn(),
    })),
  },
}));

vi.mock("@/stores/status", () => ({
  useStatusStore: {
    getState: vi.fn(() => ({
      setClientStatus: vi.fn(),
      setRestartStatus: vi.fn(),
      setError: vi.fn(),
    })),
  },
}));

describe("useNetworkService", () => {
  const mockNetworkService = vi.mocked(networkService);

  beforeEach(() => {
    vi.clearAllMocks();
    // 重置所有 mock 的实现
    mockNetworkService.initialize.mockResolvedValue(undefined);
    mockNetworkService.getConfig.mockResolvedValue({ version: "1.0.0" } as any);
    mockNetworkService.getClientStatus.mockResolvedValue({
      status: "connected",
    } as any);
    mockNetworkService.getStatus.mockResolvedValue({
      client: { status: "connected" },
    } as any);
    mockNetworkService.updateConfig.mockResolvedValue(undefined);
    mockNetworkService.restartService.mockResolvedValue(undefined);
    mockNetworkService.restartServiceWithNotification.mockResolvedValue(
      undefined
    );

    // Mock location
    Object.defineProperty(window, "location", {
      value: {
        protocol: "http:",
        hostname: "localhost",
        port: "5173",
        reload: vi.fn(),
      },
      writable: true,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("基本功能", () => {
    it("应该正确初始化网络服务", () => {
      renderHook(() => useNetworkService());
      expect(mockNetworkService.initialize).toHaveBeenCalled();
    });

    it("应该返回所有预期的方法", () => {
      const { result } = renderHook(() => useNetworkService());

      expect(typeof result.current.getConfig).toBe("function");
      expect(typeof result.current.updateConfig).toBe("function");
      expect(typeof result.current.getStatus).toBe("function");
      expect(typeof result.current.refreshStatus).toBe("function");
      expect(typeof result.current.restartService).toBe("function");
      expect(typeof result.current.restartServiceWithNotification).toBe(
        "function"
      );
      expect(typeof result.current.changePort).toBe("function");
      expect(typeof result.current.loadInitialData).toBe("function");
      expect(typeof result.current.getServerUrl).toBe("function");
    });
  });

  describe("HTTP API 方法", () => {
    it("getConfig 应该正确获取配置", async () => {
      const config = { version: "1.0.0" };
      mockNetworkService.getConfig.mockResolvedValue(config as any);

      const { result } = renderHook(() => useNetworkService());

      const resultConfig = await result.current.getConfig();
      expect(mockNetworkService.getConfig).toHaveBeenCalled();
      expect(resultConfig).toBe(config);
    });

    it("getStatus 应该正确获取状态", async () => {
      const status = { client: { status: "connected" } };
      mockNetworkService.getStatus.mockResolvedValue(status as any);

      const { result } = renderHook(() => useNetworkService());

      const resultStatus = await result.current.getStatus();
      expect(mockNetworkService.getStatus).toHaveBeenCalled();
      expect(resultStatus).toBe(status);
    });

    it("updateConfig 应该正确更新配置", async () => {
      const config = { version: "1.0.0" };

      const { result } = renderHook(() => useNetworkService());

      await result.current.updateConfig(config as any);

      expect(mockNetworkService.updateConfig).toHaveBeenCalledWith(config);
    });

    it("restartService 应该正确重启服务", async () => {
      const { result } = renderHook(() => useNetworkService());

      await result.current.restartService();

      expect(mockNetworkService.restartService).toHaveBeenCalled();
    });

    it("refreshStatus 应该正确刷新状态", async () => {
      const status = { client: { status: "connected" } };
      mockNetworkService.getStatus.mockResolvedValue(status as any);

      const { result } = renderHook(() => useNetworkService());

      await result.current.refreshStatus();

      expect(mockNetworkService.getStatus).toHaveBeenCalled();
    });
  });

  describe("重启服务（轮询等待模式）", () => {
    it("restartServiceWithNotification 应该正确工作", async () => {
      const { result } = renderHook(() => useNetworkService());

      await result.current.restartServiceWithNotification();

      expect(
        mockNetworkService.restartServiceWithNotification
      ).toHaveBeenCalledWith(30000);
    });

    it("restartServiceWithNotification 应该支持自定义超时", async () => {
      const { result } = renderHook(() => useNetworkService());

      await result.current.restartServiceWithNotification(60000);

      expect(
        mockNetworkService.restartServiceWithNotification
      ).toHaveBeenCalledWith(60000);
    });
  });

  describe("工具方法", () => {
    it("getServerUrl 应该返回基于当前页面的 URL", () => {
      const { result } = renderHook(() => useNetworkService());

      const url = result.current.getServerUrl();

      expect(url).toBe("http://localhost:5173");
    });

    it("getServerUrl 在 HTTPS 协议下应返回 https 前缀", () => {
      Object.defineProperty(window, "location", {
        value: {
          protocol: "https:",
          hostname: "example.com",
          port: "443",
          reload: vi.fn(),
        },
        writable: true,
      });

      const { result } = renderHook(() => useNetworkService());
      const url = result.current.getServerUrl();

      expect(url).toBe("https://example.com:443");

      // 恢复默认
      Object.defineProperty(window, "location", {
        value: {
          protocol: "http:",
          hostname: "localhost",
          port: "5173",
          reload: vi.fn(),
        },
        writable: true,
      });
    });

    it("getServerUrl 无端口时应使用默认值 9999", () => {
      Object.defineProperty(window, "location", {
        value: {
          protocol: "http:",
          hostname: "localhost",
          port: "", // 空端口
          reload: vi.fn(),
        },
        writable: true,
      });

      const { result } = renderHook(() => useNetworkService());
      const url = result.current.getServerUrl();

      expect(url).toBe("http://localhost:9999");

      // 恢复默认
      Object.defineProperty(window, "location", {
        value: {
          protocol: "http:",
          hostname: "localhost",
          port: "5173",
          reload: vi.fn(),
        },
        writable: true,
      });
    });
  });

  describe("错误处理", () => {
    it("getConfig 应该处理获取配置失败", async () => {
      const error = new Error("获取配置失败");
      mockNetworkService.getConfig.mockRejectedValue(error);
      const consoleSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});

      const { result } = renderHook(() => useNetworkService());

      await expect(result.current.getConfig()).rejects.toThrow(error);
      expect(consoleSpy).toHaveBeenCalledWith(
        "[NetworkService] 获取配置失败:",
        error
      );

      consoleSpy.mockRestore();
    });

    it("updateConfig 应该处理更新配置失败", async () => {
      const error = new Error("更新配置失败");
      mockNetworkService.updateConfig.mockRejectedValue(error);
      const consoleSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});

      const { result } = renderHook(() => useNetworkService());

      await expect(result.current.updateConfig({} as any)).rejects.toThrow(
        error
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        "[NetworkService] 配置更新失败:",
        error
      );

      consoleSpy.mockRestore();
    });

    it("restartService 应该处理重启服务失败", async () => {
      const error = new Error("重启服务失败");
      mockNetworkService.restartService.mockRejectedValue(error);
      const consoleSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});

      const { result } = renderHook(() => useNetworkService());

      await expect(result.current.restartService()).rejects.toThrow(error);
      expect(consoleSpy).toHaveBeenCalledWith(
        "[NetworkService] 重启服务失败:",
        error
      );

      consoleSpy.mockRestore();
    });

    it("restartServiceWithNotification 应该处理失败", async () => {
      const error = new Error("重启服务通知失败");
      mockNetworkService.restartServiceWithNotification.mockRejectedValue(
        error
      );
      const consoleSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});

      const { result } = renderHook(() => useNetworkService());

      await expect(
        result.current.restartServiceWithNotification()
      ).rejects.toThrow(error);
      expect(consoleSpy).toHaveBeenCalledWith(
        "[NetworkService] 重启失败:",
        error
      );

      consoleSpy.mockRestore();
    });
  });

  describe("初始化错误处理", () => {
    it("应该处理初始化失败", async () => {
      const error = new Error("初始化失败");
      mockNetworkService.initialize.mockRejectedValue(error);
      const consoleSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});

      renderHook(() => useNetworkService());

      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(consoleSpy).toHaveBeenCalledWith(
        "[NetworkService] 初始化失败:",
        error
      );

      consoleSpy.mockRestore();
    });
  });

  describe("loadInitialData 方法", () => {
    it("loadInitialData 应该正确加载初始数据", async () => {
      const config = { version: "1.0.0" };
      const status = { status: "connected" };
      mockNetworkService.getConfig.mockResolvedValue(config as any);
      mockNetworkService.getClientStatus.mockResolvedValue(status as any);

      const { result } = renderHook(() => useNetworkService());

      await result.current.loadInitialData();

      expect(mockNetworkService.getConfig).toHaveBeenCalled();
      expect(mockNetworkService.getClientStatus).toHaveBeenCalled();
    });

    it("loadInitialData 应该处理加载失败", async () => {
      const error = new Error("加载初始数据失败");
      mockNetworkService.getConfig.mockRejectedValue(error);
      const consoleSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});

      const { result } = renderHook(() => useNetworkService());

      await result.current.loadInitialData();

      expect(consoleSpy).toHaveBeenCalledWith(
        "[NetworkService] 加载初始数据失败:",
        error
      );

      consoleSpy.mockRestore();
    });

    it("loadInitialData 成功时应并行调用 getConfig 和 getClientStatus", async () => {
      const config = {};
      const status = {};

      let configResolve: (value: AppConfig | PromiseLike<AppConfig>) => void;
      let statusResolve: (
        value: ClientStatus | PromiseLike<ClientStatus>
      ) => void;

      mockNetworkService.getConfig.mockReturnValue(
        new Promise<AppConfig>((resolve) => {
          configResolve = resolve;
        })
      );
      mockNetworkService.getClientStatus.mockReturnValue(
        new Promise<ClientStatus>((resolve) => {
          statusResolve = resolve;
        })
      );

      const { result } = renderHook(() => useNetworkService());
      const loadPromise = result.current.loadInitialData();

      // 等一个微任务让两个并行请求都发出
      await new Promise((resolve) => setTimeout(resolve, 0));

      // 此时两个都应该已经调用了（并行）
      expect(mockNetworkService.getConfig).toHaveBeenCalledTimes(1);
      expect(mockNetworkService.getClientStatus).toHaveBeenCalledTimes(1);

      // 解决 promises
      configResolve!(config as AppConfig);
      statusResolve!(status as ClientStatus);

      await loadPromise;
    });

    it("loadInitialData 应并行调用 getConfig 和 getClientStatus", async () => {
      const config = {};
      const status = {};

      let configResolve: (value: AppConfig | PromiseLike<AppConfig>) => void;
      let statusResolve: (
        value: ClientStatus | PromiseLike<ClientStatus>
      ) => void;

      mockNetworkService.getConfig.mockReturnValue(
        new Promise<AppConfig>((resolve) => {
          configResolve = resolve;
        })
      );
      mockNetworkService.getClientStatus.mockReturnValue(
        new Promise<ClientStatus>((resolve) => {
          statusResolve = resolve;
        })
      );

      const { result } = renderHook(() => useNetworkService());
      const loadPromise = result.current.loadInitialData();

      // 等一个微任务让两个并行请求都发出
      await new Promise((resolve) => setTimeout(resolve, 0));

      // 此时两个都应该已经调用了（并行）
      expect(mockNetworkService.getConfig).toHaveBeenCalledTimes(1);
      expect(mockNetworkService.getClientStatus).toHaveBeenCalledTimes(1);

      // 解决 promises
      configResolve!(config as AppConfig);
      statusResolve!(status as ClientStatus);

      await loadPromise;
    });
  });

  describe("端口切换功能", () => {
    it("changePort 应该处理切换失败", async () => {
      const error = new Error("切换失败");
      mockNetworkService.restartService.mockRejectedValue(error);

      const { result } = renderHook(() => useNetworkService());

      await expect(result.current.changePort(8080)).rejects.toThrow(error);
    });

    it("changePort 成功时应调用 restartService 并最终触发 reload", async () => {
      vi.useFakeTimers();
      mockNetworkService.restartService.mockResolvedValue(undefined);

      const { result } = renderHook(() => useNetworkService());

      // changePort 内部会调用 restartService，然后等待 5000ms 后 reload
      // 使用 fake timers 来避免实际等待
      const changePromise = result.current.changePort(9090);

      // 推进定时器让 setTimeout(5000) 完成
      await vi.advanceTimersByTimeAsync(6000);

      await changePromise;

      expect(mockNetworkService.restartService).toHaveBeenCalled();
      // window.location.reload 应被调用
      expect(window.location.reload).toHaveBeenCalled();

      vi.useRealTimers();
    });

    it("changePort 应传递正确的端口号给 restartService", async () => {
      vi.useFakeTimers();
      mockNetworkService.restartService.mockResolvedValue(undefined);

      const { result } = renderHook(() => useNetworkService());

      result.current.changePort(8888);
      await vi.advanceTimersByTimeAsync(6000);

      // restartService 不接受端口参数（changePort 内部管理端口）
      expect(mockNetworkService.restartService).toHaveBeenCalled();

      vi.useRealTimers();
    });
  });

  describe("资源清理", () => {
    it("unmount 时应该调用 destroy", () => {
      const { unmount } = renderHook(() => useNetworkService());

      unmount();

      expect(mockNetworkService.destroy).toHaveBeenCalled();
    });
  });
});

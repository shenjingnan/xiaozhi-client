/**
 * useNetworkService Hook 测试
 */

import { ConnectionState, networkService } from "@/services/index";
import { renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
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
    updateConfigWithNotification: vi.fn(),
    restartServiceWithNotification: vi.fn(),
    setWebSocketUrl: vi.fn(),
    isWebSocketConnected: vi.fn(),
    getWebSocketState: vi.fn(),
    onWebSocketEvent: vi.fn(),
  },
  ConnectionState: {
    DISCONNECTED: "disconnected",
    CONNECTING: "connecting",
    CONNECTED: "connected",
    RECONNECTING: "reconnecting",
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

vi.mock("@/stores/websocket", () => ({
  useWebSocketActions: () => ({
    setConnectionState: vi.fn(),
    setWsUrl: vi.fn(),
    setPortChangeStatus: vi.fn(),
  }),
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
    mockNetworkService.updateConfigWithNotification.mockResolvedValue(
      undefined
    );
    mockNetworkService.restartServiceWithNotification.mockResolvedValue(
      undefined
    );
    mockNetworkService.isWebSocketConnected.mockReturnValue(false);
    mockNetworkService.getWebSocketState.mockReturnValue(
      ConnectionState.DISCONNECTED
    );

    // Mock onWebSocketEvent 返回 unsubscribe 函数
    mockNetworkService.onWebSocketEvent.mockReturnValue(() => {});

    // Mock localStorage
    Object.defineProperty(window, "localStorage", {
      value: {
        getItem: vi.fn(),
        setItem: vi.fn(),
      },
      writable: true,
    });

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
      expect(typeof result.current.updateConfigWithNotification).toBe(
        "function"
      );
      expect(typeof result.current.restartServiceWithNotification).toBe(
        "function"
      );
      expect(typeof result.current.setCustomWsUrl).toBe("function");
      expect(typeof result.current.getWebSocketUrl).toBe("function");
      expect(typeof result.current.changePort).toBe("function");
      expect(typeof result.current.loadInitialData).toBe("function");
      expect(typeof result.current.isWebSocketConnected).toBe("function");
      expect(typeof result.current.getWebSocketState).toBe("function");
    });

    it("应该设置正确数量的事件监听器", () => {
      renderHook(() => useNetworkService());
      expect(mockNetworkService.onWebSocketEvent).toHaveBeenCalledTimes(6); // 6个主要事件
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

  describe("混合模式方法", () => {
    it("updateConfigWithNotification 应该正确工作", async () => {
      const config = { version: "1.0.0" };

      const { result } = renderHook(() => useNetworkService());

      await result.current.updateConfigWithNotification(config as any);

      expect(
        mockNetworkService.updateConfigWithNotification
      ).toHaveBeenCalledWith(config, 5000);
    });

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

  describe("WebSocket 管理", () => {
    it("setCustomWsUrl 应该正确设置 URL", () => {
      const url = "ws://localhost:8080";
      const { result } = renderHook(() => useNetworkService());

      result.current.setCustomWsUrl(url);

      expect(mockNetworkService.setWebSocketUrl).toHaveBeenCalledWith(url);
    });

    it("getWebSocketUrl 应该返回 localStorage 中的 URL", () => {
      const savedUrl = "ws://localhost:8080";
      vi.mocked(window.localStorage.getItem).mockReturnValue(savedUrl);

      const { result } = renderHook(() => useNetworkService());

      const url = result.current.getWebSocketUrl();

      expect(window.localStorage.getItem).toHaveBeenCalledWith(
        "xiaozhi-ws-url"
      );
      expect(url).toBe(savedUrl);
    });

    it("getWebSocketUrl 应该根据 location 构建 URL", () => {
      vi.mocked(window.localStorage.getItem).mockReturnValue(null);

      const { result } = renderHook(() => useNetworkService());

      const url = result.current.getWebSocketUrl();

      expect(url).toBe("ws://localhost:5173");
    });

    it("isWebSocketConnected 应该返回连接状态", () => {
      mockNetworkService.isWebSocketConnected.mockReturnValue(true);

      const { result } = renderHook(() => useNetworkService());

      const isConnected = result.current.isWebSocketConnected();

      expect(isConnected).toBe(true);
    });

    it("getWebSocketState 应该返回状态", () => {
      mockNetworkService.getWebSocketState.mockReturnValue(
        ConnectionState.CONNECTED
      );

      const { result } = renderHook(() => useNetworkService());

      const state = result.current.getWebSocketState();

      expect(state).toBe(ConnectionState.CONNECTED);
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

    it("updateConfigWithNotification 应该处理失败", async () => {
      const error = new Error("更新配置通知失败");
      mockNetworkService.updateConfigWithNotification.mockRejectedValue(error);
      const consoleSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});

      const { result } = renderHook(() => useNetworkService());

      await expect(
        result.current.updateConfigWithNotification({} as any)
      ).rejects.toThrow(error);
      expect(consoleSpy).toHaveBeenCalledWith(
        "[NetworkService] 配置更新失败:",
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
        "[NetworkService] 重启服务失败:",
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

  describe("事件监听器设置", () => {
    it("应该设置所有预期的事件监听器", () => {
      renderHook(() => useNetworkService());

      const eventCalls = mockNetworkService.onWebSocketEvent.mock.calls;
      const eventNames = eventCalls.map((call) => call[0]);

      expect(eventNames).toContain("connection:connected");
      expect(eventNames).toContain("connection:disconnected");
      expect(eventNames).toContain("data:configUpdate");
      expect(eventNames).toContain("data:statusUpdate");
      expect(eventNames).toContain("data:restartStatus");
      expect(eventNames).toContain("system:error");
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
  });

  describe("端口切换功能", () => {
    it("changePort 应该处理切换失败", async () => {
      const error = new Error("切换失败");
      mockNetworkService.restartService.mockRejectedValue(error);

      const { result } = renderHook(() => useNetworkService());

      await expect(result.current.changePort(8080)).rejects.toThrow(error);
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

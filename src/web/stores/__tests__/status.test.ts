import { apiClient } from "@/services/api";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ClientStatus } from "../../../types";
import { useStatusStore } from "../status";

// 导入 API 中的 FullStatus 类型
import type { FullStatus } from "@/services/api";

// Mock API client
vi.mock("@/services/api", () => ({
  apiClient: {
    getStatus: vi.fn(),
    restartService: vi.fn(),
  },
}));

describe("Status Store", () => {
  beforeEach(() => {
    // 重置 store 状态
    useStatusStore.getState().reset();
    // 清除所有 mock
    vi.clearAllMocks();
  });

  describe("基础状态管理", () => {
    it("应该正确设置客户端状态", () => {
      const mockStatus: ClientStatus = {
        status: "connected",
        mcpEndpoint: "wss://api.xiaozhi.me/mcp/test",
        activeMCPServers: ["server1", "server2"],
        lastHeartbeat: Date.now(),
      };

      const store = useStatusStore.getState();
      store.setClientStatus(mockStatus, "http");

      const state = useStatusStore.getState();
      expect(state.clientStatus).toEqual(mockStatus);
      expect(state.lastSource).toBe("http");
      expect(state.loading.lastUpdated).toBeGreaterThan(0);
    });

    it("应该正确设置重启状态", () => {
      const restartStatus = {
        status: "restarting" as const,
        timestamp: Date.now(),
      };

      const store = useStatusStore.getState();
      store.setRestartStatus(restartStatus, "websocket");

      const state = useStatusStore.getState();
      expect(state.restartStatus).toEqual(restartStatus);
    });

    it("应该正确设置加载状态", () => {
      const store = useStatusStore.getState();

      store.setLoading({ isLoading: true, isRestarting: false });
      expect(useStatusStore.getState().loading.isLoading).toBe(true);
      expect(useStatusStore.getState().loading.isRestarting).toBe(false);
    });

    it("应该正确设置错误状态", () => {
      const store = useStatusStore.getState();
      const error = new Error("状态获取失败");

      store.setError(error);
      expect(useStatusStore.getState().loading.lastError).toBe(error);
    });
  });

  describe("异步操作", () => {
    it("getStatus 应该从 API 获取状态", async () => {
      const mockFullStatus: FullStatus = {
        client: {
          status: "connected",
          mcpEndpoint: "wss://api.xiaozhi.me/mcp/test",
          activeMCPServers: ["server1"],
          lastHeartbeat: Date.now(),
        },
        timestamp: Date.now(),
      };

      vi.mocked(apiClient.getStatus).mockResolvedValue(mockFullStatus);

      const store = useStatusStore.getState();
      const result = await store.getStatus();

      expect(apiClient.getStatus).toHaveBeenCalled();
      expect(result).toEqual(mockFullStatus);
      expect(useStatusStore.getState().clientStatus).toEqual(
        mockFullStatus.client
      );
    });

    it("refreshStatus 应该刷新状态", async () => {
      const mockFullStatus: FullStatus = {
        client: {
          status: "connected",
          mcpEndpoint: "wss://api.xiaozhi.me/mcp/refreshed",
          activeMCPServers: [],
          lastHeartbeat: Date.now(),
        },
        timestamp: Date.now(),
      };

      vi.mocked(apiClient.getStatus).mockResolvedValue(mockFullStatus);

      const store = useStatusStore.getState();
      const result = await store.refreshStatus();

      expect(apiClient.getStatus).toHaveBeenCalled();
      expect(result).toEqual(mockFullStatus);
      expect(useStatusStore.getState().clientStatus).toEqual(
        mockFullStatus.client
      );
    });

    it("restartService 应该重启服务", async () => {
      vi.mocked(apiClient.restartService).mockResolvedValue(undefined);

      const store = useStatusStore.getState();
      await store.restartService();

      expect(apiClient.restartService).toHaveBeenCalled();
      // 新的逻辑：重启后会启动轮询，isRestarting 保持为 true 直到重连成功或失败
      expect(useStatusStore.getState().loading.isRestarting).toBe(true);
      expect(useStatusStore.getState().restartPolling.enabled).toBe(true);
    });

    it("应该正确处理 API 错误", async () => {
      const error = new Error("API 错误");
      vi.mocked(apiClient.getStatus).mockRejectedValue(error);

      const store = useStatusStore.getState();

      await expect(store.getStatus()).rejects.toThrow("API 错误");
      expect(useStatusStore.getState().loading.lastError).toEqual(error);
    });
  });

  describe("轮询控制", () => {
    it("应该正确设置轮询配置", () => {
      const store = useStatusStore.getState();

      store.setPollingConfig({ enabled: true, interval: 5000 });

      const state = useStatusStore.getState();
      expect(state.polling.enabled).toBe(true);
      expect(state.polling.interval).toBe(5000);
    });

    it("应该能够启动和停止轮询", () => {
      const store = useStatusStore.getState();

      // 启动轮询
      store.startPolling(3000);
      expect(useStatusStore.getState().polling.enabled).toBe(true);
      expect(useStatusStore.getState().polling.interval).toBe(3000);

      // 停止轮询
      store.stopPolling();
      expect(useStatusStore.getState().polling.enabled).toBe(false);
    });
  });

  describe("store 重置", () => {
    it("应该能够重置所有状态到初始值", () => {
      const store = useStatusStore.getState();

      // 设置一些状态
      store.setClientStatus({
        status: "connected",
        mcpEndpoint: "test",
        activeMCPServers: ["server1"],
        lastHeartbeat: Date.now(),
      });
      store.setError(new Error("test error"));

      // 重置状态
      store.reset();

      // 验证状态被重置
      const state = useStatusStore.getState();
      expect(state.clientStatus).toBeNull();
      expect(state.loading.lastError).toBeNull();
      expect(state.loading.isLoading).toBe(false);
    });
  });

  describe("重启轮询判断逻辑", () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    /**
     * 辅助函数：创建模拟的 FullStatus 响应
     */
    function createMockStatus(
      clientStatus: "connected" | "disconnected"
    ): FullStatus {
      return {
        client: {
          status: clientStatus,
          mcpEndpoint: "wss://test",
          activeMCPServers: [],
          lastHeartbeat: Date.now(),
        },
        timestamp: Date.now(),
      };
    }

    it("client.status 为 connected 时应立即退出 loading（最优路径）", async () => {
      // 模拟 API 返回 client.status === "connected"
      vi.mocked(apiClient.getStatus).mockResolvedValue(
        createMockStatus("connected")
      );
      vi.mocked(apiClient.restartService).mockResolvedValue(undefined);

      const store = useStatusStore.getState();

      // 触发重启服务（会启动轮询）
      await store.restartService();

      // 验证初始状态：loading 和轮询已启动
      expect(useStatusStore.getState().loading.isRestarting).toBe(true);
      expect(useStatusStore.getState().restartPolling.enabled).toBe(true);

      // 推进一个轮询周期（1秒），触发 refreshStatus 返回 connected
      await vi.advanceTimersByTimeAsync(1000);

      // 应立即退出 loading
      expect(useStatusStore.getState().loading.isRestarting).toBe(false);
      expect(useStatusStore.getState().restartPolling.enabled).toBe(false);
      expect(useStatusStore.getState().restartStatus?.status).toBe("completed");
    });

    it("client.status 为 disconnected 但 API 连续成功时应退出 loading", async () => {
      // 模拟 API 始终返回 client.status === "disconnected"（HTTP 轮询场景）
      vi.mocked(apiClient.getStatus).mockResolvedValue(
        createMockStatus("disconnected")
      );
      vi.mocked(apiClient.restartService).mockResolvedValue(undefined);

      const store = useStatusStore.getState();

      // 触发重启
      await store.restartService();

      expect(useStatusStore.getState().loading.isRestarting).toBe(true);

      // 连续推进 3 个轮询周期（达到 CONSECUTIVE_SUCCESS_THRESHOLD = 3）
      await vi.advanceTimersByTimeAsync(3000);

      // 应通过连续成功计数退出 loading
      expect(useStatusStore.getState().loading.isRestarting).toBe(false);
      expect(useStatusStore.getState().restartPolling.enabled).toBe(false);
      expect(useStatusStore.getState().restartStatus?.status).toBe("completed");
    });

    it("轮询中偶发一次失败应重置连续成功计数", async () => {
      let callCount = 0;
      vi.mocked(apiClient.getStatus).mockImplementation(async () => {
        callCount++;
        // 第 2 次调用时模拟失败（旧进程 dying 阶段）
        if (callCount === 2) {
          throw new Error("连接失败");
        }
        return createMockStatus("disconnected");
      });
      vi.mocked(apiClient.restartService).mockResolvedValue(undefined);

      const store = useStatusStore.getState();
      await store.restartService();

      // 第 1 次：成功 → consecutiveSuccessCount = 1
      await vi.advanceTimersByTimeAsync(1000);
      expect(
        useStatusStore.getState().restartPolling.consecutiveSuccessCount
      ).toBe(1);

      // 第 2 次：失败 → consecutiveSuccessCount 应被重置为 0
      await vi.advanceTimersByTimeAsync(1000);
      expect(
        useStatusStore.getState().restartPolling.consecutiveSuccessCount
      ).toBe(0);

      // 第 3 次：成功 → consecutiveSuccessCount = 1（从 0 重新开始累积）
      await vi.advanceTimersByTimeAsync(1000);
      expect(
        useStatusStore.getState().restartPolling.consecutiveSuccessCount
      ).toBe(1);

      // 第 4 次：成功 → consecutiveSuccessCount = 2
      await vi.advanceTimersByTimeAsync(1000);
      expect(
        useStatusStore.getState().restartPolling.consecutiveSuccessCount
      ).toBe(2);

      // 第 5 次：成功 → consecutiveSuccessCount = 3，达到阈值后退出 loading
      // 注意：退出 loading 后 stopRestartPolling 会将计数重置为 0，
      // 所以这里只验证 loading 状态而非计数值
      await vi.advanceTimersByTimeAsync(1000);
      expect(useStatusStore.getState().loading.isRestarting).toBe(false);
      expect(useStatusStore.getState().restartStatus?.status).toBe("completed");
    });

    it("重启轮询超时应标记为 failed 并退出 loading", async () => {
      // 模拟 API 始终抛出错误（服务未恢复）
      vi.mocked(apiClient.getStatus).mockRejectedValue(new Error("服务不可达"));
      vi.mocked(apiClient.restartService).mockResolvedValue(undefined);

      const store = useStatusStore.getState();
      await store.restartService();

      expect(useStatusStore.getState().loading.isRestarting).toBe(true);

      // 推进超过超时时间（60 秒 + 缓冲）
      await vi.advanceTimersByTimeAsync(65000);

      // 超时后应退出 loading 并标记为 failed
      expect(useStatusStore.getState().loading.isRestarting).toBe(false);
      expect(useStatusStore.getState().restartPolling.enabled).toBe(false);
      expect(useStatusStore.getState().restartStatus?.status).toBe("failed");
    });
  });
});

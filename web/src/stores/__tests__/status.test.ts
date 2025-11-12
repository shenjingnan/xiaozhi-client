import type { ClientStatus } from "@/types/index";
import { apiClient } from "@services/api";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useStatusStore } from "../status";

// 导入 API 中的 FullStatus 类型
import type { FullStatus } from "@services/api";

// Mock API client
vi.mock("@services/api", () => ({
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
});

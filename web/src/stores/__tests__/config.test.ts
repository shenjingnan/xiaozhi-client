import { beforeEach, describe, expect, it, vi } from "vitest";
import { apiClient } from "../../services/api";
import type { AppConfig } from "../../types";
import { useConfigStore } from "../config";

// Mock API client
vi.mock("../../services/api", () => ({
  apiClient: {
    getConfig: vi.fn(),
    updateConfig: vi.fn(),
    reloadConfig: vi.fn(),
  },
}));

describe("Config Store", () => {
  beforeEach(() => {
    // 重置 store 状态
    useConfigStore.getState().reset();
    // 清除所有 mock
    vi.clearAllMocks();
  });

  describe("基础状态管理", () => {
    it("应该正确设置配置数据", () => {
      const mockConfig: AppConfig = {
        mcpEndpoint: "wss://api.xiaozhi.me/mcp/test",
        mcpServers: {
          server1: { command: "node", args: ["server1.js"] },
        },
        mcpServerConfig: {
          server1: {
            tools: {
              tool1: { enable: true, description: "Test tool" },
            },
          },
        },
      };

      const store = useConfigStore.getState();
      store.setConfig(mockConfig, 'http');

      const state = useConfigStore.getState();
      expect(state.config).toEqual(mockConfig);
      expect(state.lastSource).toBe('http');
      expect(state.loading.lastUpdated).toBeGreaterThan(0);
    });

    it("应该正确设置加载状态", () => {
      const store = useConfigStore.getState();
      
      store.setLoading({ isLoading: true, isUpdating: false });
      expect(useConfigStore.getState().loading.isLoading).toBe(true);
      expect(useConfigStore.getState().loading.isUpdating).toBe(false);
    });

    it("应该正确设置错误状态", () => {
      const store = useConfigStore.getState();
      const error = new Error("配置加载失败");
      
      store.setError(error);
      expect(useConfigStore.getState().loading.lastError).toBe(error);
    });
  });

  describe("异步操作", () => {
    it("getConfig 应该从 API 获取配置", async () => {
      const mockConfig: AppConfig = {
        mcpEndpoint: "wss://api.xiaozhi.me/mcp/test",
        mcpServers: {},
      };

      vi.mocked(apiClient.getConfig).mockResolvedValue(mockConfig);

      const store = useConfigStore.getState();
      const result = await store.getConfig();

      expect(apiClient.getConfig).toHaveBeenCalled();
      expect(result).toEqual(mockConfig);
      expect(useConfigStore.getState().config).toEqual(mockConfig);
    });

    it("updateConfig 应该更新配置", async () => {
      const mockConfig: AppConfig = {
        mcpEndpoint: "wss://api.xiaozhi.me/mcp/updated",
        mcpServers: {},
      };

      vi.mocked(apiClient.updateConfig).mockResolvedValue(undefined);

      const store = useConfigStore.getState();
      await store.updateConfig(mockConfig);

      expect(apiClient.updateConfig).toHaveBeenCalledWith(mockConfig);
      expect(useConfigStore.getState().config).toEqual(mockConfig);
    });

    it("refreshConfig 应该刷新配置", async () => {
      const mockConfig: AppConfig = {
        mcpEndpoint: "wss://api.xiaozhi.me/mcp/refreshed",
        mcpServers: {},
      };

      vi.mocked(apiClient.getConfig).mockResolvedValue(mockConfig);

      const store = useConfigStore.getState();
      const result = await store.refreshConfig();

      expect(apiClient.getConfig).toHaveBeenCalled();
      expect(result).toEqual(mockConfig);
      expect(useConfigStore.getState().config).toEqual(mockConfig);
    });

    it("应该正确处理 API 错误", async () => {
      const error = new Error("API 错误");
      vi.mocked(apiClient.getConfig).mockRejectedValue(error);

      const store = useConfigStore.getState();
      
      await expect(store.getConfig()).rejects.toThrow("API 错误");
      expect(useConfigStore.getState().loading.lastError).toEqual(error);
    });
  });

  describe("MCP 配置更新", () => {
    it("应该正确更新 MCP 端点", async () => {
      const initialConfig: AppConfig = {
        mcpEndpoint: "old-endpoint",
        mcpServers: {},
      };

      const store = useConfigStore.getState();
      store.setConfig(initialConfig);

      vi.mocked(apiClient.updateConfig).mockResolvedValue(undefined);

      await store.updateMcpEndpoint("new-endpoint");

      expect(apiClient.updateConfig).toHaveBeenCalledWith({
        ...initialConfig,
        mcpEndpoint: "new-endpoint",
      });
    });

    it("应该正确更新 MCP 服务器", async () => {
      const initialConfig: AppConfig = {
        mcpEndpoint: "test-endpoint",
        mcpServers: { server1: { command: "old", args: [] } },
      };

      const newServers = { server2: { command: "new", args: ["arg1"] } };

      const store = useConfigStore.getState();
      store.setConfig(initialConfig);

      vi.mocked(apiClient.updateConfig).mockResolvedValue(undefined);

      await store.updateMcpServers(newServers);

      expect(apiClient.updateConfig).toHaveBeenCalledWith({
        ...initialConfig,
        mcpServers: newServers,
      });
    });
  });

  describe("store 重置", () => {
    it("应该能够重置所有状态到初始值", () => {
      const store = useConfigStore.getState();
      
      // 设置一些状态
      store.setConfig({ mcpEndpoint: "test", mcpServers: {} });
      store.setError(new Error("test error"));
      
      // 重置状态
      store.reset();
      
      // 验证状态被重置
      const state = useConfigStore.getState();
      expect(state.config).toBeNull();
      expect(state.loading.lastError).toBeNull();
      expect(state.loading.isLoading).toBe(false);
    });
  });
});

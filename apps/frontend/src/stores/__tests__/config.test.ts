import type { AppConfig } from "@xiaozhi-client/shared-types";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { apiClient } from "@/services/api";
import { useConfigStore } from "../config";

// Mock API client
vi.mock("@/services/api", () => ({
  apiClient: {
    getConfig: vi.fn(),
    updateConfig: vi.fn(),
    reloadConfig: vi.fn(),
    listMCPServers: vi.fn(),
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
      store.setConfig(mockConfig, "http");

      const state = useConfigStore.getState();
      expect(state.config).toEqual(mockConfig);
      expect(state.lastSource).toBe("http");
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

  describe("MCP 服务器状态管理", () => {
    it("refreshMcpServerStatuses 应该刷新状态并同步更新 config.mcpServers", async () => {
      const initialConfig: AppConfig = {
        mcpEndpoint: "test-endpoint",
        mcpServers: {
          oldServer: { command: "old", args: [] },
        },
      };

      const mockServerStatuses = [
        {
          name: "server1",
          status: "connected" as const,
          connected: true,
          tools: ["tool1", "tool2"],
          config: { command: "node", args: ["server1.js"] },
        },
        {
          name: "server2",
          status: "disconnected" as const,
          connected: false,
          tools: [],
          config: { command: "python", args: ["-m", "server2"] },
        },
      ];

      const store = useConfigStore.getState();
      store.setConfig(initialConfig);

      vi.mocked(apiClient.listMCPServers).mockResolvedValue({
        servers: mockServerStatuses,
        total: 2,
      });

      const result = await store.refreshMcpServerStatuses();

      // 验证 API 被调用
      expect(apiClient.listMCPServers).toHaveBeenCalled();

      // 验证返回的状态数据
      expect(result).toEqual(mockServerStatuses);
      expect(useConfigStore.getState().mcpServerStatuses).toEqual(
        mockServerStatuses
      );

      // 验证 config.mcpServers 被同步更新
      const updatedConfig = useConfigStore.getState().config;
      expect(updatedConfig?.mcpServers).toEqual({
        server1: { command: "node", args: ["server1.js"] },
        server2: { command: "python", args: ["-m", "server2"] },
      });

      // 验证其他配置字段保持不变
      expect(updatedConfig?.mcpEndpoint).toBe("test-endpoint");
    });

    it("refreshMcpServerStatuses 在没有 config 时不应该更新 mcpServers", async () => {
      const mockServerStatuses = [
        {
          name: "server1",
          status: "connected" as const,
          connected: true,
          tools: ["tool1"],
          config: { command: "node", args: ["server1.js"] },
        },
      ];

      // 确保 config 为 null
      const store = useConfigStore.getState();
      store.reset();

      vi.mocked(apiClient.listMCPServers).mockResolvedValue({
        servers: mockServerStatuses,
        total: 1,
      });

      await store.refreshMcpServerStatuses();

      // 验证状态被更新
      expect(useConfigStore.getState().mcpServerStatuses).toEqual(
        mockServerStatuses
      );

      // 验证 config 仍为 null
      expect(useConfigStore.getState().config).toBeNull();
    });

    it("refreshMcpServerStatuses 应该正确处理错误", async () => {
      const error = new Error("状态刷新失败");
      vi.mocked(apiClient.listMCPServers).mockRejectedValue(error);

      const store = useConfigStore.getState();

      await expect(store.refreshMcpServerStatuses()).rejects.toThrow(
        "状态刷新失败"
      );

      // 验证状态数据被清空
      expect(useConfigStore.getState().mcpServerStatuses).toEqual([]);
    });
  });
});

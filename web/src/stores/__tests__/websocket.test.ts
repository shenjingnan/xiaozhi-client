import { beforeEach, describe, expect, it } from "vitest";
import type { AppConfig } from "../../types";
import { useWebSocketStore } from "../websocket";

describe("WebSocket Store", () => {
  beforeEach(() => {
    // 重置 store 状态
    useWebSocketStore.getState().reset();
  });

  describe("mcpEndpoint 数据同步", () => {
    it("应该在 setConfig 时同步更新 mcpEndpoint 字段 - 单个端点", () => {
      const mockConfig: AppConfig = {
        mcpEndpoint: "wss://api.xiaozhi.me/mcp/test-endpoint",
        mcpServers: {},
      };

      // 更新 config
      useWebSocketStore.getState().setConfig(mockConfig);

      // 验证 config 和 mcpEndpoint 都被正确更新
      const state = useWebSocketStore.getState();
      expect(state.config).toEqual(mockConfig);
      expect(state.mcpEndpoint).toBe("wss://api.xiaozhi.me/mcp/test-endpoint");
    });

    it("应该在 setConfig 时同步更新 mcpEndpoint 字段 - 多个端点", () => {
      const mockConfig: AppConfig = {
        mcpEndpoint: [
          "wss://api.xiaozhi.me/mcp/endpoint-1",
          "wss://api.xiaozhi.me/mcp/endpoint-2",
        ],
        mcpServers: {},
      };

      // 更新 config
      useWebSocketStore.getState().setConfig(mockConfig);

      // 验证 config 和 mcpEndpoint 都被正确更新
      const state = useWebSocketStore.getState();
      expect(state.config).toEqual(mockConfig);
      expect(state.mcpEndpoint).toEqual([
        "wss://api.xiaozhi.me/mcp/endpoint-1",
        "wss://api.xiaozhi.me/mcp/endpoint-2",
      ]);
    });

    it("应该在 config 为 null 时将 mcpEndpoint 重置为空字符串", () => {
      // 先设置一个有效的 config
      const mockConfig: AppConfig = {
        mcpEndpoint: "wss://api.xiaozhi.me/mcp/test-endpoint",
        mcpServers: {},
      };
      useWebSocketStore.getState().setConfig(mockConfig);

      // 然后设置为 null
      useWebSocketStore.getState().setConfig(null);

      // 验证状态被正确重置
      const state = useWebSocketStore.getState();
      expect(state.config).toBeNull();
      expect(state.mcpEndpoint).toBe("");
    });

    it("store 状态应该正确反映单个 mcpEndpoint 值", () => {
      const mockConfig: AppConfig = {
        mcpEndpoint: "wss://api.xiaozhi.me/mcp/test-endpoint",
        mcpServers: {},
      };

      // 更新 config
      useWebSocketStore.getState().setConfig(mockConfig);

      // 直接从 store 获取值
      const state = useWebSocketStore.getState();
      expect(state.mcpEndpoint).toBe("wss://api.xiaozhi.me/mcp/test-endpoint");
    });

    it("store 状态应该正确反映数组类型的 mcpEndpoint 值", () => {
      const mockConfig: AppConfig = {
        mcpEndpoint: [
          "wss://api.xiaozhi.me/mcp/endpoint-1",
          "wss://api.xiaozhi.me/mcp/endpoint-2",
        ],
        mcpServers: {},
      };

      // 更新 config
      useWebSocketStore.getState().setConfig(mockConfig);

      // 直接从 store 获取值
      const state = useWebSocketStore.getState();
      expect(state.mcpEndpoint).toEqual([
        "wss://api.xiaozhi.me/mcp/endpoint-1",
        "wss://api.xiaozhi.me/mcp/endpoint-2",
      ]);
    });

    it("setMcpEndpoint 方法应该能直接更新 mcpEndpoint 字段", () => {
      const testEndpoint = "wss://api.xiaozhi.me/mcp/direct-update";

      // 直接更新 mcpEndpoint
      useWebSocketStore.getState().setMcpEndpoint(testEndpoint);

      // 验证更新结果
      const state = useWebSocketStore.getState();
      expect(state.mcpEndpoint).toBe(testEndpoint);
    });

    it("setMcpEndpoint 方法应该支持数组类型", () => {
      const testEndpoints = [
        "wss://api.xiaozhi.me/mcp/endpoint-1",
        "wss://api.xiaozhi.me/mcp/endpoint-2",
      ];

      // 直接更新 mcpEndpoint
      useWebSocketStore.getState().setMcpEndpoint(testEndpoints);

      // 验证更新结果
      const state = useWebSocketStore.getState();
      expect(state.mcpEndpoint).toEqual(testEndpoints);
    });
  });
});

/**
 * ConfigRoutes 测试
 * 测试配置路由处理器的功能
 */

import { Hono } from "hono";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AppConfig } from "../../configManager.js";
import { ConfigRoutes } from "./ConfigRoutes.js";

// Mock configManager
vi.mock("../../configManager.js", () => ({
  configManager: {
    getConfig: vi.fn(),
    getMcpEndpoint: vi.fn(),
    updateMcpEndpoint: vi.fn(),
    getMcpServers: vi.fn(),
    updateMcpServer: vi.fn(),
    removeMcpServer: vi.fn(),
    removeServerToolsConfig: vi.fn(),
    updateConnectionConfig: vi.fn(),
    updateModelScopeConfig: vi.fn(),
    updateWebUIConfig: vi.fn(),
    setToolEnabled: vi.fn(),
  },
}));

// Mock logger
vi.mock("../../Logger.js", () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
}));

describe("ConfigRoutes", () => {
  let configRoutes: ConfigRoutes;
  let app: Hono;
  let mockBroadcastCallback: ReturnType<typeof vi.fn>;
  let mockConfigManager: any;

  beforeEach(async () => {
    configRoutes = new ConfigRoutes();
    app = new Hono();
    mockBroadcastCallback = vi.fn();

    // 获取 mock configManager 引用
    const configManagerModule = await import("../../configManager.js");
    mockConfigManager = configManagerModule.configManager;

    // 设置广播回调
    configRoutes.setBroadcastCallback(mockBroadcastCallback);

    // 注册路由
    configRoutes.register(app);

    // 重置所有 mock
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("GET /api/config", () => {
    it("应该成功返回配置", async () => {
      const mockConfig: AppConfig = {
        mcpEndpoint: "http://localhost:3000",
        mcpServers: {},
        connection: {},
        modelscope: {},
        webUI: {},
        mcpServerConfig: {},
      };

      mockConfigManager.getConfig.mockReturnValue(mockConfig);

      const req = new Request("http://localhost/api/config", {
        method: "GET",
      });

      const res = await app.request(req);
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data).toEqual(mockConfig);
      expect(mockConfigManager.getConfig).toHaveBeenCalledTimes(1);
    });

    it("应该处理获取配置时的错误", async () => {
      const error = new Error("配置获取失败");
      mockConfigManager.getConfig.mockImplementation(() => {
        throw error;
      });

      const req = new Request("http://localhost/api/config", {
        method: "GET",
      });

      const res = await app.request(req);
      const data = await res.json();

      expect(res.status).toBe(500);
      expect(data).toEqual({ error: "配置获取失败" });
    });
  });

  describe("PUT /api/config", () => {
    it("应该成功更新配置", async () => {
      const newConfig: AppConfig = {
        mcpEndpoint: "http://localhost:4000",
        mcpServers: {
          "test-server": {
            command: "test",
            args: [],
          },
        },
        connection: {},
        modelscope: {},
        webUI: {},
        mcpServerConfig: {},
      };

      mockConfigManager.getMcpEndpoint.mockReturnValue("http://localhost:3000");
      mockConfigManager.getMcpServers.mockReturnValue({});

      const req = new Request("http://localhost/api/config", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(newConfig),
      });

      const res = await app.request(req);
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data).toEqual({ success: true });
      expect(mockConfigManager.updateMcpEndpoint).toHaveBeenCalledWith(
        "http://localhost:4000"
      );
      expect(mockBroadcastCallback).toHaveBeenCalledWith(newConfig);
    });

    it("应该处理无效的配置格式", async () => {
      const req = new Request("http://localhost/api/config", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(null),
      });

      const res = await app.request(req);
      const data = await res.json();

      expect(res.status).toBe(400);
      expect(data).toEqual({ error: "无效的配置格式" });
    });

    it("应该处理 JSON 解析错误", async () => {
      const req = new Request("http://localhost/api/config", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: "invalid json",
      });

      const res = await app.request(req);
      const data = await res.json();

      expect(res.status).toBe(400);
      expect(data.error).toBeDefined();
    });

    it("应该处理配置更新过程中的错误", async () => {
      const newConfig: AppConfig = {
        mcpEndpoint: "http://localhost:4000",
        mcpServers: {},
        connection: {},
        modelscope: {},
        webUI: {},
        mcpServerConfig: {},
      };

      mockConfigManager.getMcpEndpoint.mockImplementation(() => {
        throw new Error("配置更新失败");
      });

      const req = new Request("http://localhost/api/config", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(newConfig),
      });

      const res = await app.request(req);
      const data = await res.json();

      expect(res.status).toBe(400);
      expect(data).toEqual({ error: "配置更新失败" });
    });
  });

  describe("配置更新逻辑", () => {
    it("应该更新 MCP 端点", async () => {
      const newConfig: AppConfig = {
        mcpEndpoint: "http://localhost:5000",
        mcpServers: {},
        connection: {},
        modelscope: {},
        webUI: {},
        mcpServerConfig: {},
      };

      mockConfigManager.getMcpEndpoint.mockReturnValue("http://localhost:3000");
      mockConfigManager.getMcpServers.mockReturnValue({});

      const req = new Request("http://localhost/api/config", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(newConfig),
      });

      await app.request(req);

      expect(mockConfigManager.updateMcpEndpoint).toHaveBeenCalledWith(
        "http://localhost:5000"
      );
    });

    it("应该添加新的 MCP 服务", async () => {
      const newConfig: AppConfig = {
        mcpEndpoint: "http://localhost:3000",
        mcpServers: {
          "new-server": {
            command: "new-command",
            args: ["--arg1"],
          },
        },
        connection: {},
        modelscope: {},
        webUI: {},
        mcpServerConfig: {},
      };

      mockConfigManager.getMcpEndpoint.mockReturnValue("http://localhost:3000");
      mockConfigManager.getMcpServers.mockReturnValue({});

      const req = new Request("http://localhost/api/config", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(newConfig),
      });

      await app.request(req);

      expect(mockConfigManager.updateMcpServer).toHaveBeenCalledWith(
        "new-server",
        {
          command: "new-command",
          args: ["--arg1"],
        }
      );
    });

    it("应该删除不存在的 MCP 服务", async () => {
      const newConfig: AppConfig = {
        mcpEndpoint: "http://localhost:3000",
        mcpServers: {},
        connection: {},
        modelscope: {},
        webUI: {},
        mcpServerConfig: {},
      };

      mockConfigManager.getMcpEndpoint.mockReturnValue("http://localhost:3000");
      mockConfigManager.getMcpServers.mockReturnValue({
        "old-server": {
          command: "old-command",
          args: [],
        },
      });

      const req = new Request("http://localhost/api/config", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(newConfig),
      });

      await app.request(req);

      expect(mockConfigManager.removeMcpServer).toHaveBeenCalledWith(
        "old-server"
      );
      expect(mockConfigManager.removeServerToolsConfig).toHaveBeenCalledWith(
        "old-server"
      );
    });
  });

  describe("setBroadcastCallback", () => {
    it("应该正确设置广播回调", async () => {
      const newCallback = vi.fn();
      configRoutes.setBroadcastCallback(newCallback);

      // 通过更新配置来测试回调是否被设置
      const newConfig: AppConfig = {
        mcpEndpoint: "http://localhost:3000",
        mcpServers: {},
        connection: {},
        modelscope: {},
        webUI: {},
        mcpServerConfig: {},
      };

      mockConfigManager.getMcpEndpoint.mockReturnValue("http://localhost:3000");
      mockConfigManager.getMcpServers.mockReturnValue({});

      const req = new Request("http://localhost/api/config", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(newConfig),
      });

      const response = await app.request(req);
      expect(response.status).toBe(200);
      expect(newCallback).toHaveBeenCalledWith(newConfig);
    });
  });
});

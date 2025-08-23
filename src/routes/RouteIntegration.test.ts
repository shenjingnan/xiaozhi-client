/**
 * 路由集成测试
 * 测试路由模块与 RouteManager 的协作
 */

import { Hono } from "hono";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AppConfig } from "../configManager.js";
import { RouteManager } from "./RouteManager.js";
import { StaticRoutes } from "./StaticRoutes.js";
import { ConfigRoutes } from "./api/ConfigRoutes.js";
import { StatusRoutes } from "./api/StatusRoutes.js";

// Mock configManager
vi.mock("../configManager.js", () => ({
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
vi.mock("../Logger.js", () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
}));

// Mock 文件系统
vi.mock("node:fs", () => ({
  existsSync: vi.fn().mockReturnValue(false),
}));

vi.mock("node:fs/promises", () => ({
  readFile: vi.fn(),
}));

vi.mock("node:path", () => ({
  dirname: vi.fn().mockReturnValue("/mock/src/routes"),
  join: vi.fn((...args) => args.join("/")),
}));

vi.mock("node:url", () => ({
  fileURLToPath: vi.fn().mockReturnValue("/mock/src/routes/StaticRoutes.js"),
}));

describe("路由集成测试", () => {
  let routeManager: RouteManager;
  let app: Hono;
  let configRoutes: ConfigRoutes;
  let statusRoutes: StatusRoutes;
  let staticRoutes: StaticRoutes;
  let mockConfigManager: any;

  beforeEach(async () => {
    routeManager = new RouteManager();
    app = new Hono();

    configRoutes = new ConfigRoutes();
    statusRoutes = new StatusRoutes();
    staticRoutes = new StaticRoutes();

    // 获取 mock configManager 引用
    const configManagerModule = await import("../configManager.js");
    mockConfigManager = configManagerModule.configManager;

    // 设置回调
    configRoutes.setBroadcastCallback(vi.fn());
    statusRoutes.setMCPStatusCallback(
      vi.fn().mockReturnValue({
        connected: true,
        endpoint: "http://localhost:3000",
      })
    );

    // 添加路由处理器到管理器
    routeManager.addRouteHandler(configRoutes);
    routeManager.addRouteHandler(statusRoutes);
    routeManager.addRouteHandler(staticRoutes);

    // 注册所有路由
    routeManager.registerRoutes(app);

    // 重置所有 mock
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("RouteManager 集成", () => {
    it("应该正确注册所有路由处理器", () => {
      expect(routeManager.getHandlerCount()).toBe(3);
      expect(routeManager.hasHandler(ConfigRoutes)).toBe(true);
      expect(routeManager.hasHandler(StatusRoutes)).toBe(true);
      expect(routeManager.hasHandler(StaticRoutes)).toBe(true);
    });

    it("应该能够清空所有路由处理器", () => {
      routeManager.clearHandlers();
      expect(routeManager.getHandlerCount()).toBe(0);
    });
  });

  describe("配置路由集成测试", () => {
    it("应该通过 RouteManager 正确处理配置获取请求", async () => {
      const mockConfig: AppConfig = {
        mcpEndpoint: "http://localhost:3000",
        mcpServers: {
          "test-server": {
            command: "test-command",
            args: ["--test"],
          },
        },
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
    });

    it("应该通过 RouteManager 正确处理配置更新请求", async () => {
      const newConfig: AppConfig = {
        mcpEndpoint: "http://localhost:4000",
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

      const res = await app.request(req);
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data).toEqual({ success: true });
      expect(mockConfigManager.updateMcpEndpoint).toHaveBeenCalledWith(
        "http://localhost:4000"
      );
    });
  });

  describe("状态路由集成测试", () => {
    it("应该通过 RouteManager 正确处理状态查询请求", async () => {
      const req = new Request("http://localhost/api/status", {
        method: "GET",
      });

      const res = await app.request(req);
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data).toHaveProperty("status");
      expect(data).toHaveProperty("mcpEndpoint");
      expect(data).toHaveProperty("activeMCPServers");
      expect(data).toHaveProperty("mcpConnection");
      expect(data.mcpConnection).toEqual({
        connected: true,
        endpoint: "http://localhost:3000",
      });
    });
  });

  describe("静态文件路由集成测试", () => {
    it("应该通过 RouteManager 正确处理未知 API 路由", async () => {
      const req = new Request("http://localhost/api/unknown", {
        method: "GET",
      });

      const res = await app.request(req);
      const text = await res.text();

      expect(res.status).toBe(404);
      expect(text).toBe("Not Found");
    });

    it("应该通过 RouteManager 正确处理静态文件请求", async () => {
      const req = new Request("http://localhost/", {
        method: "GET",
      });

      const res = await app.request(req);
      const html = await res.text();

      expect(res.status).toBe(200);
      expect(html).toContain("小智配置管理");
    });
  });

  describe("路由优先级测试", () => {
    it("API 路由应该优先于静态文件路由", async () => {
      // 测试 /api/config 不会被静态文件路由处理
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
      // 不应该返回 HTML 内容
      expect(typeof data).toBe("object");
    });

    it("未知 API 路由应该返回 404 而不是静态文件", async () => {
      const req = new Request("http://localhost/api/nonexistent", {
        method: "GET",
      });

      const res = await app.request(req);
      const text = await res.text();

      expect(res.status).toBe(404);
      expect(text).toBe("Not Found");
      // 不应该返回 HTML 错误页面
      expect(text).not.toContain("小智配置管理");
    });
  });

  describe("错误处理集成测试", () => {
    it("应该正确处理配置路由中的错误", async () => {
      mockConfigManager.getConfig.mockImplementation(() => {
        throw new Error("配置读取失败");
      });

      const req = new Request("http://localhost/api/config", {
        method: "GET",
      });

      const res = await app.request(req);
      const data = await res.json();

      expect(res.status).toBe(500);
      expect(data).toEqual({ error: "配置读取失败" });
    });

    it("应该正确处理状态路由中的错误", async () => {
      statusRoutes.setMCPStatusCallback(() => {
        throw new Error("状态获取失败");
      });

      const req = new Request("http://localhost/api/status", {
        method: "GET",
      });

      const res = await app.request(req);
      const data = await res.json();

      expect(res.status).toBe(500);
      expect(data).toEqual({ error: "状态获取失败" });
    });
  });

  describe("多个路由处理器协作测试", () => {
    it("应该能够同时处理多个不同类型的请求", async () => {
      // 设置配置 mock
      const mockConfig: AppConfig = {
        mcpEndpoint: "http://localhost:3000",
        mcpServers: {},
        connection: {},
        modelscope: {},
        webUI: {},
        mcpServerConfig: {},
      };
      mockConfigManager.getConfig.mockReturnValue(mockConfig);

      // 并发发送多个请求
      const requests = [
        app.request(
          new Request("http://localhost/api/config", { method: "GET" })
        ),
        app.request(
          new Request("http://localhost/api/status", { method: "GET" })
        ),
        app.request(
          new Request("http://localhost/api/unknown", { method: "GET" })
        ),
        app.request(new Request("http://localhost/", { method: "GET" })),
      ];

      const responses = await Promise.all(requests);

      // 验证配置请求
      expect(responses[0].status).toBe(200);
      const configData = await responses[0].json();
      expect(configData).toEqual(mockConfig);

      // 验证状态请求
      expect(responses[1].status).toBe(200);
      const statusData = await responses[1].json();
      expect(statusData).toHaveProperty("status");

      // 验证未知 API 请求
      expect(responses[2].status).toBe(404);
      const unknownText = await responses[2].text();
      expect(unknownText).toBe("Not Found");

      // 验证静态文件请求
      expect(responses[3].status).toBe(200);
      const staticHtml = await responses[3].text();
      expect(staticHtml).toContain("小智配置管理");
    });
  });
});

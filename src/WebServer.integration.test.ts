/**
 * WebServer 集成测试
 * 测试整合后的 WebServer 功能
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { WebServer } from "./WebServer.js";
import type { AppConfig } from "./configManager.js";

// Mock configManager
vi.mock("./configManager.js", () => ({
  configManager: {
    getConfig: vi.fn(),
    getWebUIPort: vi.fn(),
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
vi.mock("./Logger.js", () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    withTag: vi.fn().mockReturnValue({
      debug: vi.fn(),
      info: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
    }),
  },
}));

// Mock ProxyMCPServer
vi.mock("./ProxyMCPServer.js", () => ({
  ProxyMCPServer: vi.fn(),
}));

// Mock services
vi.mock("./services/MCPServiceManagerSingleton.js", () => ({
  MCPServiceManagerSingleton: {
    getInstance: vi.fn().mockReturnValue({
      getStatus: vi.fn().mockResolvedValue({ running: false }),
    }),
  },
}));

vi.mock("./services/XiaozhiConnectionManagerSingleton.js", () => ({
  XiaozhiConnectionManagerSingleton: {
    getInstance: vi.fn().mockReturnValue({
      selectBestConnection: vi.fn().mockReturnValue(null),
    }),
  },
}));

// Mock createContainer
vi.mock("./cli/Container.js", () => ({
  createContainer: vi.fn().mockResolvedValue({
    get: vi.fn().mockReturnValue({
      getStatus: vi.fn().mockResolvedValue({
        running: true,
        mode: "daemon",
      }),
    }),
  }),
}));

// Mock child_process
vi.mock("node:child_process", () => ({
  spawn: vi.fn().mockReturnValue({
    unref: vi.fn(),
  }),
}));

describe("WebServer 集成测试", () => {
  let webServer: WebServer;
  let mockConfigManager: any;

  beforeEach(async () => {
    // 获取 mock configManager 引用
    const configManagerModule = await import("./configManager.js");
    mockConfigManager = configManagerModule.configManager;

    // 设置默认的 mock 返回值
    mockConfigManager.getWebUIPort.mockReturnValue(9999);
    mockConfigManager.getConfig.mockReturnValue({
      mcpEndpoint: "http://localhost:3000",
      mcpServers: {},
      connection: {},
      modelscope: {},
      webUI: {},
      mcpServerConfig: {},
    });

    webServer = new WebServer(9999);

    // 重置所有 mock
    vi.clearAllMocks();
  });

  afterEach(async () => {
    if (webServer) {
      await webServer.stop();
    }
    vi.clearAllMocks();
  });

  describe("构造函数和初始化", () => {
    it("应该正确初始化 WebServer", () => {
      expect(webServer).toBeDefined();
      expect(mockConfigManager.getWebUIPort).toHaveBeenCalled();
    });

    it("应该使用默认端口当配置读取失败时", () => {
      mockConfigManager.getWebUIPort.mockImplementation(() => {
        throw new Error("配置读取失败");
      });

      const server = new WebServer();
      expect(server).toBeDefined();
    });
  });

  describe("HTTP 路由集成", () => {
    it("应该能够处理配置获取请求", async () => {
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

      // 启动服务器
      await webServer.start();

      // 发送 HTTP 请求
      const response = await fetch("http://localhost:9999/api/config");
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toEqual(mockConfig);

      await webServer.stop();
    });

    it("应该能够处理状态获取请求", async () => {
      // 启动服务器
      await webServer.start();

      // 发送 HTTP 请求
      const response = await fetch("http://localhost:9999/api/status");
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toHaveProperty("status");
      expect(data).toHaveProperty("mcpEndpoint");
      expect(data).toHaveProperty("activeMCPServers");

      await webServer.stop();
    });

    it("应该能够处理配置更新请求", async () => {
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

      // 启动服务器
      await webServer.start();

      // 发送 HTTP 请求
      const response = await fetch("http://localhost:9999/api/config", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(newConfig),
      });

      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toEqual({ success: true });

      await webServer.stop();
    });
  });

  describe("WebSocket 消息处理集成", () => {
    it("应该能够处理 WebSocket 连接", async () => {
      // 启动服务器
      await webServer.start();

      // 创建 WebSocket 连接
      const ws = new WebSocket("ws://localhost:9999");

      await new Promise((resolve, reject) => {
        ws.onopen = () => {
          resolve(undefined);
        };
        ws.onerror = (error) => {
          reject(error);
        };
        setTimeout(() => reject(new Error("连接超时")), 5000);
      });

      expect(ws.readyState).toBe(WebSocket.OPEN);

      ws.close();
      await webServer.stop();
    });

    it("应该能够处理配置获取 WebSocket 消息", async () => {
      const mockConfig: AppConfig = {
        mcpEndpoint: "http://localhost:3000",
        mcpServers: {},
        connection: {},
        modelscope: {},
        webUI: {},
        mcpServerConfig: {},
      };

      mockConfigManager.getConfig.mockReturnValue(mockConfig);

      // 启动服务器
      await webServer.start();

      // 创建 WebSocket 连接
      const ws = new WebSocket("ws://localhost:9999");

      await new Promise((resolve, reject) => {
        ws.onopen = () => {
          // 发送获取配置消息
          ws.send(JSON.stringify({ type: "getConfig" }));
        };

        ws.onmessage = (event) => {
          const data = JSON.parse(event.data);
          if (data.type === "config") {
            expect(data.data).toEqual(mockConfig);
            resolve(undefined);
          }
        };

        ws.onerror = (error) => {
          reject(error);
        };

        setTimeout(() => reject(new Error("消息超时")), 5000);
      });

      ws.close();
      await webServer.stop();
    });
  });

  describe("状态管理集成", () => {
    it("应该能够更新客户端状态", () => {
      const statusInfo = {
        status: "connected" as const,
        mcpEndpoint: "http://localhost:5000",
        activeMCPServers: ["server1", "server2"],
      };

      webServer.updateStatus(statusInfo);

      // 验证状态更新不会抛出错误
      expect(() => webServer.updateStatus(statusInfo)).not.toThrow();
    });
  });

  describe("错误处理集成", () => {
    it("应该正确处理配置获取错误", async () => {
      mockConfigManager.getConfig.mockImplementation(() => {
        throw new Error("配置读取失败");
      });

      // 启动服务器
      await webServer.start();

      // 发送 HTTP 请求
      const response = await fetch("http://localhost:9999/api/config");
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data).toHaveProperty("error");

      await webServer.stop();
    });
  });

  describe("服务器生命周期", () => {
    it("应该能够正常启动和停止服务器", async () => {
      await expect(webServer.start()).resolves.not.toThrow();
      await expect(webServer.stop()).resolves.not.toThrow();
    });

    it("应该防止重复启动", async () => {
      await webServer.start();

      // 尝试再次启动应该不会抛出错误
      await expect(webServer.start()).resolves.not.toThrow();

      await webServer.stop();
    });

    it("应该能够处理停止未启动的服务器", async () => {
      // 停止未启动的服务器应该不会抛出错误
      await expect(webServer.stop()).resolves.not.toThrow();
    });
  });
});

/**
 * 阶段三统一 MCP 服务器集成测试
 * 验证 UnifiedMCPServer、ServerFactory 和重构后的服务器功能
 */

import { MCPServer } from "@services/MCPServer.js";
import request from "supertest";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import type { AppConfig } from "../../configManager.js";
import {
  ServerMode,
  createHTTPServer,
  createHybridServer,
  createWebSocketServer,
  getRecommendedConfig,
  validateConfig,
} from "../ServerFactory.js";
import { UnifiedMCPServer } from "../UnifiedMCPServer.js";

// Mock logger
vi.mock("../../Logger.js", () => {
  const mockLogger = {
    info: vi.fn(),
    debug: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    trace: vi.fn(),
    fatal: vi.fn(),
    withTag: vi.fn().mockReturnThis(),
    child: vi.fn().mockReturnThis(),
  };

  return {
    Logger: vi.fn().mockImplementation(() => mockLogger),
    logger: mockLogger,
    createLogger: vi.fn(() => mockLogger),
    getLogger: vi.fn(() => mockLogger),
    setGlobalLogger: vi.fn(),
    setGlobalLogLevel: vi.fn(),
    getGlobalLogLevel: vi.fn(() => "info"),
  };
});

// Mock configManager
vi.mock("../../configManager.js", async () => {
  const actual = await vi.importActual("../../configManager.js");
  return {
    ...actual,
    configManager: {
      getConfig: vi.fn(),
      getMcpServers: vi.fn(),
      getServerToolsConfig: vi.fn(),
      getCustomMCPTools: vi.fn(),
      addCustomMCPTools: vi.fn(),
      getCustomMCPConfig: vi.fn(),
      updateCustomMCPTools: vi.fn(),
      isToolEnabled: vi.fn(),
      getToolCallLogConfig: vi.fn(),
      getConfigDir: vi.fn(),
      configExists: vi.fn().mockReturnValue(true),
    },
  };
});

// 获取被 mock 的 configManager
const { configManager: mockConfigManager } = await import(
  "../../configManager.js"
);

// 测试用的配置数据
const testConfig: AppConfig = {
  mcpEndpoint: "http://localhost:3000",
  mcpServers: {
    "test-server": {
      command: "node",
      args: ["test.js"],
      env: { TEST_VAR: "test_value" },
    },
  },
  mcpServerConfig: {
    "test-server": {
      tools: {
        "test-tool": {
          description: "Test tool description",
          enable: true,
        },
      },
    },
  },
  connection: {
    heartbeatInterval: 30000,
    heartbeatTimeout: 10000,
    reconnectInterval: 5000,
  },
  webUI: {
    port: 3001,
    autoRestart: true,
  },
};

describe("阶段三统一 MCP 服务器集成测试", () => {
  describe("UnifiedMCPServer 核心功能", () => {
    let server: UnifiedMCPServer;

    beforeEach(async () => {
      // 设置 configManager mock 返回值
      vi.mocked(mockConfigManager.getConfig).mockReturnValue(testConfig);
      vi.mocked(mockConfigManager.getMcpServers).mockReturnValue(
        testConfig.mcpServers
      );
      vi.mocked(mockConfigManager.getServerToolsConfig).mockReturnValue(
        testConfig.mcpServerConfig?.["test-server"]?.tools || {}
      );
      vi.mocked(mockConfigManager.getCustomMCPTools).mockReturnValue([]);
      vi.mocked(mockConfigManager.getCustomMCPConfig).mockReturnValue(null);
      vi.mocked(mockConfigManager.updateCustomMCPTools).mockResolvedValue(
        undefined
      );
      vi.mocked(mockConfigManager.addCustomMCPTools).mockResolvedValue(
        undefined
      );
      vi.mocked(mockConfigManager.isToolEnabled).mockReturnValue(true);
      vi.mocked(mockConfigManager.getToolCallLogConfig).mockReturnValue({});
      vi.mocked(mockConfigManager.getConfigDir).mockReturnValue("/tmp/test");

      server = new UnifiedMCPServer({
        name: "test-unified-server",
      });
      await server.initialize();
    });

    afterEach(async () => {
      if (server) {
        await server.stop();
      }
    });

    test("应该正确初始化和启动", async () => {
      expect(server.isServerRunning()).toBe(false);

      const status = server.getStatus();
      expect(status.isRunning).toBe(false);
      expect(status.transportCount).toBe(0);
      expect(status.activeConnections).toBe(0);
      expect(status.config.name).toBe("test-unified-server");
    });

    test("应该正确管理传输适配器", async () => {
      const httpConfig = {
        name: "test-http",
        port: 3000 + Math.floor(Math.random() * 1000),
        host: "localhost",
      };

      const httpAdapter = await createHTTPServer(httpConfig);
      const messageHandler = server.getMessageHandler();

      expect(messageHandler).toBeDefined();
      expect(server.getServiceManager()).toBeDefined();
      expect(server.getToolRegistry()).toBeDefined();
      expect(server.getConnectionManager()).toBeDefined();
    });

    test("应该正确处理事件", async () => {
      let startedEventFired = false;
      let stoppedEventFired = false;

      server.on("started", () => {
        startedEventFired = true;
      });

      server.on("stopped", () => {
        stoppedEventFired = true;
      });

      // 由于没有传输适配器，start 会成功但没有实际服务
      await server.start();
      expect(startedEventFired).toBe(true);

      await server.stop();
      expect(stoppedEventFired).toBe(true);
    });
  });

  describe("ServerFactory 功能", () => {
    let server: UnifiedMCPServer;

    afterEach(async () => {
      if (server) {
        await server.stop();
      }
    });

    test("应该创建 HTTP 模式服务器", async () => {
      const port = 3000 + Math.floor(Math.random() * 1000);

      server = await createHTTPServer({
        name: "test-http-factory",
        port,
        host: "localhost",
      });

      expect(server).toBeDefined();
      expect(server.getStatus().transportCount).toBe(1);

      await server.start();
      expect(server.isServerRunning()).toBe(true);

      // 测试 HTTP 端点
      const response = await request(`http://localhost:${port}`)
        .post("/rpc")
        .send({
          jsonrpc: "2.0",
          method: "ping",
          id: 1,
        });

      expect(response.status).toBe(200);
      expect(response.body.jsonrpc).toBe("2.0");
      expect(response.body.result).toBeDefined();
      expect(response.body.result.status).toBe("ok");
    });

    test("应该创建混合模式服务器", async () => {
      const port = 3000 + Math.floor(Math.random() * 1000);

      server = await createHybridServer(
        { name: "test-stdio" },
        { name: "test-http", port, host: "localhost" }
      );

      expect(server).toBeDefined();
      expect(server.getStatus().transportCount).toBe(2);

      await server.start();
      expect(server.isServerRunning()).toBe(true);

      // 测试 HTTP 端点
      const response = await request(`http://localhost:${port}`).get("/status");

      expect(response.status).toBe(200);
      expect(response.body.status).toBe("ok");
      expect(response.body.mode).toBe("mcp-server"); // 从用户角度看，这是 MCP 服务器的状态
    });

    test("应该创建 WebSocket 模式服务器", async () => {
      const port = 8000 + Math.floor(Math.random() * 1000);

      server = await createWebSocketServer({
        name: "test-websocket-factory",
        endpointUrl: `ws://localhost:${port}`,
        mode: "server",
        compression: true,
      });

      expect(server).toBeDefined();
      expect(server.getStatus().transportCount).toBe(1);

      await server.start();
      expect(server.isServerRunning()).toBe(true);

      // 验证 WebSocket 适配器状态
      const status = server.getStatus();
      expect(status.isRunning).toBe(true);
    });

    test("应该根据环境自动选择模式", async () => {
      // 设置环境变量
      const originalMode = process.env.MCP_SERVER_MODE;
      process.env.MCP_SERVER_MODE = "http";

      try {
        const config = await getRecommendedConfig();
        expect(config.mode).toBe(ServerMode.HTTP);
      } finally {
        // 恢复环境变量
        if (originalMode !== undefined) {
          process.env.MCP_SERVER_MODE = originalMode;
        } else {
          process.env.MCP_SERVER_MODE = undefined;
        }
      }
    });

    test("应该验证配置", () => {
      // 有效配置
      expect(() => {
        validateConfig({
          mode: ServerMode.HTTP,
          httpConfig: { name: "test", port: 3000 },
        });
      }).not.toThrow();

      // 无效端口
      expect(() => {
        validateConfig({
          mode: ServerMode.HTTP,
          httpConfig: { name: "test", port: 70000 },
        });
      }).toThrow("无效的端口号");

      // 无效编码
      expect(() => {
        validateConfig({
          mode: ServerMode.STDIO,
          stdioConfig: { name: "test", encoding: "invalid" as any },
        });
      }).toThrow("不支持的编码");

      // 有效 WebSocket 配置
      expect(() => {
        validateConfig({
          mode: ServerMode.WEBSOCKET,
          websocketConfig: {
            name: "test",
            endpointUrl: "ws://localhost:8080",
            mode: "client",
          },
        });
      }).not.toThrow();

      // 无效 WebSocket URL
      expect(() => {
        validateConfig({
          mode: ServerMode.WEBSOCKET,
          websocketConfig: {
            name: "test",
            endpointUrl: "invalid-url",
          },
        });
      }).toThrow("无效的 WebSocket 端点URL");

      // 无效批处理大小
      expect(() => {
        validateConfig({
          mode: ServerMode.WEBSOCKET,
          websocketConfig: {
            name: "test",
            endpointUrl: "ws://localhost:8080",
            batchSize: 0,
          },
        });
      }).toThrow("无效的批处理大小");
    });
  });

  describe("重构后的 MCPServer 兼容性", () => {
    let server: MCPServer;
    let port: number;

    beforeEach(() => {
      port = 3000 + Math.floor(Math.random() * 1000);
      server = new MCPServer(port);
    });

    afterEach(async () => {
      if (server) {
        await server.stop();
      }
    });

    test("应该保持向后兼容的 API", async () => {
      // 测试启动
      await server.start();
      expect(server.isRunning()).toBe(true);

      // 测试状态获取
      const status = server.getStatus();
      expect(status).toBeDefined();
      expect(status.port).toBe(port);
      expect(status.mode).toBe("mcp-server");

      // 测试服务管理器获取
      const serviceManager = server.getServiceManager();
      expect(serviceManager).toBeDefined();

      // 测试消息处理器获取
      const messageHandler = server.getMessageHandler();
      expect(messageHandler).toBeDefined();
    });

    test("应该正确处理 HTTP 请求", async () => {
      await server.start();

      // 测试 ping 请求
      const pingResponse = await request(`http://localhost:${port}`)
        .post("/rpc")
        .send({
          jsonrpc: "2.0",
          method: "ping",
          id: 1,
        });

      expect(pingResponse.status).toBe(200);
      expect(pingResponse.body.jsonrpc).toBe("2.0");
      expect(pingResponse.body.result.status).toBe("ok");

      // 测试状态端点
      const statusResponse = await request(`http://localhost:${port}`).get(
        "/status"
      );

      expect(statusResponse.status).toBe(200);
      expect(statusResponse.body.status).toBe("ok");
      expect(statusResponse.body.mode).toBe("mcp-server"); // 从用户角度看，这是 MCP 服务器的状态
    });

    test("应该正确处理 SSE 连接", async () => {
      await server.start();

      const response = await request(`http://localhost:${port}`)
        .get("/sse")
        .timeout(1000)
        .buffer(false)
        .expect(200);

      expect(response.headers["content-type"]).toContain("text/event-stream");
      expect(response.headers["cache-control"]).toContain("no-cache");
    });

    test("性能测试：响应时间应该保持优秀", async () => {
      await server.start();

      const startTime = Date.now();

      const response = await request(`http://localhost:${port}`)
        .post("/rpc")
        .send({
          jsonrpc: "2.0",
          method: "ping",
          id: 1,
        });

      const endTime = Date.now();
      const responseTime = endTime - startTime;

      expect(response.status).toBe(200);
      expect(responseTime).toBeLessThan(100); // 响应时间应该小于 100ms

      console.log(`重构后 MCPServer 响应时间: ${responseTime}ms`);
    });
  });

  describe("端到端集成测试", () => {
    test("多种传输协议应该能同时工作", async () => {
      const port = 3000 + Math.floor(Math.random() * 1000);

      // 创建混合模式服务器
      const unifiedServer = await createHybridServer(
        { name: "e2e-stdio" },
        { name: "e2e-http", port, host: "localhost" }
      );

      try {
        await unifiedServer.start();

        // 验证服务器状态
        const status = unifiedServer.getStatus();
        expect(status.isRunning).toBe(true);
        expect(status.transportCount).toBe(2);

        // 测试 HTTP 传输
        const httpResponse = await request(`http://localhost:${port}`)
          .post("/rpc")
          .send({
            jsonrpc: "2.0",
            method: "initialize",
            params: {
              protocolVersion: "2024-11-05",
              capabilities: {},
              clientInfo: { name: "test-client", version: "1.0.0" },
            },
            id: 1,
          });

        expect(httpResponse.status).toBe(200);
        expect(httpResponse.body.result.serverInfo.name).toBe(
          "xiaozhi-mcp-server"
        );

        // 测试工具列表
        const toolsResponse = await request(`http://localhost:${port}`)
          .post("/rpc")
          .send({
            jsonrpc: "2.0",
            method: "tools/list",
            id: 2,
          });

        expect(toolsResponse.status).toBe(200);
        expect(Array.isArray(toolsResponse.body.result.tools)).toBe(true);
      } finally {
        await unifiedServer.stop();
      }
    });
  });
});

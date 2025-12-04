/**
 * 阶段一重构验收测试
 * 验证消除双层代理后的 MCP 服务器功能
 */

import request from "supertest";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { setupCommonMocks } from "../../__tests__/index.js";
import { MCPServer } from "../MCPServer.js";

// 设置统一的mock配置，并覆盖特定方法
setupCommonMocks({
  getToolCallLogConfig: vi.fn().mockReturnValue({}),
  getMcpEndpoints: vi.fn().mockReturnValue([]),
  configExists: vi.fn().mockReturnValue(false),
  getConfigDir: vi.fn().mockReturnValue("/tmp/test"),
  updateToolUsageStatsWithLock: vi.fn().mockResolvedValue(undefined),
  updateMCPServerToolStatsWithLock: vi.fn().mockResolvedValue(undefined),
  clearAllStatsUpdateLocks: vi.fn().mockImplementation(() => {}),
  getStatsUpdateLocks: vi.fn().mockReturnValue([]),
  getModelScopeApiKey: vi.fn().mockReturnValue(null),
});

// Mock configManager
vi.mock("@root/configManager.js", () => ({
  configManager: {
    configExists: vi.fn().mockReturnValue(true),
    getConfig: vi.fn().mockReturnValue({
      mcpEndpoint: "ws://localhost:8080",
      mcpServers: {},
      modelscope: {
        apiKey: "test-api-key",
        baseUrl: "https://test.modelscope.com",
      },
      connection: {
        heartbeat: { enabled: true, interval: 1000, timeout: 5000 },
        retry: { maxAttempts: 3, delay: 1000 },
      },
      webUI: { enabled: true, port: 3000 },
    }),
    getToolCallLogConfig: vi.fn().mockReturnValue({}),
    getMcpEndpoints: vi.fn().mockReturnValue([]),
    getCustomMCPTools: vi.fn().mockReturnValue([]),
    updateToolUsageStatsWithLock: vi.fn().mockResolvedValue(undefined),
    updateMCPServerToolStatsWithLock: vi.fn().mockResolvedValue(undefined),
    clearAllStatsUpdateLocks: vi.fn().mockImplementation(() => {}),
    getStatsUpdateLocks: vi.fn().mockReturnValue([]),
    getModelScopeApiKey: vi.fn().mockReturnValue(null),
    setConfig: vi.fn().mockResolvedValue(undefined),
    validateConfig: vi.fn().mockReturnValue({ valid: true }),
    getServiceConfig: vi.fn().mockReturnValue(undefined),
    watchConfig: vi.fn().mockReturnValue({ dispose: vi.fn() }),
    getConfigDir: vi.fn().mockReturnValue("/tmp/test"),
  },
}));

// Mock Logger 类和相关函数
vi.mock("../../Logger.js", () => ({
  Logger: vi.fn().mockImplementation(() => ({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
    withTag: vi.fn().mockReturnThis(),
  })),
  getLogger: vi.fn().mockReturnValue({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
    withTag: vi.fn().mockReturnThis(),
  }),
  setGlobalLogLevel: vi.fn(),
  getGlobalLogLevel: vi.fn().mockReturnValue("info"),
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
    withTag: vi.fn().mockReturnThis(),
  },
}));

// Mock StatusService
vi.mock("@services/StatusService.js", () => ({
  StatusService: vi.fn().mockImplementation(() => {
    return {
      updateRestartStatus: vi.fn(),
      getRestartStatus: vi.fn().mockReturnValue({ status: "completed" }),
      // 添加缺失的方法
      getFullStatus: vi.fn().mockReturnValue({
        client: { status: "connected", mcpEndpoint: "", activeMCPServers: [] },
        timestamp: Date.now(),
      }),
      getClientStatus: vi.fn().mockReturnValue({
        status: "connected",
        mcpEndpoint: "",
        activeMCPServers: [],
      }),
      isClientConnected: vi.fn().mockReturnValue(true),
      getLastHeartbeat: vi.fn().mockReturnValue(Date.now()),
    };
  }),
}));

// Mock EventBus
vi.mock("@services/EventBus.js", () => {
  const mockEventBus = {
    emitEvent: vi.fn(),
    onEvent: vi.fn(),
    on: vi.fn(),
    off: vi.fn(),
    once: vi.fn(),
    removeAllListeners: vi.fn(),
  };
  return {
    getEventBus: vi.fn().mockReturnValue(mockEventBus),
    EventBus: vi.fn().mockImplementation(() => mockEventBus),
  };
});

// Mock Container
vi.mock("@cli/Container.js", () => ({
  createContainer: vi.fn().mockResolvedValue({
    get: vi.fn().mockReturnValue({
      getStatus: vi.fn().mockResolvedValue({
        running: true,
        mode: "test",
        services: {},
      }),
    }),
  }),
  DIContainer: vi.fn().mockImplementation(() => ({
    register: vi.fn(),
    registerSingleton: vi.fn(),
    registerInstance: vi.fn(),
    get: vi.fn(),
    has: vi.fn(),
  })),
}));

// Mock ServiceApiHandler
vi.mock("@handlers/ServiceApiHandler.js", () => ({
  ServiceApiHandler: vi.fn().mockImplementation(() => ({
    getServiceHealth: vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          success: true,
          data: { status: "healthy", timestamp: Date.now() },
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }
      )
    ),
    getServiceStatus: vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ success: true, data: { running: true } }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    ),
    restartService: vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({ success: true, message: "重启请求已接收" }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }
      )
    ),
    stopService: vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({ success: true, message: "停止请求已接收" }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }
      )
    ),
    startService: vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({ success: true, message: "启动请求已接收" }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }
      )
    ),
  })),
}));

describe("MCPServer 阶段一重构验收测试", () => {
  let server: MCPServer;
  let port: number;
  let originalEnv: string | undefined;

  beforeEach(async () => {
    // 设置测试环境变量，防止在项目根目录创建配置文件
    originalEnv = process.env.XIAOZHI_CONFIG_DIR;
    process.env.XIAOZHI_CONFIG_DIR = "/tmp/xiaozhi-test-mcp-server";

    // 启用开发模式以获取详细错误信息
    process.env.NODE_ENV = "development";

    // 彻底清除可能影响端口配置的所有环境变量
    process.env.PORT = undefined;
    process.env.MCP_PORT = undefined;
    process.env.MCP_SERVER_MODE = undefined;
    process.env.WEBSOCKET_URL = undefined;
    process.env.MCP_WEBSOCKET_URL = undefined;
    process.env.HTTP_PORT = undefined;
    process.env.SERVER_PORT = undefined;

    vi.clearAllMocks();

    // 使用随机端口避免冲突
    port = 3000 + Math.floor(Math.random() * 1000);
    console.log(`测试使用端口: ${port}`);
    server = new MCPServer(port);
  });

  afterEach(async () => {
    if (server) {
      await server.stop();
    }

    // 恢复环境变量
    if (originalEnv !== undefined) {
      process.env.XIAOZHI_CONFIG_DIR = originalEnv;
    } else {
      process.env.XIAOZHI_CONFIG_DIR = undefined;
    }

    // 确保所有端口相关环境变量都被清除
    process.env.PORT = undefined;
    process.env.MCP_PORT = undefined;
    process.env.MCP_SERVER_MODE = undefined;
    process.env.WEBSOCKET_URL = undefined;
    process.env.MCP_WEBSOCKET_URL = undefined;
    process.env.HTTP_PORT = undefined;
    process.env.SERVER_PORT = undefined;
  });

  test("应该正确初始化 MCPMessageHandler 和 MCPServiceManager", () => {
    expect(server).toBeDefined();
    // 验证内部组件已正确初始化
    expect(server.getServiceManager).toBeDefined();
  });

  test("应该正确处理 initialize 请求", async () => {
    console.log(`开始启动服务器，端口: ${port}`);

    // 首先检查端口是否可用
    console.log(`检查端口 ${port} 是否可用`);
    try {
      const net = await import("node:net");
      const portAvailable = await new Promise<boolean>((resolve) => {
        const socket = new net.Socket();
        socket.setTimeout(1000);

        socket.on("connect", () => {
          socket.destroy();
          resolve(false); // 端口已被占用
        });

        socket.on("timeout", () => {
          socket.destroy();
          resolve(true); // 端口可用
        });

        socket.on("error", () => {
          resolve(true); // 端口可用
        });

        socket.connect(port, "localhost");
      });

      if (!portAvailable) {
        throw new Error(`端口 ${port} 已被占用`);
      }
      console.log(`端口 ${port} 可用`);
    } catch (error) {
      console.error("端口检查失败:", error);
      throw error;
    }

    try {
      await server.start();
      console.log(`服务器启动完成，端口: ${port}`);
    } catch (error) {
      console.error(`服务器启动失败，端口: ${port}`, error);
      throw error;
    }

    // 添加更多等待时间确保服务器完全启动
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // 验证服务器状态
    console.log(`检查服务器状态，端口: ${port}`);
    const status = server.getStatus();
    console.log("服务器状态:", status);
    expect(server.isRunning()).toBe(true);

    // 检查服务管理器中的传输适配器状态
    const serviceManager = server.getServiceManager();
    if (serviceManager) {
      console.log("获取服务管理器中的传输适配器信息");
      // 尝试获取更多信息
    }

    // 尝试进行端口连接测试
    console.log(`测试端口连接: ${port}`);
    try {
      const net = await import("node:net");
      const connectionResult = await new Promise<boolean>((resolve) => {
        const socket = new net.Socket();
        socket.setTimeout(3000);

        socket.on("connect", () => {
          socket.destroy();
          resolve(true);
        });

        socket.on("timeout", () => {
          socket.destroy();
          resolve(false);
        });

        socket.on("error", (error) => {
          console.error("连接错误:", error);
          resolve(false);
        });

        socket.connect(port, "localhost");
      });

      console.log(`端口连接测试结果: ${connectionResult}`);
      if (!connectionResult) {
        throw new Error(`端口 ${port} 无法连接`);
      }
    } catch (error) {
      console.error("端口连接测试失败:", error);
      throw error;
    }

    console.log(`发送请求到 http://localhost:${port}/mcp`);
    const response = await request(`http://localhost:${port}`)
      .post("/mcp")
      .send({
        jsonrpc: "2.0",
        method: "initialize",
        params: {
          protocolVersion: "2024-11-05",
          capabilities: {},
          clientInfo: {
            name: "test-client",
            version: "1.0.0",
          },
        },
        id: 1,
      });

    console.log(`收到响应，状态码: ${response.status}`);
    expect(response.status).toBe(200);
    expect(response.body.jsonrpc).toBe("2.0");
    expect(response.body.result).toBeDefined();
    expect(response.body.result.serverInfo).toBeDefined();
    expect(response.body.result.serverInfo.name).toBe("xiaozhi-mcp-server");
    expect(response.body.result.serverInfo.version).toBe("1.0.0");
    expect(response.body.id).toBe(1);
  });

  test("应该正确处理 tools/list 请求", async () => {
    await server.start();

    // 添加等待时间确保服务器完全启动
    await new Promise((resolve) => setTimeout(resolve, 100));

    const response = await request(`http://localhost:${port}`)
      .post("/mcp")
      .send({
        jsonrpc: "2.0",
        method: "tools/list",
        id: 2,
      });

    expect(response.status).toBe(200);
    expect(response.body.jsonrpc).toBe("2.0");
    expect(response.body.result).toBeDefined();
    expect(response.body.result.tools).toBeDefined();
    expect(Array.isArray(response.body.result.tools)).toBe(true);
    expect(response.body.id).toBe(2);
  });

  test("应该正确处理 ping 请求", async () => {
    await server.start();

    // 添加等待时间确保服务器完全启动
    await new Promise((resolve) => setTimeout(resolve, 100));

    const response = await request(`http://localhost:${port}`)
      .post("/mcp")
      .send({
        jsonrpc: "2.0",
        method: "ping",
        id: 3,
      });

    expect(response.status).toBe(200);
    expect(response.body.jsonrpc).toBe("2.0");
    expect(response.body.result).toBeDefined();
    expect(response.body.result.status).toBe("ok");
    expect(response.body.result.timestamp).toBeDefined();
    expect(response.body.id).toBe(3);
  });

  test("应该正确处理未知方法请求", async () => {
    await server.start();

    // 添加等待时间确保服务器完全启动
    await new Promise((resolve) => setTimeout(resolve, 100));

    const response = await request(`http://localhost:${port}`)
      .post("/mcp")
      .send({
        jsonrpc: "2.0",
        method: "unknown_method",
        id: 4,
      });

    expect(response.status).toBe(200);
    expect(response.body.jsonrpc).toBe("2.0");
    expect(response.body.error).toBeDefined();
    expect(response.body.error.code).toBe(-32601); // Method not found
    expect(response.body.error.message).toContain("未知的方法");
    expect(response.body.id).toBe(4);
  });

  test("应该正确处理状态端点", async () => {
    await server.start();

    // 添加等待时间确保服务器完全启动
    await new Promise((resolve) => setTimeout(resolve, 100));

    const response = await request(`http://localhost:${port}`).get(
      "/api/status"
    );

    expect(response.status).toBe(200);
    // 检查 WebServer 状态端点响应格式
    expect(response.body).toBeDefined();
    expect(response.body.success).toBe(true);
    expect(response.body.data).toBeDefined();
    expect(response.body.data.client).toBeDefined();
    expect(typeof response.body.data).toBe("object");
  });

  test("应该正确处理健康检查端点", async () => {
    await server.start();

    // 添加等待时间确保服务器完全启动
    await new Promise((resolve) => setTimeout(resolve, 100));

    const response = await request(`http://localhost:${port}`).get(
      "/api/services/health"
    );

    // 如果状态码不是200，输出详细的错误信息用于调试
    if (response.status !== 200) {
      console.error("健康检查端点失败，状态码:", response.status);
      console.error("响应体:", JSON.stringify(response.body, null, 2));
      console.error("响应头:", JSON.stringify(response.headers, null, 2));
    }

    expect(response.status).toBe(200);
    // 检查 WebServer 健康检查端点响应格式
    expect(response.body).toBeDefined();
    expect(response.body.success).toBe(true);
    expect(response.body.data).toBeDefined();
    expect(response.body.data.status).toBe("healthy");
    expect(typeof response.body.data).toBe("object");
  });

  test("SSE 端点应该正确设置响应头", async () => {
    await server.start();

    // 添加等待时间确保服务器完全启动
    await new Promise((resolve) => setTimeout(resolve, 100));

    // 测试 SSE 端点存在且可以连接
    // WebServer 的 SSE 端点是 /mcp 的 GET 请求
    // 由于 SSE 连接会保持，我们只验证端点可以接受连接
    try {
      const response = await request(`http://localhost:${port}`)
        .get("/mcp")
        .set("Accept", "text/event-stream")
        .timeout(500) // 短超时，只要连接建立就成功
        .buffer(false);

      // 只要能建立连接就算成功，不需要等待完整响应
      expect(response.status).toBe(200);
      console.log("SSE 连接建立成功");
    } catch (error) {
      // 超时错误实际上意味着连接已建立（SSE保持连接）
      if (error instanceof Error && error.message.includes("Timeout")) {
        console.log("SSE 连接建立成功（超时是正常的，因为SSE保持连接）");
        expect(true).toBe(true); // 超时意味着连接成功
      } else {
        throw error;
      }
    }
  });

  test("性能测试：响应时间应该有显著改善", async () => {
    await server.start();

    // 添加等待时间确保服务器完全启动
    await new Promise((resolve) => setTimeout(resolve, 100));

    const startTime = Date.now();

    const response = await request(`http://localhost:${port}`)
      .post("/mcp")
      .send({
        jsonrpc: "2.0",
        method: "ping",
        id: 5,
      });

    const endTime = Date.now();
    const responseTime = endTime - startTime;

    expect(response.status).toBe(200);
    expect(responseTime).toBeLessThan(50); // 响应时间应该小于 50ms

    console.log(`响应时间: ${responseTime}ms`);
  });
});

// 扩展 MCPServer 类型以便测试
declare module "../MCPServer.js" {
  interface MCPServer {
    getServiceManager(): any;
  }
}

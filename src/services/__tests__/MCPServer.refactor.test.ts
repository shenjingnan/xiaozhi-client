/**
 * 阶段一重构验收测试
 * 验证消除双层代理后的 MCP 服务器功能
 */

import request from "supertest";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { MCPServer } from "../MCPServer.js";

// 模拟依赖项
vi.mock("../../configManager.js", () => ({
  configManager: {
    getToolCallLogConfig: vi.fn().mockReturnValue({}),
    getMcpEndpoints: vi.fn().mockReturnValue([]),
    configExists: vi.fn().mockReturnValue(false),
    getConfigDir: vi.fn().mockReturnValue("/tmp/test"),
    updateToolUsageStatsWithLock: vi.fn().mockResolvedValue(undefined),
    updateMCPServerToolStatsWithLock: vi.fn().mockResolvedValue(undefined),
    clearAllStatsUpdateLocks: vi.fn().mockImplementation(() => {}),
    getStatsUpdateLocks: vi.fn().mockReturnValue([]),
    getModelScopeApiKey: vi.fn().mockReturnValue(null),
  },
}));

vi.mock("../../Logger.js", () => ({
  Logger: vi.fn().mockImplementation(() => ({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
    withTag: vi.fn().mockReturnThis(),
  })),
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
    withTag: vi.fn().mockReturnThis(),
  },
  getLogger: vi.fn().mockReturnValue({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
    withTag: vi.fn().mockReturnThis(),
  }),
  setGlobalLogLevel: vi.fn(),
  getGlobalLogLevel: vi.fn().mockReturnValue("info"),
}));

describe("MCPServer 阶段一重构验收测试", () => {
  let server: MCPServer;
  let port: number;
  let originalEnv: string | undefined;

  beforeEach(async () => {
    // 设置测试环境变量，防止在项目根目录创建配置文件
    originalEnv = process.env.XIAOZHI_CONFIG_DIR;
    process.env.XIAOZHI_CONFIG_DIR = "/tmp/xiaozhi-test-mcp-server";

    vi.clearAllMocks();

    // 使用随机端口避免冲突
    port = 3000 + Math.floor(Math.random() * 1000);
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
  });

  test("应该正确初始化 MCPMessageHandler 和 MCPServiceManager", () => {
    expect(server).toBeDefined();
    // 验证内部组件已正确初始化
    expect(server.getServiceManager).toBeDefined();
  });

  test("应该正确处理 initialize 请求", async () => {
    await server.start();

    const response = await request(`http://localhost:${port}`)
      .post("/rpc")
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

    const response = await request(`http://localhost:${port}`)
      .post("/rpc")
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

    const response = await request(`http://localhost:${port}`)
      .post("/rpc")
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

    const response = await request(`http://localhost:${port}`)
      .post("/rpc")
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

    const response = await request(`http://localhost:${port}`).get("/status");

    expect(response.status).toBe(200);
    expect(response.body.status).toBe("ok");
    expect(response.body.mode).toBe("mcp-server");
    expect(response.body.serviceManager).toBe("running");
    expect(typeof response.body.clients).toBe("number");
    expect(typeof response.body.tools).toBe("number");
  });

  test("应该正确处理健康检查端点", async () => {
    await server.start();

    const response = await request(`http://localhost:${port}`).get("/health");

    expect(response.status).toBe(200);
    expect(response.body.status).toBe("ok");
    expect(response.body.mode).toBe("mcp-server");
  });

  test("SSE 端点应该正确设置响应头", async () => {
    await server.start();

    // 只测试 SSE 端点的响应头，不等待数据流
    const response = await request(`http://localhost:${port}`)
      .get("/sse")
      .timeout(500) // 短超时，只验证连接建立
      .buffer(false) // 不缓冲响应体
      .expect(200);

    // 验证 SSE 响应头设置正确
    expect(response.headers["content-type"]).toContain("text/event-stream");
    expect(response.headers["cache-control"]).toContain("no-cache");
    expect(response.headers.connection).toContain("keep-alive");
  });

  test("性能测试：响应时间应该有显著改善", async () => {
    await server.start();

    const startTime = Date.now();

    const response = await request(`http://localhost:${port}`)
      .post("/rpc")
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

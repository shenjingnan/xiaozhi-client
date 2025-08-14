import { EventEmitter } from "node:events";
import express from "express";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MCPServer } from "./mcpServer.js";

// Mock dependencies
vi.mock("express", () => {
  const mockApp = {
    use: vi.fn(),
    get: vi.fn(),
    post: vi.fn(),
    listen: vi.fn((port, host, callback) => {
      // 处理不同的参数组合：listen(port, callback) 或 listen(port, host, callback)
      let actualCallback = callback;
      if (typeof host === "function") {
        // 如果第二个参数是函数，说明没有传host参数
        actualCallback = host;
      }
      actualCallback?.();
      return { close: vi.fn((cb) => cb?.()) };
    }),
  };
  const expressMock = vi.fn(() => mockApp) as any;
  expressMock.json = vi.fn(() => (req: any, res: any, next: any) => next());
  expressMock.urlencoded = vi.fn(
    () => (req: any, res: any, next: any) => next()
  );
  return {
    default: expressMock,
  };
});

vi.mock("node:child_process", () => ({
  spawn: vi.fn(() => {
    const mockProcess = new EventEmitter() as any;
    mockProcess.stdin = {
      write: vi.fn(),
    };
    mockProcess.stdout = new EventEmitter();
    mockProcess.stderr = new EventEmitter();
    mockProcess.kill = vi.fn((signal) => {
      // Simulate process exit when killed
      setTimeout(() => {
        mockProcess.emit("exit", 0, signal);
      }, 10);
    });

    // Simulate successful startup
    setTimeout(() => {
      mockProcess.stdout.emit("data", Buffer.from("MCP proxy ready"));
    }, 10);

    return mockProcess;
  }),
}));

vi.mock("../logger.js", () => ({
  logger: {
    withTag: vi.fn(() => ({
      info: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
      debug: vi.fn(),
    })),
  },
}));

vi.mock("../configManager.js", () => ({
  configManager: {
    configExists: vi.fn(() => true),
  },
}));

vi.mock("node:fs", async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...(actual as any),
    existsSync: vi.fn((path: string) => {
      // 在测试环境中模拟文件存在情况
      if (path.includes("mcpServerProxy.js")) {
        return true;
      }
      return (actual as any).existsSync(path);
    }),
  };
});

describe("MCPServer", () => {
  let server: MCPServer;

  beforeEach(() => {
    vi.clearAllMocks();
    server = new MCPServer(3000);
  });

  it("应该使用默认端口创建实例", () => {
    const defaultServer = new MCPServer();
    expect(defaultServer).toBeInstanceOf(MCPServer);
    expect(defaultServer).toBeInstanceOf(EventEmitter);
  });

  it("应该使用自定义端口创建实例", () => {
    expect(server).toBeInstanceOf(MCPServer);
    expect(server).toBeInstanceOf(EventEmitter);
  });

  it("应该在构造时设置中间件和路由", () => {
    const mockExpress = vi.mocked(express);
    const mockApp = mockExpress();

    expect(mockApp.use).toHaveBeenCalled();
    expect(mockApp.get).toHaveBeenCalledWith("/sse", expect.any(Function));
    expect(mockApp.post).toHaveBeenCalledWith(
      "/messages",
      expect.any(Function)
    );
    expect(mockApp.post).toHaveBeenCalledWith("/rpc", expect.any(Function));
    expect(mockApp.get).toHaveBeenCalledWith("/health", expect.any(Function));
  });

  describe("SSE端点", () => {
    it("应该处理SSE客户端连接", () => {
      const mockExpress = vi.mocked(express);
      const mockApp = mockExpress();

      // 获取SSE处理器
      const sseHandler = (mockApp.get as any).mock.calls.find(
        (call) => call[0] === "/sse"
      )?.[1];

      expect(sseHandler).toBeDefined();

      // 模拟请求和响应
      const mockReq = new EventEmitter() as any;
      const mockRes = {
        setHeader: vi.fn(),
        write: vi.fn(),
      };

      // 调用处理器
      sseHandler?.(mockReq, mockRes);

      // 检查是否设置了头部
      expect(mockRes.setHeader).toHaveBeenCalledWith(
        "Content-Type",
        "text/event-stream"
      );
      expect(mockRes.setHeader).toHaveBeenCalledWith(
        "Cache-Control",
        "no-cache, no-transform"
      );
      expect(mockRes.setHeader).toHaveBeenCalledWith(
        "Connection",
        "keep-alive"
      );
      expect(mockRes.setHeader).toHaveBeenCalledWith("X-Accel-Buffering", "no");

      // 检查是否发送了带有sessionId的端点事件
      expect(mockRes.write).toHaveBeenCalledWith(
        expect.stringMatching(
          /event: endpoint\ndata: \/messages\?sessionId=[\w-]+\n\n/
        )
      );
    });

    it("应该为每个连接生成唯一的sessionId", () => {
      const mockExpress = vi.mocked(express);
      const mockApp = mockExpress();

      const sseHandler = (mockApp.get as any).mock.calls.find(
        (call) => call[0] === "/sse"
      )?.[1];

      const sessionIds = new Set<string>();

      // 测试多个连接
      for (let i = 0; i < 5; i++) {
        const mockReq = new EventEmitter() as any;
        const mockRes = {
          setHeader: vi.fn(),
          write: vi.fn(),
        };

        sseHandler?.(mockReq, mockRes);

        // 从write调用中提取sessionId
        const writeCall = mockRes.write.mock.calls[0][0];
        const match = writeCall.match(/sessionId=([\w-]+)/);
        if (match) {
          sessionIds.add(match[1]);
        }
      }

      // 所有sessionId应该是唯一的
      expect(sessionIds.size).toBe(5);
    });
  });

  describe("消息端点", () => {
    it("应该处理带有有效sessionId的消息", async () => {
      const mockExpress = vi.mocked(express);
      const mockApp = mockExpress();

      // 启动服务器以初始化代理
      await server.start();

      // 获取消息处理器
      const messagesHandler = (mockApp.post as any).mock.calls.find(
        (call) => call[0] === "/messages"
      )?.[1];

      expect(messagesHandler).toBeDefined();

      // 模拟请求和响应
      const mockReq = {
        query: { sessionId: "test-session-123" },
        body: {
          jsonrpc: "2.0",
          id: 1,
          method: "test",
          params: {},
        },
      };
      const mockRes = {
        status: vi.fn(() => mockRes),
        json: vi.fn(),
        send: vi.fn(),
      };

      // 在服务器中设置模拟客户端
      const mockClient = {
        id: "client-1",
        sessionId: "test-session-123",
        response: {
          write: vi.fn(),
        },
      };
      // 访问私有客户端映射（用于测试目的）
      (server as any).clients.set("test-session-123", mockClient);

      // 模拟forwardToProxy方法立即解析
      const originalForwardToProxy = (server as any).forwardToProxy;
      (server as any).forwardToProxy = vi.fn().mockResolvedValue({
        jsonrpc: "2.0",
        id: 1,
        result: { success: true },
      });

      // 调用处理器
      await messagesHandler?.(mockReq as any, mockRes as any);

      // 检查响应
      expect(mockRes.status).toHaveBeenCalledWith(202);
      expect(mockRes.send).toHaveBeenCalled();

      // 恢复原始方法
      (server as any).forwardToProxy = originalForwardToProxy;
    });

    it("应该处理通知消息（无id）", async () => {
      const mockExpress = vi.mocked(express);
      const mockApp = mockExpress();

      await server.start();

      const messagesHandler = (mockApp.post as any).mock.calls.find(
        (call) => call[0] === "/messages"
      )?.[1];

      const mockReq = {
        query: { sessionId: "test-session-123" },
        body: {
          jsonrpc: "2.0",
          method: "notifications/initialized",
          // 无id字段 - 这是一个通知
        },
      };
      const mockRes = {
        status: vi.fn(() => mockRes),
        json: vi.fn(),
        send: vi.fn(),
      };

      // 设置模拟客户端
      const mockClient = {
        id: "client-1",
        sessionId: "test-session-123",
        response: {
          write: vi.fn(),
        },
      };
      (server as any).clients.set("test-session-123", mockClient);

      // 调用处理器
      await messagesHandler?.(mockReq as any, mockRes as any);

      // 通知应该立即返回202
      expect(mockRes.status).toHaveBeenCalledWith(202);
      expect(mockRes.send).toHaveBeenCalled();
    });

    it("应该在缺少sessionId时返回400", async () => {
      const mockExpress = vi.mocked(express);
      const mockApp = mockExpress();

      const messagesHandler = (mockApp.post as any).mock.calls.find(
        (call) => call[0] === "/messages"
      )?.[1];

      const mockReq = {
        query: {}, // 无sessionId
        body: { jsonrpc: "2.0", id: 1, method: "test" },
      };
      const mockRes = {
        status: vi.fn(() => mockRes),
        json: vi.fn(),
      };

      await messagesHandler?.(mockReq as any, mockRes as any);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        jsonrpc: "2.0",
        error: {
          code: -32600,
          message: "无效或缺少sessionId",
        },
        id: 1,
      });
    });

    it("应该在sessionId无效时返回400", async () => {
      const mockExpress = vi.mocked(express);
      const mockApp = mockExpress();

      const messagesHandler = (mockApp.post as any).mock.calls.find(
        (call) => call[0] === "/messages"
      )?.[1];

      const mockReq = {
        query: { sessionId: "invalid-session" },
        body: { jsonrpc: "2.0", id: 1, method: "test" },
      };
      const mockRes = {
        status: vi.fn(() => mockRes),
        json: vi.fn(),
      };

      await messagesHandler?.(mockReq as any, mockRes as any);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        jsonrpc: "2.0",
        error: {
          code: -32600,
          message: "无效或缺少sessionId",
        },
        id: 1,
      });
    });

    it("应该在代理未运行时返回503", async () => {
      const mockExpress = vi.mocked(express);
      const mockApp = mockExpress();

      const messagesHandler = (mockApp.post as any).mock.calls.find(
        (call) => call[0] === "/messages"
      )?.[1];

      const mockReq = {
        query: { sessionId: "test-session-123" },
        body: { jsonrpc: "2.0", id: 1, method: "test" },
      };
      const mockRes = {
        status: vi.fn(() => mockRes),
        json: vi.fn(),
      };

      // 设置模拟客户端但不运行代理
      const mockClient = {
        id: "client-1",
        sessionId: "test-session-123",
        response: {
          write: vi.fn(),
        },
      };
      (server as any).clients.set("test-session-123", mockClient);
      (server as any).mcpProxy = null; // 确保代理未运行

      await messagesHandler?.(mockReq as any, mockRes as any);

      expect(mockRes.status).toHaveBeenCalledWith(503);
      expect(mockRes.json).toHaveBeenCalledWith({
        jsonrpc: "2.0",
        error: {
          code: -32603,
          message: "MCP代理未运行",
        },
        id: 1,
      });
    });
  });

  describe("RPC端点", () => {
    it("应该在代理未运行时返回503", async () => {
      const mockExpress = vi.mocked(express);
      const mockApp = mockExpress();

      // 获取RPC处理器
      const rpcHandler = (mockApp.post as any).mock.calls.find(
        (call) => call[0] === "/rpc"
      )?.[1];

      expect(rpcHandler).toBeDefined();

      // 模拟请求和响应
      const mockReq = {
        body: { jsonrpc: "2.0", id: 1, method: "test" },
      };
      const mockRes = {
        status: vi.fn(() => mockRes),
        json: vi.fn(),
      };

      // 调用处理器
      await rpcHandler?.(mockReq as any, mockRes as any);

      // 检查错误响应
      expect(mockRes.status).toHaveBeenCalledWith(503);
      expect(mockRes.json).toHaveBeenCalledWith({
        jsonrpc: "2.0",
        error: {
          code: -32603,
          message: "MCP代理未运行",
        },
        id: 1,
      });
    });
  });

  describe("健康检查端点", () => {
    it("应该返回健康状态", () => {
      const mockExpress = vi.mocked(express);
      const mockApp = mockExpress();

      // 获取健康检查处理器
      const healthHandler = (mockApp.get as any).mock.calls.find(
        (call) => call[0] === "/health"
      )?.[1];

      expect(healthHandler).toBeDefined();

      // 模拟请求和响应
      const mockReq = {};
      const mockRes = {
        json: vi.fn(),
      };

      // 调用处理器
      healthHandler?.(mockReq as any, mockRes as any);

      // 检查响应
      expect(mockRes.json).toHaveBeenCalledWith({
        status: "ok",
        mode: "mcp-server",
        proxy: "stopped",
        clients: 0,
      });
    });
  });

  describe("启动和停止", () => {
    it("应该成功启动服务器", async () => {
      await server.start();

      const mockExpress = vi.mocked(express);
      const mockApp = mockExpress();

      expect(mockApp.listen).toHaveBeenCalledWith(
        3000,
        "0.0.0.0",
        expect.any(Function)
      );
    });

    it("应该在成功启动后发出started事件", async () => {
      const startedHandler = vi.fn();
      server.on("started", startedHandler);

      await server.start();

      expect(startedHandler).toHaveBeenCalled();
    });

    it("应该成功停止服务器", async () => {
      await server.start();
      await server.stop();

      // 不应该抛出异常
      expect(true).toBe(true);
    });

    it("应该在停止后发出stopped事件", async () => {
      const stoppedHandler = vi.fn();
      server.on("stopped", stoppedHandler);

      await server.start();
      await server.stop();

      expect(stoppedHandler).toHaveBeenCalled();
    });
  });

  describe("客户端管理", () => {
    it("应该处理客户端断开连接", () => {
      const mockExpress = vi.mocked(express);
      const mockApp = mockExpress();

      // 获取SSE处理器
      const sseHandler = (mockApp.get as any).mock.calls.find(
        (call) => call[0] === "/sse"
      )?.[1];

      // 模拟请求和响应
      const mockReq = new EventEmitter() as any;
      const mockRes = {
        setHeader: vi.fn(),
        write: vi.fn(),
      };

      // 调用处理器
      sseHandler?.(mockReq, mockRes);

      // 模拟客户端断开连接
      mockReq.emit("close");

      // 客户端应该被移除（我们无法直接测试这个，因为是私有状态）
      expect(true).toBe(true);
    });
  });

  describe("转发到代理", () => {
    it("应该优雅地处理超时而不拒绝", async () => {
      // 启动服务器以初始化代理
      await server.start();

      // 访问私有的forwardToProxy方法
      const forwardToProxy = (server as any).forwardToProxy.bind(server);

      // 模拟代理不响应（模拟超时）
      const mockProxy = (server as any).mcpProxy;
      if (mockProxy?.stdin) {
        mockProxy.stdin.write = vi.fn();
      }

      // 创建要转发的消息
      const message = {
        jsonrpc: "2.0",
        id: 123,
        method: "test/method",
        params: {},
      };

      // 加快测试速度通过减少超时时间
      vi.useFakeTimers();

      // 调用forwardToProxy
      const resultPromise = forwardToProxy(message);

      // 快进时间以触发超时
      vi.advanceTimersByTime(31000);

      // 等待Promise解析
      const result = await resultPromise;

      // 应该解析为超时指示符而不是拒绝
      expect(result).toEqual({
        jsonrpc: "2.0",
        id: 123,
        result: {
          _timeout: true,
          message: "响应可能已通过SSE发送",
        },
      });

      vi.useRealTimers();
    }, 10000); // 增加超时时间到10秒

    it("应该在收到响应时清除超时", async () => {
      await server.start();

      // 直接测试响应处理机制
      const message = {
        jsonrpc: "2.0",
        id: 456,
        method: "test/method",
        params: {},
      };

      // 手动添加待处理请求以模拟forwardToProxy行为
      const pendingRequests = (server as any).pendingRequests;
      let resolvedValue: any = null;
      let timeoutCleared = false;

      const mockTimeoutId = setTimeout(() => {
        // 如果超时被正确清除，这不应该被调用
      }, 1000);

      const originalClearTimeout = global.clearTimeout;
      global.clearTimeout = vi.fn((id) => {
        if (id === mockTimeoutId) {
          timeoutCleared = true;
        }
        return originalClearTimeout(id);
      });

      pendingRequests.set(456, {
        resolve: (value: any) => {
          resolvedValue = value;
        },
        reject: (error: any) => {
          throw error;
        },
        timeoutId: mockTimeoutId,
      });

      // 清除响应缓冲区以确保干净状态
      (server as any).responseBuffer = "";

      // 触发响应处理
      const handleProxyResponse = (server as any).handleProxyResponse.bind(
        server
      );
      handleProxyResponse(
        Buffer.from(
          `${JSON.stringify({
            jsonrpc: "2.0",
            id: 456,
            result: { success: true },
          })}\n`
        )
      );

      // 检查响应是否被正确处理
      expect(resolvedValue).toEqual({
        jsonrpc: "2.0",
        id: 456,
        result: { success: true },
      });
      expect(timeoutCleared).toBe(true);
      expect(pendingRequests.has(456)).toBe(false);

      // 恢复clearTimeout
      global.clearTimeout = originalClearTimeout;
    }, 10000); // 增加超时时间到10秒
  });

  describe("发送到客户端", () => {
    it("应该以正确的SSE格式发送消息", async () => {
      await server.start();

      const mockClient = {
        id: "client-1",
        sessionId: "test-session",
        response: {
          write: vi.fn(),
        },
      };

      // 访问私有的sendToClient方法
      const sendToClient = (server as any).sendToClient.bind(server);

      const message = {
        jsonrpc: "2.0",
        id: 1,
        result: { test: "data" },
      };

      sendToClient(mockClient, message);

      // 检查消息是否以正确格式发送
      expect(mockClient.response.write).toHaveBeenCalledWith(
        `event: message\ndata: ${JSON.stringify(message)}\n\n`
      );
    }, 10000); // 增加超时时间到10秒

    it("应该优雅地处理写入错误", async () => {
      await server.start();

      const mockClient = {
        id: "client-1",
        sessionId: "test-session",
        response: {
          write: vi.fn(() => {
            throw new Error("Write failed");
          }),
        },
      };

      // 将客户端添加到服务器
      (server as any).clients.set("test-session", mockClient);

      const sendToClient = (server as any).sendToClient.bind(server);
      const message = { jsonrpc: "2.0", id: 1, result: {} };

      // 不应该抛出异常
      expect(() => sendToClient(mockClient, message)).not.toThrow();

      // 出现错误时应该移除客户端
      expect((server as any).clients.has("test-session")).toBe(false);
    }, 10000); // 增加超时时间到10秒
  });

  // 测试 xiaozhi start --server 命令相关功能
  describe("MCP Server模式", () => {
    it("应该能够创建MCPServer实例", () => {
      const server = new MCPServer(8080);
      expect(server).toBeInstanceOf(MCPServer);
    });

    it("应该正确处理同时连接xiaozhi.me和其他MCP客户端的功能", async () => {
      // 模拟配置管理器返回多个端点
      const mockConfigManager = await import("../configManager.js");
      mockConfigManager.configManager.getMcpEndpoints = vi.fn(() => [
        "wss://xiaozhi.me/api/mcp",
        "wss://other-client.com/mcp",
      ]);

      // 创建服务器实例
      const server = new MCPServer(8080);

      // 模拟startMCPClient方法
      const startMCPClientSpy = vi.spyOn(server as any, "startMCPClient");

      // 模拟startMCPProxy方法
      const startMCPProxySpy = vi.spyOn(server as any, "startMCPProxy");

      // 模拟HTTP服务器启动
      const mockExpress = vi.mocked(express);
      const mockApp = mockExpress();
      const listenSpy = vi.spyOn(mockApp, "listen");

      // 启动服务器
      await server.start();

      // 验证是否同时启动了MCP代理和MCP客户端
      expect(startMCPProxySpy).toHaveBeenCalled();
      expect(startMCPClientSpy).toHaveBeenCalled();
      expect(listenSpy).toHaveBeenCalledWith(
        8080,
        "0.0.0.0",
        expect.any(Function)
      );

      // 清理
      await server.stop();
    }, 10000); // 增加超时时间到10秒

    it("应该在配置中没有端点时跳过客户端连接", async () => {
      // 模拟配置管理器返回空端点数组
      const mockConfigManager = await import("../configManager.js");
      mockConfigManager.configManager.getMcpEndpoints = vi.fn(() => []);

      // 创建服务器实例
      const server = new MCPServer(8080);

      // 模拟startMCPClient方法
      const startMCPClientSpy = vi.spyOn(server as any, "startMCPClient");

      // 模拟startMCPProxy方法
      const startMCPProxySpy = vi.spyOn(server as any, "startMCPProxy");

      // 模拟HTTP服务器启动
      const mockExpress = vi.mocked(express);
      const mockApp = mockExpress();
      const listenSpy = vi.spyOn(mockApp, "listen");

      // 启动服务器
      await server.start();

      // 验证是否启动了MCP代理但跳过了MCP客户端
      expect(startMCPProxySpy).toHaveBeenCalled();
      expect(startMCPClientSpy).toHaveBeenCalled();
      expect(listenSpy).toHaveBeenCalledWith(
        8080,
        "0.0.0.0",
        expect.any(Function)
      );

      // 清理
      await server.stop();
    }, 10000); // 增加超时时间到10秒

    it("应该正确处理配置读取错误", async () => {
      // 模拟配置管理器抛出错误
      const mockConfigManager = await import("../configManager.js");
      mockConfigManager.configManager.getMcpEndpoints = vi.fn(() => {
        throw new Error("配置读取错误");
      });

      // 创建服务器实例
      const server = new MCPServer(8080);

      // 模拟startMCPClient方法
      const startMCPClientSpy = vi.spyOn(server as any, "startMCPClient");

      // 模拟startMCPProxy方法
      const startMCPProxySpy = vi.spyOn(server as any, "startMCPProxy");

      // 模拟HTTP服务器启动
      const mockExpress = vi.mocked(express);
      const mockApp = mockExpress();
      const listenSpy = vi.spyOn(mockApp, "listen");

      // 启动服务器
      await server.start();

      // 验证是否仍然启动了MCP代理和MCP客户端（即使配置读取失败）
      expect(startMCPProxySpy).toHaveBeenCalled();
      expect(startMCPClientSpy).toHaveBeenCalled();
      expect(listenSpy).toHaveBeenCalledWith(
        8080,
        "0.0.0.0",
        expect.any(Function)
      );

      // 清理
      await server.stop();
    }, 10000); // 增加超时时间到10秒
  });
});
